<script lang="ts">
	import { untrack } from "svelte"
	import { createQuery } from "@tanstack/svelte-query"
	import { gqlClient } from "$lib/graphql/client"
	import {
		POOLS_LIST_BY_CHAIN,
		POOLS_LIST_BY_CHAIN_AND_PROTOCOL,
		POOLS_LIST_ALL_CHAINS,
		POOLS_LIST_ALL_CHAINS_BY_PROTOCOL,
		POOLS_BY_TOKEN,
		CHAIN_METRICS_BY_CHAIN,
		CHAIN_METRICS_ALL,
		POOLS_PROTOCOL_DISTRIBUTION_BY_CHAIN,
		POOLS_PROTOCOL_DISTRIBUTION_ALL_CHAINS,
	} from "$lib/graphql/queries"
	import { chainStore } from "$lib/stores/chain.svelte"
	import { chainlistStore } from "$lib/stores/chainlist.svelte"
	import type { DexProtocol, PoolWithTokens } from "$lib/graphql/types"
	import ProtocolBadge from "$lib/components/ui/ProtocolBadge.svelte"
	import AddressCell from "$lib/components/ui/AddressCell.svelte"
	import SearchInput from "$lib/components/ui/SearchInput.svelte"
	import LoadMore from "$lib/components/ui/LoadMore.svelte"
	import Modal from "$lib/components/ui/Modal.svelte"
	import PageHeader from "$lib/components/ui/PageHeader.svelte"

	const PAGE_SIZE = 1000

	let search = $state("")
	let tokenFilter = $state("")
	let protocolFilter = $state<DexProtocol | null>(null)
	let offset = $state(0)
	let allPools = $state<PoolWithTokens[]>([])
	let selectedPool = $state<PoolWithTokens | null>(null)
	let modalOpen = $state(false)

	const chainMetricsQuery = createQuery(() => {
		const chainId = chainStore.selected
		const token = tokenFilter.trim()
		if (token.length >= 10) return { queryKey: ["chain-metrics-skip"], queryFn: () => null, enabled: false }
		if (chainId !== null) {
			return {
				queryKey: ["chain-metrics", chainId],
				queryFn: () => gqlClient.request(CHAIN_METRICS_BY_CHAIN, { chainId }),
			}
		}
		return {
			queryKey: ["chain-metrics-all"],
			queryFn: () => gqlClient.request(CHAIN_METRICS_ALL),
		}
	})

	const totalPools = $derived.by(() => {
		if (tokenFilter.trim().length >= 10) return null
		const data = chainMetricsQuery.data as any
		if (!data?.ChainMetrics?.length) return null
		const metrics = data.ChainMetrics
		return metrics.length === 1 ? metrics[0].totalPools : metrics.reduce((s: number, m: any) => s + m.totalPools, 0)
	})

	type DistributionRow = { chainId: number; protocol: DexProtocol; poolCount: number }
	const distributionQuery = createQuery(() => {
		const chainId = chainStore.selected
		if (chainId !== null) {
			return {
				queryKey: ["pools-protocol-distribution", chainId],
				queryFn: () => gqlClient.request(POOLS_PROTOCOL_DISTRIBUTION_BY_CHAIN, { chainId }),
			}
		}
		return {
			queryKey: ["pools-protocol-distribution-all"],
			queryFn: () => gqlClient.request(POOLS_PROTOCOL_DISTRIBUTION_ALL_CHAINS),
		}
	})

	const distributionRows = $derived(
		(distributionQuery.data as { PoolsProtocolDistributionMetrics?: DistributionRow[] })
			?.PoolsProtocolDistributionMetrics ?? [],
	)

	const availableProtocols = $derived.by(() => {
		const byProtocol: Record<string, number> = {}
		for (const row of distributionRows) {
			byProtocol[row.protocol] = (byProtocol[row.protocol] ?? 0) + row.poolCount
		}
		return Object.entries(byProtocol)
			.toSorted(([, a], [, b]) => b - a)
			.map(([p]) => p as DexProtocol)
	})

	const poolsQuery = createQuery(() => {
		const chainId = chainStore.selected
		const token = tokenFilter.trim()
		const proto = protocolFilter

		if (token.length >= 10) {
			return {
				queryKey: ["pools-by-token", token, offset],
				queryFn: () =>
					gqlClient.request(POOLS_BY_TOKEN, {
						tokenAddress: token,
						limit: PAGE_SIZE,
						offset,
					}),
				placeholderData: (prev: unknown) => prev,
			}
		}

		if (chainId !== null && proto !== null) {
			return {
				queryKey: ["pools-chain-protocol", chainId, proto, offset],
				queryFn: () =>
					gqlClient.request(POOLS_LIST_BY_CHAIN_AND_PROTOCOL, {
						chainId,
						protocol: proto,
						limit: PAGE_SIZE,
						offset,
					}),
				placeholderData: (prev: unknown) => prev,
			}
		}

		if (chainId !== null) {
			return {
				queryKey: ["pools-chain", chainId, offset],
				queryFn: () =>
					gqlClient.request(POOLS_LIST_BY_CHAIN, {
						chainId,
						limit: PAGE_SIZE,
						offset,
					}),
				placeholderData: (prev: unknown) => prev,
			}
		}

		if (proto !== null) {
			return {
				queryKey: ["pools-all-protocol", proto, offset],
				queryFn: () =>
					gqlClient.request(POOLS_LIST_ALL_CHAINS_BY_PROTOCOL, {
						protocol: proto,
						limit: PAGE_SIZE,
						offset,
					}),
				placeholderData: (prev: unknown) => prev,
			}
		}

		return {
			queryKey: ["pools-all", offset],
			queryFn: () =>
				gqlClient.request(POOLS_LIST_ALL_CHAINS, {
					limit: PAGE_SIZE,
					offset,
				}),
			placeholderData: (prev: unknown) => prev,
		}
	})

	// Accumulate pages
	$effect(() => {
		const data = poolsQuery.data as any
		if (!data) return
		untrack(() => {
			let incoming: PoolWithTokens[] = []
			if (data.PoolToken) {
				incoming = data.PoolToken.map(
					(pt: any) => pt.pool as PoolWithTokens,
				)
			} else {
				incoming = data.Pool ?? []
			}
			lastPageSize = incoming.length
			if (offset === 0) {
				allPools = incoming
			} else {
				const ids = new Set(allPools.map((p) => p.id))
				allPools = [
					...allPools,
					...incoming.filter((p) => !ids.has(p.id)),
				]
			}
		})
	})

	// Reset on filter/chain change
	$effect(() => {
		chainStore.selected
		protocolFilter
		tokenFilter
		untrack(() => {
			offset = 0
			allPools = []
		})
	})

	// No aggregate available — hasMore is true while last page was full
	let lastPageSize = $state(0)
	const hasMore = $derived(
		lastPageSize >= PAGE_SIZE && tokenFilter.trim().length < 10,
	)

	function loadMore() {
		if (!poolsQuery.isFetching && hasMore) {
			offset += PAGE_SIZE
		}
	}

	const filtered = $derived(
		search
			? allPools.filter((p) =>
					p.address.toLowerCase().includes(search.toLowerCase()),
				)
			: allPools,
	)

	function openPool(pool: PoolWithTokens) {
		selectedPool = pool
		modalOpen = true
	}

	function chainName(id: number) {
		return chainlistStore.getChainName(id)
	}
</script>

<div class="p-6">
	<PageHeader
		title="Pool Explorer"
		subtitle={totalPools != null
			? `${allPools.length.toLocaleString()} of ${totalPools.toLocaleString()} pools${hasMore ? ' loaded' : ''}`
			: `${allPools.length.toLocaleString()}${hasMore ? '+' : ''} pools loaded`}
	/>

	<div class="mb-4 flex flex-wrap gap-3">
		<div class="w-60">
			<SearchInput
				bind:value={search}
				placeholder="Filter by pool address…"
			/>
		</div>
		<div class="w-72">
			<SearchInput
				bind:value={tokenFilter}
				placeholder="Filter by token address…"
			/>
		</div>
		<select
			class="rounded-md border px-2 py-2 text-sm focus:outline-none"
			style="background: var(--color-surface); border-color: var(--color-border); color: var(--color-text);"
			bind:value={protocolFilter}
		>
			<option value={null}>All protocols</option>
			{#each availableProtocols as p}
				<option value={p}>{p}</option>
			{/each}
		</select>
	</div>

	{#if poolsQuery.isError}
		<p class="text-sm text-red-400">
			Failed to load pools. Is the indexer running?
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
							style="color: var(--color-muted);">Address</th
						>
						<th
							class="px-4 py-2 text-left font-medium"
							style="color: var(--color-muted);">Protocol</th
						>
						<th
							class="px-4 py-2 text-left font-medium"
							style="color: var(--color-muted);">Chain</th
						>
						<th
							class="px-4 py-2 text-left font-medium"
							style="color: var(--color-muted);">Tokens</th
						>
					</tr>
				</thead>
				<tbody>
					{#each filtered as pool (pool.id)}
						<tr
							class="cursor-pointer transition-colors hover:bg-white/5"
							style="border-bottom: 1px solid var(--color-border)22;"
							onclick={() => openPool(pool)}
						>
							<td class="px-4 py-2.5"
								><AddressCell address={pool.address} /></td
							>
							<td class="px-4 py-2.5"
								><ProtocolBadge protocol={pool.protocol} /></td
							>
							<td
								class="px-4 py-2.5 text-xs"
								style="color: var(--color-muted);"
							>
								{chainName(pool.chainId)}
							</td>
							<td class="px-4 py-2.5">
								<div class="flex flex-wrap gap-1">
									{#each pool.poolTokens.toSorted((a, b) => a.tokenIndex - b.tokenIndex) as pt}
										<AddressCell
											address={pt.token.address}
										/>
									{/each}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<LoadMore
				loading={poolsQuery.isFetching}
				{hasMore}
				onLoadMore={loadMore}
			/>
		</div>
	{/if}
</div>

<Modal
	open={modalOpen}
	title="Pool details"
	onClose={() => (modalOpen = false)}
>
	{#if selectedPool}
		<div class="flex flex-col gap-4 text-sm">
			<div>
				<p
					class="mb-1 text-xs font-medium uppercase"
					style="color: var(--color-muted);"
				>
					Address
				</p>
				<AddressCell address={selectedPool.address} short={false} />
			</div>
			<div>
				<p
					class="mb-1 text-xs font-medium uppercase"
					style="color: var(--color-muted);"
				>
					Protocol
				</p>
				<ProtocolBadge protocol={selectedPool.protocol} />
			</div>
			<div>
				<p
					class="mb-1 text-xs font-medium uppercase"
					style="color: var(--color-muted);"
				>
					Chain
				</p>
				<span style="color: var(--color-text);"
					>{chainName(selectedPool.chainId)}</span
				>
			</div>
			<div>
				<p
					class="mb-1 text-xs font-medium uppercase"
					style="color: var(--color-muted);"
				>
					Creator Contract
				</p>
				<AddressCell
					address={selectedPool.creatorContract}
					short={false}
				/>
			</div>
			<div>
				<p
					class="mb-2 text-xs font-medium uppercase"
					style="color: var(--color-muted);"
				>
					Tokens
				</p>
				<div class="flex flex-col gap-2">
					{#each selectedPool.poolTokens.toSorted((a, b) => a.tokenIndex - b.tokenIndex) as pt}
						<div
							class="flex items-center gap-3 rounded-md border p-2"
							style="border-color: var(--color-border); background: var(--color-bg);"
						>
							<span
								class="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
								style="background: var(--color-border); color: var(--color-muted);"
							>
								{pt.tokenIndex}
							</span>
							<AddressCell
								address={pt.token.address}
								short={false}
							/>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</Modal>
