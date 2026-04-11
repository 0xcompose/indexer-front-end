/** Minimal IUniswapV3Pool for slot0 + liquidity (CL pools with same interface). */
export const uniswapV3PoolSlot0Abi = [
	{
		name: "slot0",
		type: "function",
		stateMutability: "view",
		inputs: [],
		outputs: [
			{ name: "sqrtPriceX96", type: "uint160" },
			{ name: "tick", type: "int24" },
			{ name: "observationIndex", type: "uint16" },
			{ name: "observationCardinality", type: "uint16" },
			{ name: "observationCardinalityNext", type: "uint16" },
			{ name: "feeProtocol", type: "uint8" },
			{ name: "unlocked", type: "bool" },
		],
	},
	{
		name: "liquidity",
		type: "function",
		stateMutability: "view",
		inputs: [],
		outputs: [{ name: "liquidity", type: "uint128" }],
	},
] as const
