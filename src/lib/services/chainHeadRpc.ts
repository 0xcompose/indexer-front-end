/**
 * Fetch chain head block via public JSON-RPC (eth_blockNumber).
 * Uses chainlist HTTP RPC URLs; skips non-http(s) endpoints.
 */

export async function fetchEthBlockNumber(
	rpcUrl: string,
	signal?: AbortSignal,
): Promise<bigint> {
	const res = await fetch(rpcUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "eth_blockNumber",
			params: [],
		}),
		signal,
	})
	if (!res.ok) throw new Error(`RPC HTTP ${res.status}`)
	const json = (await res.json()) as {
		result?: string
		error?: { message?: string }
	}
	if (json.error?.message) throw new Error(json.error.message)
	if (json.result == null) throw new Error("No eth_blockNumber result")
	return BigInt(json.result)
}

/** Try URLs in order until one succeeds. */
export async function fetchEthBlockNumberFirstAvailable(
	rpcUrls: string[],
	timeoutMs = 12_000,
): Promise<{ block: bigint; rpcUrl: string }> {
	const httpUrls = rpcUrls.filter(
		(u) => u.startsWith("http://") || u.startsWith("https://"),
	)
	let last: unknown
	for (const rpcUrl of httpUrls) {
		try {
			const ac = new AbortController()
			const t = setTimeout(() => ac.abort(), timeoutMs)
			const block = await fetchEthBlockNumber(rpcUrl, ac.signal)
			clearTimeout(t)
			return { block, rpcUrl }
		} catch (e) {
			last = e
		}
	}
	throw last instanceof Error
		? last
		: new Error("No working HTTP RPC for chain")
}
