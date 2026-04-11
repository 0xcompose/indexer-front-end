import {
	createPublicClient,
	http,
	getAddress,
	type Address,
	type PublicClient,
} from "viem"
import { readContract } from "viem/actions"
import type { DexProtocol, PoolWithTokens, TokenMetadata } from "$lib/graphql/types"
import { uniswapV3PoolSlot0Abi } from "$lib/abis/uniswapV3PoolSlot0"
import { chainForRpc } from "$lib/services/viemChain"
import {
	fetchTokenBalanceOfHoldersMulticall,
	shouldSkipPoolReserves,
} from "$lib/services/poolTokenBalances"
import { fetchTokenMetadata } from "$lib/services/tokenMetadata"

/** Protocols whose pool contract exposes Uniswap V3–style `slot0` / `liquidity`. */
const SLOT0_LIKE_PROTOCOLS: ReadonlySet<DexProtocol> = new Set([
	"UniswapV3",
	"VelodromeSlipstreamCL",
	"AlgebraIntegral",
])

export type PoolModalTokenRow = {
	tokenIndex: number
	address: string
	balance: bigint | null
	symbol: string
	decimals: number
}

export type PoolModalConcentratedState = {
	liquidity: bigint
	sqrtPriceX96: bigint
	tick: number
}

export type PoolModalOnchainData = {
	tokens: PoolModalTokenRow[]
	reservesSkipped: boolean
	concentrated: PoolModalConcentratedState | null
}

function supportsSlot0Like(protocol: DexProtocol): boolean {
	return SLOT0_LIKE_PROTOCOLS.has(protocol)
}

async function readSlot0Like(
	client: PublicClient,
	pool: Address,
): Promise<PoolModalConcentratedState | null> {
	try {
		const slot0 = await readContract(client, {
			address: pool,
			abi: uniswapV3PoolSlot0Abi,
			functionName: "slot0",
		})
		const liquidity = await readContract(client, {
			address: pool,
			abi: uniswapV3PoolSlot0Abi,
			functionName: "liquidity",
		})
		let sqrtPriceX96: bigint
		let tick: number
		if (Array.isArray(slot0)) {
			sqrtPriceX96 = slot0[0] as bigint
			tick = Number(slot0[1])
		} else if (
			slot0 &&
			typeof slot0 === "object" &&
			"sqrtPriceX96" in slot0
		) {
			const o = slot0 as { sqrtPriceX96: bigint; tick: number | bigint }
			sqrtPriceX96 = o.sqrtPriceX96
			tick = Number(o.tick)
		} else {
			return null
		}
		return {
			sqrtPriceX96,
			liquidity: liquidity as bigint,
			tick,
		}
	} catch {
		return null
	}
}

/**
 * Token balances via `balanceOf(pool)` and, for V3-like pools, `liquidity` + `slot0`.
 */
export async function fetchPoolModalOnchainData(
	pool: PoolWithTokens,
	rpcUrls: string[],
): Promise<PoolModalOnchainData> {
	const rpcs = rpcUrls.filter(
		(u) => u.startsWith("http://") || u.startsWith("https://"),
	)
	if (rpcs.length === 0) throw new Error("No HTTP RPC for chain")

	const sorted = [...pool.poolTokens].toSorted(
		(a, b) => a.tokenIndex - b.tokenIndex,
	)

	const metaList: TokenMetadata[] = await Promise.all(
		sorted.map(async (pt) => {
			try {
				return await fetchTokenMetadata(pool.chainId, pt.token.address)
			} catch {
				return {
					name: "",
					symbol: "?",
					decimals: 18,
				}
			}
		}),
	)

	const reservesSkipped = shouldSkipPoolReserves(pool.protocol)

	let balanceByIndex: Array<bigint | null> = sorted.map(() => null)
	if (!reservesSkipped && sorted.length > 0) {
		const calls = sorted.map((pt) => ({
			tokenAddress: pt.token.address,
			holderAddress: pool.address,
		}))
		balanceByIndex = await fetchTokenBalanceOfHoldersMulticall(
			pool.chainId,
			rpcs,
			calls,
		)
	}

	const tokens: PoolModalTokenRow[] = sorted.map((pt, i) => ({
		tokenIndex: pt.tokenIndex,
		address: pt.token.address,
		balance: balanceByIndex[i] ?? null,
		symbol: metaList[i]!.symbol,
		decimals: metaList[i]!.decimals,
	}))

	let concentrated: PoolModalConcentratedState | null = null
	if (supportsSlot0Like(pool.protocol)) {
		const poolAddr = getAddress(pool.address as Address)
		for (const rpc of rpcs) {
			try {
				const chain = chainForRpc(pool.chainId, rpc)
				const client = createPublicClient({
					chain,
					transport: http(rpc),
				})
				concentrated = await readSlot0Like(client, poolAddr)
				if (concentrated) break
			} catch {
				// try next RPC
			}
		}
	}

	return { tokens, reservesSkipped, concentrated }
}
