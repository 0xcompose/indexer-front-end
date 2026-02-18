<script lang="ts">
	import { untrack } from "svelte"
	import { createQuery } from "@tanstack/svelte-query"
	import { gqlClient } from "$lib/graphql/client"
	import {
		TOKENS_LIST,
		TOKENS_LIST_ALL_CHAINS,
		TOKEN_POOLS,
	} from "$lib/graphql/queries"
	import { chainStore } from "$lib/stores/chain.svelte"
	import { getChainName } from "$lib/graphql/types"
	import SearchInput from "$lib/components/ui/SearchInput.svelte"
	import AddressCell from "$lib/components/ui/AddressCell.svelte"
	import ProtocolBadge from "$lib/components/ui/ProtocolBadge.svelte"
	import LoadMore from "$lib/components/ui/LoadMore.svelte"
	import Modal from "$lib/components/ui/Modal.svelte"
	import PageHeader from "$lib/components/ui/PageHeader.svelte"
	import type { Token, PoolWithTokens } from "$lib/graphql/types"

	const PAGE_SIZE = 1000

	let search = $state("")
	let offset = $state(0)
	let allTokens = $state<Token[]>([])
	let selectedToken = $state<Token | null>(null)
	let modalOpen = $state(false)

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
		placeholderData: (prev: unknown) => prev,
	}))

	// Accumulate pages
	let lastPageSize = $state(0)
	$effect(() => {
		const data = tokensQuery.data as any
		if (!data) return
		const incoming: Token[] = data.Token ?? []
		untrack(() => {
			lastPageSize = incoming.length
			if (offset === 0) {
				allTokens = incoming
			} else {
				const existingIds = new Set(allTokens.map((t) => t.id))
				allTokens = [
					...allTokens,
					...incoming.filter((t) => !existingIds.has(t.id)),
				]
			}
		})
	})

	// Reset on chain change
	$effect(() => {
		chainStore.selected // track
		untrack(() => {
			offset = 0
			allTokens = []
		})
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

	const tokenPools = $derived(
		((tokenPoolsQuery.data as any)?.PoolToken ?? []).map(
			(pt: any) => pt.pool as PoolWithTokens,
		),
	)

	function openToken(token: Token) {
		selectedToken = token
		modalOpen = true
	}

	function chainName(id: number) {
		return getChainName(id)
	}
</script>

<div class="p-6">
	<PageHeader
		title="Token Explorer"
		subtitle="{allTokens.length}{hasMore ? '+' : ''} tokens loaded"
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
							style="color: var(--color-muted);">Address</th
						>
						<th
							class="px-4 py-2 text-left font-medium"
							style="color: var(--color-muted);">Chain</th
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
			{#each tokenPools as pool}
				<div
					class="rounded-lg border p-3"
					style="border-color: var(--color-border); background: var(--color-bg);"
				>
					<div class="mb-1 flex items-center gap-2">
						<AddressCell address={pool.address} short={false} />
						<ProtocolBadge protocol={pool.protocol} />
					</div>
					<div class="flex flex-wrap gap-1">
						{#each pool.poolTokens.toSorted((a, b) => a.tokenIndex - b.tokenIndex) as pt}
							<AddressCell address={pt.token.address} />
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Modal>
