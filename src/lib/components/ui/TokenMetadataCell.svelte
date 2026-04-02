<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query"
	import {
		fetchTokenMetadata,
		getTokenMetadataRpcUrl,
	} from "$lib/services/tokenMetadata"

	let {
		chainId,
		address,
	}: { chainId: number; address: string } = $props()

	const metaQuery = createQuery(() => ({
		queryKey: ["token-metadata", chainId, address.toLowerCase()],
		queryFn: () => fetchTokenMetadata(chainId, address),
		enabled: Boolean(getTokenMetadataRpcUrl()) && Boolean(address),
		retry: false,
		staleTime: 24 * 60 * 60 * 1000,
	}))

	const meta = $derived(metaQuery.data ?? null)
</script>

{#if meta}
	<span style="color: var(--color-text);">{meta.name} ({meta.symbol})</span>
{:else}
	<span style="color: var(--color-muted);">-</span>
{/if}
