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

export interface Token {
	id: string
	chainId: number
	address: string
	poolCount: number
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

export interface ChainMetrics {
	chainId: number
	totalPools: number
	totalTokens: number
}
