import {
	createPublicClient,
	http,
	getAddress,
	formatUnits,
	type Address,
	type PublicClient,
} from "viem"
import { getBlockNumber, getContractEvents } from "viem/actions"
import { uniswapV2PairEventsAbi } from "$lib/abis/uniswapV2Pair"
import { chainForRpc } from "$lib/services/viemChain"

/** Max block span per `eth_getLogs` request (many RPCs cap ~10k). */
const LOG_CHUNK_BLOCKS = 9_000n

/** Calendar month used for “~30d” scan windows (seconds). */
const SECONDS_PER_MONTH = 30 * 24 * 60 * 60

/**
 * Heuristic mean block time (seconds). Extend for chains you care about; unknown
 * chains default to L1-like 12s (~216k blocks/month).
 */
const CHAIN_AVG_BLOCK_TIME_SEC: Record<number, number> = {
	1: 12,
	5: 12,
	11155111: 12,
	17000: 12,
	42161: 0.25,
	421614: 0.25,
	137: 2,
	8453: 2,
	84532: 2,
	10: 2,
	11155420: 2,
	56: 3,
	97: 3,
	43114: 2,
	324: 1,
	1101: 0.25,
	59140: 2,
	59144: 2,
	100: 5,
}

const DEFAULT_BLOCK_TIME_SEC = 12

/**
 * Hard cap on scan width (blocks). Fast L2s need ~10M+ blocks for a true month;
 * this avoids runaway ranges if block time is mis-estimated.
 */
const MAX_LOG_SCAN_WINDOW_BLOCKS = 12_000_000n

function avgBlockTimeSec(chainId: number): number {
	return CHAIN_AVG_BLOCK_TIME_SEC[chainId] ?? DEFAULT_BLOCK_TIME_SEC
}

/**
 * Blocks to scan back from head for roughly one month on this chain
 * (~30d / avg block time), capped.
 */
export function recentWindowBlocksForChain(chainId: number): bigint {
	const t = avgBlockTimeSec(chainId)
	const raw = Math.ceil(SECONDS_PER_MONTH / t)
	let n = BigInt(raw)
	if (n > MAX_LOG_SCAN_WINDOW_BLOCKS) n = MAX_LOG_SCAN_WINDOW_BLOCKS
	if (n < 1n) n = 1n
	return n
}

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

/**
 * `createdAtBlock` from indexer. If 0, only the per-chain month window from head
 * is scanned.
 */
export function poolCreatedAtToFromBlock(
	createdAtBlock: unknown,
	head: bigint,
	chainId: number,
): bigint {
	const window = recentWindowBlocksForChain(chainId)
	const c = toBigIntBlock(createdAtBlock)
	if (c <= 0n) return head > window ? head - window : 0n
	const windowStart = head > window ? head - window : 0n
	return c > windowStart ? c : windowStart
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
 * Scans from `max(createdAtBlock, head − recentWindowBlocksForChain(chainId))` through head, chunked.
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
			const fromBlock = poolCreatedAtToFromBlock(
				params.createdAtBlock,
				head,
				params.chainId,
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
