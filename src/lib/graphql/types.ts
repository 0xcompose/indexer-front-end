export type DexProtocol =
	| "UniswapV2"
	| "UniswapV3"
	| "UniswapV4"
	| "PancakeSwapInfinity"
	| "AlgebraIntegral"
	| "Curve"
	| "BalancerV3"

export const ALL_PROTOCOLS: DexProtocol[] = [
	"UniswapV2",
	"UniswapV3",
	"UniswapV4",
	"PancakeSwapInfinity",
	"AlgebraIntegral",
	"Curve",
	"BalancerV3",
]

export interface Chain {
	id: number
	name: string
}

export const CHAIN_NAMES: Record<number, string> = {
	122: "Fuse",
	1514: "Story",
	43111: "Hemi",
}

export function getChainName(id: number): string {
	return CHAIN_NAMES[id] ?? `Chain ${id}`
}

export interface Token {
	id: string
	chainId: number
	address: string
}

export interface Pool {
	id: string
	chainId: number
	address: string
	protocol: DexProtocol
	creatorContract: string
}

export interface PoolToken {
	id: string
	pool: Pool
	token: Token
	tokenIndex: number
}

export interface PoolWithTokens extends Pool {
	poolTokens: Array<{ token: Token; tokenIndex: number }>
}

export interface AggregateResult {
	aggregate: { count: number }
}
