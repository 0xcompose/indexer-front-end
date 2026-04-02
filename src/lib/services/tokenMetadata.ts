import { env } from "$env/dynamic/public"
import type { TokenMetadata } from "$lib/graphql/types"

export const TOKEN_METADATA_RPC_URL: string =
	(env as Record<string, string>).PUBLIC_TOKEN_METADATA_RPC_URL ?? ""

export async function fetchTokenMetadata(
	chainId: number,
	address: string,
): Promise<TokenMetadata> {
	const url = TOKEN_METADATA_RPC_URL
	if (!url) throw new Error("TOKEN_METADATA_RPC_URL not configured")

	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: `${chainId}-${address.toLowerCase()}`,
			method: "eth_getTokenMetadata",
			params: [chainId, address.toLowerCase()],
		}),
	})

	if (!res.ok) throw new Error(`HTTP ${res.status}`)

	const json = await res.json()
	if (json.error) throw new Error(json.error.message ?? "RPC error")
	if (!json.result) throw new Error("No result in response")

	const { name, symbol, decimals } = json.result
	return { name, symbol, decimals }
}
