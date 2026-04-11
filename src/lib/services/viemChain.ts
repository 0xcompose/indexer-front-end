import { defineChain, type Address } from "viem"

/** Multicall3 canonical address (used by viem multicall on many chains). */
const MULTICALL3_ADDRESS =
	"0xcA11bde05977b3631167028862bE2a173976CA11" as Address

/** Minimal `Chain` for JSON-RPC calls when only `chainId` + URL are known. */
export function chainForRpc(chainId: number, rpcUrl: string) {
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
