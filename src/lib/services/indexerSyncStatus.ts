import { gqlClient } from "$lib/graphql/client"
import { CHAIN_METRICS_ALL, CHAINS_QUERY } from "$lib/graphql/queries"
import { chainlistStore } from "$lib/stores/chainlist.svelte"
import { fetchEthBlockNumberFirstAvailable } from "./chainHeadRpc"

export type ChainSyncRow = {
	chainId: number
	name: string
	totalPools: number
	totalTokens: number
	/** `progressBlock` from GraphQL `_meta` (decimal string); null if absent */
	indexedBlock: string | null
	/** Chain head from public RPC (decimal string); null if RPC failed */
	headBlock: string | null
	headError: string | null
}

function progressToString(v: unknown): string | null {
	if (v == null || v === "") return null
	if (typeof v === "bigint") return v.toString()
	if (typeof v === "number" && Number.isFinite(v))
		return Math.trunc(v).toString()
	return String(v)
}

/**
 * Full status snapshot: `_meta.progressBlock` per chain vs public RPC head.
 */
export async function fetchIndexerSyncStatus(): Promise<ChainSyncRow[]> {
	await chainlistStore.load()

	const [{ _meta: metaRows }, metricsData] = await Promise.all([
		gqlClient.request<{
			_meta: Array<{ chainId: number; progressBlock?: unknown }>
		}>(CHAINS_QUERY),
		gqlClient.request<{
			ChainMetrics: Array<{
				chainId: number
				totalPools: number
				totalTokens: number
			}>
		}>(CHAIN_METRICS_ALL),
	])

	const metricsByChain = new Map(
		(metricsData.ChainMetrics ?? []).map((m) => [m.chainId, m]),
	)

	const progressByChain = new Map(
		(metaRows ?? []).map((m) => [
			m.chainId,
			progressToString(m.progressBlock),
		]),
	)

	const chainIds = [
		...new Set((metaRows ?? []).map((m) => m.chainId)),
	].toSorted((a, b) => a - b)

	return Promise.all(
		chainIds.map(async (chainId) => {
			const m = metricsByChain.get(chainId)
			const name = chainlistStore.getChainName(chainId)
			const rpcs = chainlistStore.getRpcUrls(chainId)

			let headBlock: string | null = null
			let headError: string | null = null
			try {
				const { block } = await fetchEthBlockNumberFirstAvailable(rpcs)
				headBlock = block.toString()
			} catch (e) {
				headError = e instanceof Error ? e.message : "RPC failed"
			}

			return {
				chainId,
				name,
				totalPools: m?.totalPools ?? 0,
				totalTokens: m?.totalTokens ?? 0,
				indexedBlock: progressByChain.get(chainId) ?? null,
				headBlock,
				headError,
			} satisfies ChainSyncRow
		}),
	)
}

/** Percent of chain head indexed (0–100), or null if unknown. */
export function syncProgressPercent(row: ChainSyncRow): number | null {
	if (row.indexedBlock == null || row.headBlock == null) return null
	const i = BigInt(row.indexedBlock)
	const h = BigInt(row.headBlock)
	if (h <= 0n) return null
	const pct = Number((i * 10000n) / h) / 100
	return Math.min(100, Math.max(0, pct))
}
