<script lang="ts">
	import { untrack } from "svelte"
	import { createQuery } from "@tanstack/svelte-query"
	import { gqlClient } from "$lib/graphql/client"
	import {
		TOKENS_LIST,
		TOKENS_LIST_ALL_CHAINS,
		TOKEN_POOLS,
		CHAIN_METRICS_BY_CHAIN,
		CHAIN_METRICS_ALL,
	} from "$lib/graphql/queries"
	import { chainStore } from "$lib/stores/chain.svelte"
	import { chainlistStore } from "$lib/stores/chainlist.svelte"
	import SearchInput from "$lib/components/ui/SearchInput.svelte"
	import AddressCell from "$lib/components/ui/AddressCell.svelte"
	import TokenAddressCell from "$lib/components/ui/TokenAddressCell.svelte"
	import TokenMetadataCell from "$lib/components/ui/TokenMetadataCell.svelte"
	import ProtocolBadge from "$lib/components/ui/ProtocolBadge.svelte"
	import LoadMore from "$lib/components/ui/LoadMore.svelte"
	import Modal from "$lib/components/ui/Modal.svelte"
	import PageHeader from "$lib/components/ui/PageHeader.svelte"
	import type {
		Token,
		PoolWithTokens,
		TokenMetadata,
	} from "$lib/graphql/types"

	type PoolTokenInPool = PoolWithTokens["poolTokens"][number]
	import { fetchTokenMetadata } from "$lib/services/tokenMetadata"
	import {
		shouldSkipPoolReserves,
		fetchTokenBalanceOfHoldersMulticall,
		formatTokenAmount,
	} from "$lib/services/poolTokenBalances"

	const PAGE_SIZE = 200

	let search = $state("")
	let offset = $state(0)
	let allTokens = $state<Token[]>([])
	let selectedToken = $state<Token | null>(null)
	let modalOpen = $state(false)

	const chainMetricsQuery = createQuery(() =>
		chainStore.selected !== null
			? {
					queryKey: ["chain-metrics", chainStore.selected],
					queryFn: () =>
						gqlClient.request(CHAIN_METRICS_BY_CHAIN, {
							chainId: chainStore.selected!,
						}),
				}
			: {
					queryKey: ["chain-metrics-all"],
					queryFn: () => gqlClient.request(CHAIN_METRICS_ALL),
				},
	)

	const totalTokens = $derived.by(() => {
		const data = chainMetricsQuery.data as any
		if (!data?.ChainMetrics?.length) return null
		const metrics = data.ChainMetrics
		return metrics.length === 1
			? metrics[0].totalTokens
			: metrics.reduce((s: number, m: any) => s + m.totalTokens, 0)
	})

	const tokensQuery = createQuery(() => ({
		queryKey: ["tokens", chainStore.selected, offset],
		queryFn: () =>
			chainStore.selected !== null
				? gqlClient.request(TOKENS_LIST, {
						chainId: chainStore.selected,
						limit: PAGE_SIZE,
						offset,
					})
				: gqlClient.request(TOKENS_LIST_ALL_CHAINS, {
						limit: PAGE_SIZE,
						offset,
					}),
	}))

	// Reset offset and list when chain changes only (not on mount) to avoid clearing during quick nav
	let prevChain = $state<number | null | undefined>(undefined)
	$effect(() => {
		const current = chainStore.selected
		const prev = prevChain
		prevChain = current
		if (prev !== undefined && prev !== current) {
			untrack(() => {
				offset = 0
				allTokens = []
			})
		}
	})

	// Accumulate pages — drive allTokens only from query data so no race with reset
	let lastPageSize = $state(0)
	$effect(() => {
		const data = tokensQuery.data as { Token?: Token[] } | undefined
		const currentOffset = offset
		if (currentOffset === 0) {
			const incoming: Token[] = data?.Token ?? []
			untrack(() => {
				lastPageSize = incoming.length
				allTokens = incoming
			})
		} else if (data?.Token?.length) {
			const incoming: Token[] = data.Token
			untrack(() => {
				lastPageSize = incoming.length
				const existingIds = new Set(allTokens.map((t) => t.id))
				allTokens = [
					...allTokens,
					...incoming.filter((t) => !existingIds.has(t.id)),
				]
			})
		}
	})

	// No aggregate available — hasMore is true while last page was full
	const hasMore = $derived(lastPageSize >= PAGE_SIZE)

	function loadMore() {
		if (!tokensQuery.isFetching && hasMore) {
			offset += PAGE_SIZE
		}
	}

	const filtered = $derived(
		search
			? allTokens.filter((t) =>
					t.address.toLowerCase().includes(search.toLowerCase()),
				)
			: allTokens,
	)

	// Token pools modal
	const tokenPoolsQuery = createQuery(() => ({
		queryKey: ["token-pools", selectedToken?.id],
		queryFn: () =>
			gqlClient.request(TOKEN_POOLS, {
				tokenId: selectedToken!.id,
				limit: 50,
				offset: 0,
			}),
		enabled: selectedToken !== null,
	}))

	const tokenPools = $derived.by((): PoolWithTokens[] => {
		const rows = (
			tokenPoolsQuery.data as { PoolToken?: { pool: PoolWithTokens }[] }
		)?.PoolToken
		return (rows ?? []).map((pt) => pt.pool)
	})

	/** Descending by this token's reserve in the pool; N/A / unknown keeps list order stable until data arrives. */
	const tokenPoolsSortedByModalTokenReserve = $derived.by((): PoolWithTokens[] => {
		const pools = tokenPools
		const token = selectedToken
		if (!token || pools.length === 0) return pools

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
		const token = selectedToken
		const open = modalOpen
		const fingerprint = poolReservesQueryFingerprint.join("|")
		const pools = tokenPools
		const poolsReady =
			!tokenPoolsQuery.isLoading && tokenPoolsQuery.isSuccess
		const eligibleCount = poolReservesEligibleCount

		return {
			queryKey: ["pool-token-balances", token?.id, fingerprint] as const,
			queryFn: async () => {
				if (!token) throw new Error("no token")
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
			enabled: open && token !== null && poolsReady && eligibleCount > 0,
			staleTime: 15_000,
		}
	})

	function openToken(token: Token) {
		selectedToken = token
		modalOpen = true
	}

	function chainName(id: number) {
		return chainlistStore.getChainName(id)
	}
</script>

<div class="p-6">
	<PageHeader
		title="Token Explorer"
		subtitle={totalTokens != null
			? `${allTokens.length.toLocaleString()} of ${totalTokens.toLocaleString()} tokens${hasMore ? " loaded" : ""}`
			: `${allTokens.length.toLocaleString()}${hasMore ? "+" : ""} tokens loaded`}
	/>

	<div class="mb-4 max-w-sm">
		<SearchInput bind:value={search} placeholder="Filter by address…" />
	</div>

	{#if tokensQuery.isError}
		<p class="text-sm text-red-400">
			Failed to load tokens. Is the indexer running?
		</p>
	{:else}
		<div
			class="overflow-hidden rounded-lg border"
			style="background: var(--color-surface); border-color: var(--color-border);"
		>
			<table class="w-full text-sm">
				<thead>
					<tr style="border-bottom: 1px solid var(--color-border);">
						<th
							class="px-4 py-2 text-left font-medium"
							style="color: var(--color-muted);">Metadata</th
						>
						<th
							class="px-4 py-2 text-left font-medium"
							style="color: var(--color-muted);">Address</th
						>
						<th
							class="px-4 py-2 text-left font-medium"
							style="color: var(--color-muted);">Chain</th
						>
						<th
							class="px-4 py-2 text-right font-medium"
							style="color: var(--color-muted);">Pools</th
						>
						<th
							class="px-4 py-2 text-right font-medium"
							style="color: var(--color-muted);">ID</th
						>
					</tr>
				</thead>
				<tbody>
					{#each filtered as token (token.id)}
						<tr
							class="cursor-pointer transition-colors hover:bg-white/5"
							style="border-bottom: 1px solid var(--color-border)22;"
							onclick={() => openToken(token)}
						>
							<td class="px-4 py-2.5 text-sm"
								><TokenMetadataCell
									chainId={token.chainId}
									address={token.address}
								/></td
							>
							<td class="px-4 py-2.5"
								><AddressCell address={token.address} /></td
							>
							<td
								class="px-4 py-2.5 text-xs"
								style="color: var(--color-muted);"
							>
								{chainName(token.chainId)}
							</td>
							<td
								class="px-4 py-2.5 text-right tabular-nums"
								style="color: var(--color-muted);"
							>
								{token.poolCount.toLocaleString()}
							</td>
							<td
								class="px-4 py-2.5 text-right font-mono text-xs"
								style="color: var(--color-muted);"
							>
								{token.id}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if !search}
				<LoadMore
					loading={tokensQuery.isFetching}
					{hasMore}
					onLoadMore={loadMore}
				/>
			{/if}
		</div>
	{/if}
</div>

<Modal
	open={modalOpen}
	title="Pools for {selectedToken?.address ?? ''}"
	onClose={() => (modalOpen = false)}
>
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
			{#each tokenPoolsSortedByModalTokenReserve as pool}
				<div
					class="rounded-lg border p-3"
					style="border-color: var(--color-border); background: var(--color-bg);"
				>
					<div class="mb-1 flex flex-wrap items-start gap-2">
						<AddressCell address={pool.address} short={false} />
						<ProtocolBadge protocol={pool.protocol} />
						<div
							class="ml-auto flex flex-col items-end gap-0.5 text-xs tabular-nums"
							style="color: var(--color-muted);"
						>
							{#if shouldSkipPoolReserves(pool.protocol)}
								<span
									title="ERC20 balanceOf the pool address is skipped for Balancer, Uniswap v4, and PancakeSwap Infinity (vault or singleton architecture)."
								>N/A</span>
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
											?.get(
												pt.token.address.toLowerCase(),
											)}
									<span
										title="{meta?.symbol ??
											'token'} balance held by pool"
									>
										{#if meta === undefined || bal === undefined}
											—
										{:else}
											{formatTokenAmount(
												bal,
												meta.decimals,
											)}
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
						{#each pool.poolTokens.toSorted((a: PoolTokenInPool, b: PoolTokenInPool) => a.tokenIndex - b.tokenIndex) as pt}
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
</Modal>
