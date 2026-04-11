import type { PoolWithTokens } from "$lib/graphql/types"

export function tokenIndexerPoolCount(token: {
	poolCount?: number | null
}): number {
	const n = token.poolCount
	if (n == null) return 0
	return typeof n === "number" && Number.isFinite(n) ? n : Number(n) || 0
}

function tokenPoolCounts(pool: PoolWithTokens): number[] {
	return pool.poolTokens.map((pt) => tokenIndexerPoolCount(pt.token))
}

/** Smallest indexer `poolCount` among tokens (bottleneck for “obscure leg”). */
export function poolMinTokenPoolCount(pool: PoolWithTokens): number {
	const c = tokenPoolCounts(pool)
	if (!c.length) return 0
	return Math.min(...c)
}

/**
 * Sum of log1p(poolCount) per token — favors pools whose tokens appear in many
 * pools (hub / routing tokens). Cheap indexer signal; not TVL or swap volume.
 */
export function poolConnectivityScore(pool: PoolWithTokens): number {
	let s = 0
	for (const n of tokenPoolCounts(pool)) s += Math.log1p(Math.max(0, n))
	return s
}

export function formatCompactInt(n: number): string {
	if (!Number.isFinite(n) || n < 0) return "0"
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
	if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
	return String(Math.round(n))
}
