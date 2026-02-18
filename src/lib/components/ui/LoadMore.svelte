<script lang="ts">
	import { onMount } from "svelte"

	let {
		loading = false,
		hasMore = true,
		onLoadMore,
	}: {
		loading?: boolean
		hasMore?: boolean
		onLoadMore: () => void
	} = $props()

	let sentinel: HTMLDivElement | undefined = $state()

	onMount(() => {
		if (!sentinel) return
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loading) {
					onLoadMore()
				}
			},
			{ rootMargin: "200px" },
		)
		observer.observe(sentinel)
		return () => observer.disconnect()
	})
</script>

<div bind:this={sentinel} class="flex items-center justify-center py-4">
	{#if loading}
		<span class="text-sm" style="color: var(--color-muted);">Loading…</span>
	{:else if !hasMore}
		<span class="text-xs" style="color: var(--color-muted);"
			>End of results</span
		>
	{/if}
</div>
