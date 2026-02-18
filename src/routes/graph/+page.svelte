<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query"
	import { gqlClient } from "$lib/graphql/client"
	import { GRAPH_SEED_TOKENS } from "$lib/graphql/queries"
	import { chainStore } from "$lib/stores/chain.svelte"
	import { CHAINS } from "$lib/graphql/types"
	import { browser } from "$app/environment"

	const SEED_LIMIT = 50

	const seedQuery = createQuery(() => ({
		queryKey: ["graph-seed", chainStore.selected],
		queryFn: () =>
			gqlClient.request(GRAPH_SEED_TOKENS, {
				chainId: chainStore.selected ?? CHAINS[0].id,
				limit: SEED_LIMIT,
			}),
		enabled: browser,
	}))

	const seedTokens = $derived((seedQuery.data as any)?.Token ?? [])

	let hoveredAddress = $state<string | null>(null)
</script>

<div class="relative flex h-full flex-col">
	<div
		class="flex items-center gap-4 border-b px-4 py-2"
		style="background: var(--color-surface); border-color: var(--color-border);"
	>
		<span class="text-sm font-semibold" style="color: var(--color-text);"
			>Token Network Graph</span
		>
		<span class="text-xs" style="color: var(--color-muted);">
			{#if seedQuery.isLoading}
				Loading seed tokens…
			{:else}
				{seedTokens.length} seed tokens · Click a node to expand
			{/if}
		</span>
		{#if hoveredAddress}
			<span
				class="ml-auto font-mono text-xs"
				style="color: var(--color-accent);"
			>
				{hoveredAddress}
			</span>
		{/if}
	</div>

	<div class="relative flex-1 overflow-hidden">
		{#if seedQuery.isError}
			<div class="flex h-full items-center justify-center">
				<p class="text-sm text-red-400">
					Failed to load graph data. Is the indexer running?
				</p>
			</div>
		{:else if seedQuery.isLoading}
			<div class="flex h-full items-center justify-center">
				<p class="text-sm" style="color: var(--color-muted);">
					Loading graph…
				</p>
			</div>
		{:else if seedTokens.length === 0}
			<div class="flex h-full items-center justify-center">
				<p class="text-sm" style="color: var(--color-muted);">
					No tokens found for this chain.
				</p>
			</div>
		{:else}
			{#await import("$lib/components/graph/TokenGraph.svelte") then { default: TokenGraph }}
				<TokenGraph
					{seedTokens}
					onNodeHover={(addr) => (hoveredAddress = addr)}
				/>
			{/await}
		{/if}

		<div
			class="absolute bottom-4 left-4 rounded-lg border p-3 text-xs"
			style="background: var(--color-surface); border-color: var(--color-border);"
		>
			<div class="mb-1.5 font-semibold" style="color: var(--color-text);">
				Legend
			</div>
			<div class="flex flex-col gap-1">
				<div class="flex items-center gap-2">
					<span
						class="h-3 w-3 rounded-full"
						style="background: #58a6ff;"
					></span>
					<span style="color: var(--color-muted);">Seed token</span>
				</div>
				<div class="flex items-center gap-2">
					<span
						class="h-3 w-3 rounded-full"
						style="background: #e040fb;"
					></span>
					<span style="color: var(--color-muted);"
						>Expanded token</span
					>
				</div>
				<div class="flex items-center gap-2">
					<span
						class="h-3 w-3 rounded-full"
						style="background: #f0b90b;"
					></span>
					<span style="color: var(--color-muted);">Selected node</span
					>
				</div>
			</div>
			<div
				class="mt-2 border-t pt-2"
				style="border-color: var(--color-border); color: var(--color-muted);"
			>
				Node size = pool count<br />
				Click = expand neighbors
			</div>
		</div>
	</div>
</div>
