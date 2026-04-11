import { parseAbi } from "viem"

/** Uniswap V2 Pair — events used for on-demand RPC log reads */
export const uniswapV2PairEventsAbi = parseAbi([
	"event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
	"event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
	"event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)",
])
