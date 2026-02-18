/**
 * Fetches and caches chain metadata from https://chainlist.org/rpcs.json
 * Cache TTL: 24 hours (localStorage).
 */

export interface ChainlistRpcEntry {
	url: string
	tracking?: string
	isOpenSource?: boolean
}

export interface ChainlistExplorer {
	name: string
	url: string
	standard?: string
	icon?: string
}

export interface ChainlistNativeCurrency {
	name: string
	symbol: string
	decimals: number
}

export interface ChainlistChain {
	name: string
	chain: string
	chainId: number
	shortName?: string
	rpc?: ChainlistRpcEntry[]
	explorers?: ChainlistExplorer[]
	nativeCurrency?: ChainlistNativeCurrency
	infoURL?: string
	networkId?: number
}

const CHAINLIST_URL = "https://chainlist.org/rpcs.json"
const CACHE_KEY = "chainlist_rpcs"
const CACHE_TS_KEY = "chainlist_rpcs_ts"
const TTL_MS = 24 * 60 * 60 * 1000

function getCached(): ChainlistChain[] | null {
	if (typeof localStorage === "undefined") return null
	try {
		const ts = localStorage.getItem(CACHE_TS_KEY)
		const raw = localStorage.getItem(CACHE_KEY)
		if (!ts || !raw) return null
		if (Date.now() - parseInt(ts, 10) > TTL_MS) return null
		return JSON.parse(raw) as ChainlistChain[]
	} catch {
		return null
	}
}

function setCache(chains: ChainlistChain[]): void {
	if (typeof localStorage === "undefined") return
	try {
		localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
		localStorage.setItem(CACHE_KEY, JSON.stringify(chains))
	} catch {
		// ignore
	}
}

export async function fetchChainlist(): Promise<ChainlistChain[]> {
	const cached = getCached()
	if (cached?.length) return cached

	const res = await fetch(CHAINLIST_URL)
	if (!res.ok) throw new Error(`chainlist fetch failed: ${res.status}`)
	const data = (await res.json()) as ChainlistChain[]
	if (!Array.isArray(data)) throw new Error("chainlist: invalid response")
	setCache(data)
	return data
}
