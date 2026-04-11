<script lang="ts">
	import { page } from "$app/state"
	import { createQuery } from "@tanstack/svelte-query"
	import { gqlClient } from "$lib/graphql/client"
	import { TOKEN_BY_ID } from "$lib/graphql/queries"
	import { chainlistStore } from "$lib/stores/chainlist.svelte"
	import type { Token } from "$lib/graphql/types"
	import PageHeader from "$lib/components/ui/PageHeader.svelte"
	import AddressCell from "$lib/components/ui/AddressCell.svelte"
	import TokenMetadataCell from "$lib/components/ui/TokenMetadataCell.svelte"
	import TokenPoolsPanel from "$lib/components/tokens/TokenPoolsPanel.svelte"

	const tokenId = $derived(decodeURIComponent(page.params.id ?? ""))

	const tokenQuery = createQuery(() => ({
		queryKey: ["token-by-id", tokenId],
		queryFn: () => gqlClient.request(TOKEN_BY_ID, { id: tokenId }),
		enabled: tokenId.length > 0,
	}))

	const token = $derived(
		(tokenQuery.data as { Token?: Token[] } | undefined)?.Token?.[0] ??
			null,
	)

	function chainName(id: number) {
		return chainlistStore.getChainName(id)
	}
</script>

<div class="p-6">
	<a
		class="mb-4 inline-block text-sm underline-offset-2 hover:underline"
		style="color: var(--color-muted);"
		href="/tokens"
	>
		← Token Explorer
	</a>

	{#if tokenQuery.isPending}
		<PageHeader title="Token" subtitle="Loading…" />
		<p class="text-sm" style="color: var(--color-muted);">Loading token…</p>
	{:else if tokenQuery.isError}
		<PageHeader title="Token" subtitle="Error" />
		<p class="text-sm text-red-400">Failed to load token.</p>
	{:else if !token}
		<PageHeader title="Token" subtitle="Not found" />
		<p class="text-sm" style="color: var(--color-muted);">
			No token matches this id.
		</p>
	{:else}
		<PageHeader
			title="Token"
			subtitle="{chainName(token.chainId)} · {token.poolCount.toLocaleString()} pools (indexer)"
		/>

		<div class="mb-6 flex flex-col gap-3 text-sm">
			<div>
				<p
					class="mb-1 text-xs font-medium uppercase"
					style="color: var(--color-muted);"
				>
					Metadata
				</p>
				<TokenMetadataCell
					chainId={token.chainId}
					address={token.address}
				/>
			</div>
			<div>
				<p
					class="mb-1 text-xs font-medium uppercase"
					style="color: var(--color-muted);"
				>
					Address
				</p>
				<AddressCell address={token.address} short={false} />
			</div>
			<div>
				<p
					class="mb-1 text-xs font-medium uppercase"
					style="color: var(--color-muted);"
				>
					ID
				</p>
				<span
					class="font-mono text-xs"
					style="color: var(--color-text);">{token.id}</span
				>
			</div>
		</div>

		<h2
			class="mb-3 text-sm font-medium uppercase"
			style="color: var(--color-muted);"
		>
			Pools
		</h2>
		<TokenPoolsPanel {token} />
	{/if}
</div>
