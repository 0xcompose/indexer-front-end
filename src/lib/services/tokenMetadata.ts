import { env } from "$env/dynamic/public"
import type { TokenMetadata } from "$lib/graphql/types"

const publicEnv = () => env as Record<string, string>

/** Same-origin path in dev; must match `TOKEN_METADATA_DEV_PROXY_PATH` in vite.config.ts */
const DEV_PROXY_PATH = "/__token-metadata__"

/** Coalesce concurrent cell queries before firing RPC. */
const BATCH_MS = 24
/** Max unique tokens per HTTP request (JSON-RPC batch). */
const BATCH_CHUNK = 100
/** Flush immediately when this many pending resolves queue up. */
const IMMEDIATE_FLUSH_THRESHOLD = 200

function useTokenMetadataDevProxy(): boolean {
	return (
		import.meta.env.DEV &&
		["true", "1"].includes(
			(
				publicEnv().PUBLIC_TOKEN_METADATA_USE_DEV_PROXY ?? ""
			).toLowerCase(),
		)
	)
}

/** Resolved fetch URL (cross-origin in prod, or dev proxy path when `PUBLIC_TOKEN_METADATA_USE_DEV_PROXY` is set). */
export function getTokenMetadataRpcUrl(): string {
	if (useTokenMetadataDevProxy()) return DEV_PROXY_PATH
	return publicEnv().PUBLIC_TOKEN_METADATA_RPC_URL ?? ""
}

function tokenKey(chainId: number, address: string): string {
	return `${chainId}:${address.toLowerCase()}`
}

function parseResult(entry: {
	result?: unknown
	error?: { message?: string }
}): TokenMetadata {
	if (entry.error) throw new Error(entry.error.message ?? "RPC error")
	const r = entry.result as
		| { name: string; symbol: string; decimals: number }
		| undefined
	if (!r) throw new Error("No result in response")
	const { name, symbol, decimals } = r
	return { name, symbol, decimals }
}

async function fetchTokenMetadataRpcSingle(
	url: string,
	chainId: number,
	address: string,
): Promise<TokenMetadata> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: tokenKey(chainId, address),
			method: "eth_getTokenMetadata",
			params: [chainId, address.toLowerCase()],
		}),
	})
	if (!res.ok) throw new Error(`HTTP ${res.status}`)
	const json = (await res.json()) as {
		error?: { message?: string }
		result?: { name: string; symbol: string; decimals: number }
	}
	return parseResult(json)
}

type Waiter = {
	chainId: number
	address: string
	resolve: (v: TokenMetadata) => void
	reject: (e: unknown) => void
}

const waitQueue: Waiter[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushInFlight = false

function groupWaiters(batch: Waiter[]) {
	const byKey = new Map<
		string,
		{ chainId: number; address: string; waiters: Waiter[] }
	>()
	for (const w of batch) {
		const k = tokenKey(w.chainId, w.address)
		let g = byKey.get(k)
		if (!g) {
			g = {
				chainId: w.chainId,
				address: w.address.toLowerCase(),
				waiters: [],
			}
			byKey.set(k, g)
		}
		g.waiters.push(w)
	}
	return [...byKey.values()]
}

async function fetchMetadataChunk(
	url: string,
	groups: { chainId: number; address: string; waiters: Waiter[] }[],
): Promise<void> {
	const settleAll = (err: unknown) => {
		for (const g of groups) {
			for (const w of g.waiters) w.reject(err)
		}
	}

	if (groups.length === 1) {
		const g = groups[0]!
		try {
			const meta = await fetchTokenMetadataRpcSingle(
				url,
				g.chainId,
				g.address,
			)
			for (const w of g.waiters) w.resolve(meta)
		} catch (e) {
			for (const w of g.waiters) w.reject(e)
		}
		return
	}

	const rpcBody = groups.map((g) => ({
		jsonrpc: "2.0" as const,
		id: tokenKey(g.chainId, g.address),
		method: "eth_getTokenMetadata",
		params: [g.chainId, g.address],
	}))

	let res: Response
	try {
		res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(rpcBody),
		})
	} catch (e) {
		settleAll(e)
		return
	}

	if (!res.ok) {
		settleAll(new Error(`HTTP ${res.status}`))
		return
	}

	let json: unknown
	try {
		json = await res.json()
	} catch (e) {
		settleAll(e)
		return
	}

	if (!Array.isArray(json)) {
		await Promise.all(
			groups.map(async (g) => {
				try {
					const meta = await fetchTokenMetadataRpcSingle(
						url,
						g.chainId,
						g.address,
					)
					for (const w of g.waiters) w.resolve(meta)
				} catch (e) {
					for (const w of g.waiters) w.reject(e)
				}
			}),
		)
		return
	}

	const byId = new Map<string, (typeof json)[number]>()
	for (const entry of json) {
		if (entry && typeof entry === "object" && "id" in entry) {
			byId.set(String((entry as { id: unknown }).id), entry)
		}
	}

	for (const g of groups) {
		const k = tokenKey(g.chainId, g.address)
		const entry = byId.get(k)
		try {
			if (!entry) throw new Error("Missing RPC result")
			const meta = parseResult(entry as Parameters<typeof parseResult>[0])
			for (const w of g.waiters) w.resolve(meta)
		} catch (e) {
			for (const w of g.waiters) w.reject(e)
		}
	}
}

async function flushWaitQueue(): Promise<void> {
	if (flushInFlight) return
	const batch = waitQueue.splice(0)
	if (batch.length === 0) return

	const url = getTokenMetadataRpcUrl()
	if (!url) {
		const err = new Error("TOKEN_METADATA_RPC_URL not configured")
		for (const w of batch) w.reject(err)
		if (waitQueue.length > 0) void flushWaitQueue()
		return
	}

	flushInFlight = true
	const groups = groupWaiters(batch)
	try {
		for (let i = 0; i < groups.length; i += BATCH_CHUNK) {
			const chunk = groups.slice(i, i + BATCH_CHUNK)
			await fetchMetadataChunk(url, chunk)
		}
	} finally {
		flushInFlight = false
		if (waitQueue.length > 0) void flushWaitQueue()
	}
}

function scheduleDebouncedFlush() {
	if (flushInFlight) return
	if (!flushTimer) {
		flushTimer = setTimeout(() => {
			flushTimer = null
			void flushWaitQueue()
		}, BATCH_MS)
	}
}

/**
 * Fetches token metadata, coalescing concurrent calls into JSON-RPC batch requests.
 */
export function fetchTokenMetadata(
	chainId: number,
	address: string,
): Promise<TokenMetadata> {
	return new Promise((resolve, reject) => {
		waitQueue.push({ chainId, address, resolve, reject })
		if (waitQueue.length >= IMMEDIATE_FLUSH_THRESHOLD) {
			if (flushTimer) {
				clearTimeout(flushTimer)
				flushTimer = null
			}
			void flushWaitQueue()
		} else {
			scheduleDebouncedFlush()
		}
	})
}
