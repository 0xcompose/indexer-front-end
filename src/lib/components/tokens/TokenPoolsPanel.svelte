<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query"
	import { gqlClient } from "$lib/graphql/client"
	import { TOKEN_POOLS } from "$lib/graphql/queries"
	import { chainlistStore } from "$lib/stores/chainlist.svelte"
	import AddressCell from "$lib/components/ui/AddressCell.svelte"
	import TokenAddressCell from "$lib/components/ui/TokenAddressCell.svelte"
	import ProtocolBadge from "$lib/components/ui/ProtocolBadge.svelte"
	import type {
		Token,
		PoolWithTokens,
		TokenMetadata,
	} from "$lib/graphql/types"
	import { fetchTokenMetadata } from "$lib/services/tokenMetadata"
	import {
		shouldSkipPoolReserves,
		fetchTokenBalanceOfHoldersMulticall,
		formatTokenAmount,
	} from "$lib/services/poolTokenBalances"

	type PoolTokenInPool = PoolWithTokens["poolTokens"][number]

	let { token }: { token: Token } = $props()

	const tokenPoolsQuery = createQuery(() => ({
		queryKey: ["token-pools", token.id],
		queryFn: () =>
			gqlClient.request(TOKEN_POOLS, {
				tokenId: token.id,
				limit: 50,
				offset: 0,
			}),
	}))

	const tokenPools = $derived.by((): PoolWithTokens[] => {
		const rows = (
			tokenPoolsQuery.data as { PoolToken?: { pool: PoolWithTokens }[] }
		)?.PoolToken
		return (rows ?? []).map((pt) => pt.pool)
	})

	const poolReservesQueryFingerprint = $derived.by(() =>
		tokenPools
			.map((p) => {
				const toks = [...p.poolTokens]
					.toSorted(
						(a: PoolTokenInPool, b: PoolTokenInPool) =>
							a.tokenIndex - b.tokenIndex,
					)
					.map((pt) => pt.token.address.toLowerCase())
					.join(",")
				return `${p.address.toLowerCase()}:${p.protocol}:${toks}`
			})
			.toSorted(),
	)

	const poolReservesEligibleCount = $derived(
		tokenPools.filter((p) => !shouldSkipPoolReserves(p.protocol)).length,
	)

	const poolBalancesQuery = createQuery(() => {
		const fingerprint = poolReservesQueryFingerprint.join("|")
		const pools = tokenPools
		const poolsReady =
			!tokenPoolsQuery.isLoading && tokenPoolsQuery.isSuccess
		const eligibleCount = poolReservesEligibleCount

		return {
			queryKey: ["pool-token-balances", token.id, fingerprint] as const,
			queryFn: async () => {
				const rpcs = chainlistStore.getRpcUrls(token.chainId)
				if (!rpcs.length)
					throw new Error("No RPC URL for this chain in chainlist")

				const eligible = pools.filter(
					(p) => !shouldSkipPoolReserves(p.protocol),
				)
				if (eligible.length === 0) {
					return {
						metaByToken: new Map<string, TokenMetadata>(),
						balancesByPool: new Map<string, Map<string, bigint>>(),
					}
				}

				const tokenAddrsLower = new Set<string>()
				for (const p of eligible) {
					for (const pt of p.poolTokens) {
						tokenAddrsLower.add(pt.token.address.toLowerCase())
					}
				}

				const metaByToken = new Map<string, TokenMetadata>()
				await Promise.all(
					[...tokenAddrsLower].map(async (low) => {
						const sample =
							eligible
								.flatMap((p) => p.poolTokens)
								.find(
									(pt) =>
										pt.token.address.toLowerCase() === low,
								)?.token.address ?? low
						const meta = await fetchTokenMetadata(
							token.chainId,
							sample,
						)
						metaByToken.set(low, meta)
					}),
				)

				const calls = eligible.flatMap((p) =>
					[...p.poolTokens]
						.toSorted(
							(a: PoolTokenInPool, b: PoolTokenInPool) =>
								a.tokenIndex - b.tokenIndex,
						)
						.map((pt) => ({
							tokenAddress: pt.token.address,
							holderAddress: p.address,
						})),
				)

				const flat = await fetchTokenBalanceOfHoldersMulticall(
					token.chainId,
					rpcs,
					calls,
				)

				const balancesByPool = new Map<string, Map<string, bigint>>()
				let i = 0
				for (const p of eligible) {
					const pk = p.address.toLowerCase()
					let inner = balancesByPool.get(pk)
					if (!inner) {
						inner = new Map()
						balancesByPool.set(pk, inner)
					}
					const sorted = [...p.poolTokens].toSorted(
						(a: PoolTokenInPool, b: PoolTokenInPool) =>
							a.tokenIndex - b.tokenIndex,
					)
					for (const pt of sorted) {
						const bal = flat[i++]
						if (bal !== null)
							inner.set(pt.token.address.toLowerCase(), bal)
					}
				}

				return { metaByToken, balancesByPool }
			},
			enabled: poolsReady && eligibleCount > 0,
			staleTime: 15_000,
		}
	})

	const tokenPoolsSortedByReserve = $derived.by((): PoolWithTokens[] => {
		const pools = tokenPools
		const tokenLower = token.address.toLowerCase()
		const data = poolBalancesQuery.data

		const reserveFor = (p: PoolWithTokens): bigint | undefined => {
			if (shouldSkipPoolReserves(p.protocol)) return undefined
			return data?.balancesByPool
				.get(p.address.toLowerCase())
				?.get(tokenLower)
		}

		return [...pools]
			.map((p, i) => ({ p, i }))
			.toSorted((x, y) => {
				const rx = reserveFor(x.p)
				const ry = reserveFor(y.p)
				if (rx !== undefined && ry !== undefined) {
					if (ry > rx) return 1
					if (ry < rx) return -1
					return x.i - y.i
				}
				if (rx !== undefined) return -1
				if (ry !== undefined) return 1
				return x.i - y.i
			})
			.map(({ p }) => p)
	})
</script>

{#if tokenPoolsQuery.isLoading}
	<p class="text-sm" style="color: var(--color-muted);">Loading pools…</p>
{:else if tokenPools.length === 0}
	<p class="text-sm" style="color: var(--color-muted);">
		No pools found for this token.
	</p>
{:else}
	<p class="mb-3 text-xs" style="color: var(--color-muted);">
		{tokenPools.length} pools shown
	</p>
	<div class="flex flex-col gap-2">
		{#each tokenPoolsSortedByReserve as pool (pool.id)}
			<div
				class="rounded-lg border p-3"
				style="border-color: var(--color-border); background: var(--color-bg);"
			>
				<div class="mb-1 flex flex-wrap items-start gap-2">
					<AddressCell address={pool.address} short={false} />
					<a
						class="text-xs underline-offset-2 hover:underline"
						style="color: var(--color-muted);"
						href={`/pools/${encodeURIComponent(pool.id)}`}
					>
						Pool page
					</a>
					<ProtocolBadge protocol={pool.protocol} />
					<div
						class="ml-auto flex flex-col items-end gap-0.5 text-xs tabular-nums"
						style="color: var(--color-muted);"
					>
						{#if shouldSkipPoolReserves(pool.protocol)}
							<span
								title="ERC20 balanceOf the pool address is skipped for Balancer, Uniswap v4, and PancakeSwap Infinity (vault or singleton architecture)."
								>N/A</span
							>
						{:else if poolBalancesQuery.isPending}
							<span>Reserves…</span>
						{:else if poolBalancesQuery.isError}
							<span>—</span>
						{:else if poolBalancesQuery.data}
							{#each pool.poolTokens.toSorted((a: PoolTokenInPool, b: PoolTokenInPool) => a.tokenIndex - b.tokenIndex) as pt}
								{@const meta =
									poolBalancesQuery.data.metaByToken.get(
										pt.token.address.toLowerCase(),
									)}
								{@const bal =
									poolBalancesQuery.data.balancesByPool
										.get(pool.address.toLowerCase())
										?.get(pt.token.address.toLowerCase())}
								<span
									title="{meta?.symbol ?? 'token'} balance held by pool"
								>
									{#if meta === undefined || bal === undefined}
										—
									{:else}
										{formatTokenAmount(bal, meta.decimals)}
										{meta.symbol}
									{/if}
								</span>
							{/each}
						{:else}
							<span>—</span>
						{/if}
					</div>
				</div>
				<div class="flex flex-wrap gap-1">
					{#each pool.poolTokens.toSorted((a: PoolTokenInPool, b: PoolTokenInPool) => a.tokenIndex - b.tokenIndex) as pt (pt.token.id)}
						<TokenAddressCell
							chainId={pt.token.chainId}
							address={pt.token.address}
						/>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
