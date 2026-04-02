<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query"
	import {
		fetchTokenMetadata,
		TOKEN_METADATA_RPC_URL,
	} from "$lib/services/tokenMetadata"

	let {
		chainId,
		address,
		short = true,
	}: { chainId: number; address: string; short?: boolean } = $props()

	let copied = $state(false)
	let timer: ReturnType<typeof setTimeout>

	function shorten(addr: string) {
		if (!addr || addr.length < 12) return addr
		return `${addr.slice(0, 6)}…${addr.slice(-4)}`
	}

	function copy(e: MouseEvent) {
		e.stopPropagation()
		navigator.clipboard.writeText(address)
		copied = true
		clearTimeout(timer)
		timer = setTimeout(() => (copied = false), 1500)
	}

	const metaQuery = createQuery(() => ({
		queryKey: ["token-metadata", chainId, address.toLowerCase()],
		queryFn: () => fetchTokenMetadata(chainId, address),
		enabled: Boolean(TOKEN_METADATA_RPC_URL) && Boolean(address),
		retry: false,
		staleTime: 24 * 60 * 60 * 1000,
	}))

	const meta = $derived(metaQuery.data ?? null)
</script>

<span class="group inline-flex items-center gap-1 font-mono text-xs">
	{#if meta}
		<span style="color: var(--color-text);" class="font-sans not-italic">
			{meta.name} ({meta.symbol})
		</span>
		<span style="color: var(--color-accent);">
			{short ? shorten(address) : address}
		</span>
	{:else}
		<span style="color: var(--color-accent);">
			{short ? shorten(address) : address}
		</span>
	{/if}
	<button
		class="text-[1rem] opacity-0 transition-all duration-150 group-hover:opacity-60 hover:!opacity-100"
		style={copied ? "color: #3fb950; opacity: 1;" : ""}
		onclick={copy}
		title={copied ? "Copied!" : "Copy address"}
	>
		{#if copied}
			<span style="display:inline-block; animation: pop 0.15s ease-out;">✓</span>
		{:else}
			⎘
		{/if}
	</button>
</span>

<style>
	@keyframes pop {
		0% { transform: scale(0.6); opacity: 0; }
		60% { transform: scale(1.3); }
		100% { transform: scale(1); opacity: 1; }
	}
</style>
