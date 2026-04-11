import {
	createPublicClient,
	http,
	getAddress,
	formatUnits,
	type Address,
	type PublicClient,
} from "viem"
import { getBlockNumber, getContractEvents, getBlock } from "viem/actions"
import { uniswapV2PairEventsAbi } from "$lib/abis/uniswapV2Pair"
import { chainForRpc } from "$lib/services/viemChain"

/** Max block span per `eth_getLogs` request (many RPCs cap ~10k). */
const LOG_CHUNK_BLOCKS = 9_000n

/** History window: blocks whose timestamp is at or after (now − this many seconds). */
const SECONDS_PER_MONTH = 30 * 24 * 60 * 60

/**
 * Step backward in block number while probing timestamps; then binary-search the
 * exact month boundary. Keeps RPC calls modest on average.
 */
const TIMESTAMP_PROBE_BATCH_BLOCKS = 100_000n

const MAX_MONTH_PROBE_STEPS = 400

/**
 * Safety: never scan more than this many blocks even if timestamps disagree (bad
 * RPC clock etc.).
 */
const MAX_LOG_SCAN_WINDOW_BLOCKS = 12_000_000n

/** Max rows returned to the UI after merge/sort. */
export const V2_POOL_EVENTS_LIMIT = 30

export type V2PoolEventRow = {
	kind: "Swap" | "Mint" | "Burn"
	blockNumber: string
	transactionHash: string
	logIndex: number
	summary: string
}

export type V2PoolLogsResult = {
	events: V2PoolEventRow[]
	/** Inclusive lower bound of `eth_getLogs` scan */
	scannedFromBlock: string
	/** Inclusive upper bound (chain head at request time) */
	scannedToBlock: string
}

function toBigIntBlock(v: unknown): bigint {
	if (v == null || v === "") return 0n
	if (typeof v === "bigint") return v
	if (typeof v === "number" && Number.isFinite(v))
		return BigInt(Math.trunc(v))
	const s = String(v).trim().split(/[.eE]/)[0] ?? "0"
	try {
		return BigInt(s || "0")
	} catch {
		return 0n
	}
}

async function blockTimestamp(
	client: PublicClient,
	blockNumber: bigint,
): Promise<bigint> {
	const b = await getBlock(client, {
		blockNumber,
		includeTransactions: false,
	})
	return b.timestamp
}

/**
 * Smallest block number in [low, high] whose timestamp is >= targetTs.
 * Precondition: timestamp(high) >= targetTs, and if low > 0 then timestamp(low - 1n) < targetTs.
 */
async function lowerBoundBlockByTimestamp(
	client: PublicClient,
	targetTs: bigint,
	low: bigint,
	high: bigint,
): Promise<bigint> {
	let lo = low
	let hi = high
	while (lo < hi) {
		const mid = (lo + hi) / 2n
		const ts = await blockTimestamp(client, mid)
		if (ts >= targetTs) hi = mid
		else lo = mid + 1n
	}
	return lo
}

/**
 * First block (from genesis upward) that is still within the rolling calendar
 * month window — i.e. oldest block we include when scanning “~30d” of history.
 */
async function findMonthFloorBlock(
	client: PublicClient,
	head: bigint,
): Promise<bigint> {
	const targetTs = BigInt(Math.floor(Date.now() / 1000) - SECONDS_PER_MONTH)

	const headTs = await blockTimestamp(client, head)
	if (headTs < targetTs) return head

	let young = head
	for (let step = 0; step < MAX_MONTH_PROBE_STEPS; step++) {
		const next =
			young > TIMESTAMP_PROBE_BATCH_BLOCKS
				? young - TIMESTAMP_PROBE_BATCH_BLOCKS
				: 0n
		if (next === young) return 0n
		const ts = await blockTimestamp(client, next)
		if (ts < targetTs) {
			return lowerBoundBlockByTimestamp(
				client,
				targetTs,
				next + 1n,
				young,
			)
		}
		young = next
		if (next === 0n) return 0n
	}

	return 0n
}

function applyCreatedAtFloor(
	createdAtBlock: unknown,
	monthFloor: bigint,
	head: bigint,
): bigint {
	const c = toBigIntBlock(createdAtBlock)
	const floor = monthFloor > head ? 0n : monthFloor
	if (c <= 0n) return floor
	return c > floor ? c : floor
}

function capScanFromBlock(fromBlock: bigint, head: bigint): bigint {
	if (head <= MAX_LOG_SCAN_WINDOW_BLOCKS) return fromBlock
	const minAllowed = head - MAX_LOG_SCAN_WINDOW_BLOCKS
	return fromBlock < minAllowed ? minAllowed : fromBlock
}

function shortAmt(n: bigint): string {
	if (n === 0n) return "0"
	const s = formatUnits(n, 18)
	const [a, b = ""] = s.split(".")
	if (!b || /^0+$/.test(b)) return a ?? "0"
	const frac = b.replace(/0+$/, "").slice(0, 6)
	return frac ? `${a}.${frac}` : (a ?? "0")
}

async function getEventsChunked<E extends "Swap" | "Mint" | "Burn">(
	client: PublicClient,
	pool: Address,
	eventName: E,
	fromBlock: bigint,
	toBlock: bigint,
) {
	const out: Array<{
		eventName?: string
		blockNumber: bigint
		transactionHash: string
		logIndex: number
		args: unknown
	}> = []

	let start = fromBlock
	while (start <= toBlock) {
		const end =
			start + LOG_CHUNK_BLOCKS - 1n > toBlock
				? toBlock
				: start + LOG_CHUNK_BLOCKS - 1n
		const batch = await getContractEvents(client, {
			address: pool,
			abi: uniswapV2PairEventsAbi,
			eventName,
			fromBlock: start,
			toBlock: end,
		})
		for (const log of batch) {
			out.push(log)
		}
		start = end + 1n
	}
	return out
}

function rowFromLog(log: {
	eventName: string
	blockNumber: bigint
	transactionHash: string
	logIndex: number
	args: unknown
}): V2PoolEventRow {
	const args = log.args as Record<string, bigint>
	let summary: string
	if (log.eventName === "Swap") {
		summary = `Δ0 in ${shortAmt(args.amount0In)} / out ${shortAmt(args.amount0Out)} · Δ1 in ${shortAmt(args.amount1In)} / out ${shortAmt(args.amount1Out)}`
	} else if (log.eventName === "Mint") {
		summary = `mint ${shortAmt(args.amount0)} / ${shortAmt(args.amount1)}`
	} else {
		summary = `burn ${shortAmt(args.amount0)} / ${shortAmt(args.amount1)}`
	}
	return {
		kind: log.eventName as "Swap" | "Mint" | "Burn",
		blockNumber: log.blockNumber.toString(),
		transactionHash: log.transactionHash,
		logIndex: log.logIndex,
		summary,
	}
}

/**
 * Latest Swap / Mint / Burn logs for a V2 pair via RPC (on-demand).
 * Lower bound ≈ rolling calendar month from block timestamps (not fixed block count).
 */
export async function fetchUniswapV2PoolRecentEvents(params: {
	chainId: number
	poolAddress: string
	/** Pool deployment block from indexer */
	createdAtBlock: unknown
	rpcUrls: string[]
}): Promise<V2PoolLogsResult> {
	const pool = getAddress(params.poolAddress as Address)
	const rpcs = params.rpcUrls.filter(
		(u) => u.startsWith("http://") || u.startsWith("https://"),
	)
	if (rpcs.length === 0) throw new Error("No HTTP RPC for chain")

	let lastErr: unknown
	for (const rpc of rpcs) {
		try {
			const chain = chainForRpc(params.chainId, rpc)
			const client = createPublicClient({
				chain,
				transport: http(rpc),
			})

			const head = await getBlockNumber(client)
			let monthFloor = await findMonthFloorBlock(client, head)
			monthFloor = capScanFromBlock(monthFloor, head)
			const fromBlock = applyCreatedAtFloor(
				params.createdAtBlock,
				monthFloor,
				head,
			)

			const [swaps, mints, burns] = await Promise.all([
				getEventsChunked(client, pool, "Swap", fromBlock, head),
				getEventsChunked(client, pool, "Mint", fromBlock, head),
				getEventsChunked(client, pool, "Burn", fromBlock, head),
			])

			const merged = [...swaps, ...mints, ...burns]
			merged.sort((a, b) => {
				if (a.blockNumber !== b.blockNumber)
					return a.blockNumber > b.blockNumber ? -1 : 1
				return b.logIndex - a.logIndex
			})

			const events = merged.slice(0, V2_POOL_EVENTS_LIMIT).map((log) =>
				rowFromLog({
					eventName: log.eventName ?? "",
					blockNumber: log.blockNumber,
					transactionHash: log.transactionHash,
					logIndex: log.logIndex,
					args: log.args,
				}),
			)
			return {
				events,
				scannedFromBlock: fromBlock.toString(),
				scannedToBlock: head.toString(),
			}
		} catch (e) {
			lastErr = e
		}
	}

	throw lastErr instanceof Error
		? lastErr
		: new Error(String(lastErr ?? "RPC failed"))
}
