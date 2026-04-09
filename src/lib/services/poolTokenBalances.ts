import {
	createPublicClient,
	http,
	erc20Abi,
	getAddress,
	defineChain,
	formatUnits,
	type Address,
} from "viem"
import type { DexProtocol } from "$lib/graphql/types"

/** Multicall3 deployed on the same address across many EVM chains. */
const MULTICALL3_ADDRESS =
	"0xcA11bde05977b3631167028862bE2a173976CA11" as Address

/** Pool types where `ERC20.balanceOf(pool)` is not a meaningful reserve read. */
export const POOL_RESERVES_SKIP_PROTOCOLS = new Set<DexProtocol>([
	"BalancerV2",
	"BalancerV3",
	"UniswapV4",
	"PancakeSwapInfinity",
])

export function shouldSkipPoolReserves(protocol: DexProtocol): boolean {
	return POOL_RESERVES_SKIP_PROTOCOLS.has(protocol)
}

function chainForRpc(chainId: number, rpcUrl: string) {
	return defineChain({
		id: chainId,
		name: "chain",
		nativeCurrency: {
			name: "Ether",
			symbol: "ETH",
			decimals: 18,
		},
		rpcUrls: { default: { http: [rpcUrl] } },
		contracts: {
			multicall3: {
				address: MULTICALL3_ADDRESS,
				blockCreated: 14_353_601,
			},
		},
	})
}

export type TokenHolderBalanceCall = {
	tokenAddress: string
	holderAddress: string
}

/**
 * For each pair, reads `ERC20(token).balanceOf(holder)` via one viem multicall.
 * Return array aligns with `calls`; null means allowFailure or missing result.
 */
export async function fetchTokenBalanceOfHoldersMulticall(
	chainId: number,
	rpcUrls: string[],
	calls: ReadonlyArray<TokenHolderBalanceCall>,
): Promise<Array<bigint | null>> {
	if (calls.length === 0) return []

	const tokenAddrs = calls.map((c) => getAddress(c.tokenAddress as Address))
	const holderAddrs = calls.map((c) => getAddress(c.holderAddress as Address))

	let lastError: unknown

	for (const rpc of rpcUrls) {
		try {
			const chain = chainForRpc(chainId, rpc)
			const client = createPublicClient({
				chain,
				transport: http(rpc),
			})

			const contracts = calls.map((_, i) => ({
				address: tokenAddrs[i]!,
				abi: erc20Abi,
				functionName: "balanceOf" as const,
				args: [holderAddrs[i]!],
			}))

			const results = await client.multicall({
				contracts,
				allowFailure: true,
			})

			const out: Array<bigint | null> = results.map((r) =>
				r.status === "success" ? (r.result as bigint) : null,
			)

			if (out.some((v) => v !== null)) return out
		} catch (e) {
			lastError = e
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error(String(lastError ?? "All RPCs failed for pool balances"))
}

/** Trim trailing zeros; cap fractional digits for display. */
export function formatTokenAmount(
	value: bigint,
	decimals: number,
	maxFractionDigits = 8,
): string {
	const s = formatUnits(value, decimals)

	if (!s.includes(".")) return s

	const [intPart, fracRaw] = s.split(".")!
	const frac = fracRaw.slice(0, maxFractionDigits).replace(/0+$/, "")
	return frac ? `${intPart}.${frac}` : intPart!
}
