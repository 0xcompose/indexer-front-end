<script lang="ts">
	import { page } from "$app/state"
	import { createQuery } from "@tanstack/svelte-query"
	import { gqlClient } from "$lib/graphql/client"
	import { POOL_BY_ID } from "$lib/graphql/queries"
	import type { PoolWithTokens } from "$lib/graphql/types"
	import PageHeader from "$lib/components/ui/PageHeader.svelte"
	import PoolDetailBody from "$lib/components/pools/PoolDetailBody.svelte"

	const poolId = $derived(decodeURIComponent(page.params.id ?? ""))

	const poolQuery = createQuery(() => ({
		queryKey: ["pool-by-id", poolId],
		queryFn: () => gqlClient.request(POOL_BY_ID, { id: poolId }),
		enabled: poolId.length > 0,
	}))

	const pool = $derived(
		(poolQuery.data as { Pool?: PoolWithTokens[] } | undefined)?.Pool?.[0] ??
			null,
	)
</script>

<div class="p-6">
	<a
		class="mb-4 inline-block text-sm underline-offset-2 hover:underline"
		style="color: var(--color-muted);"
		href="/pools"
	>
		← Pool Explorer
	</a>

	{#if poolQuery.isPending}
		<PageHeader title="Pool" subtitle="Loading…" />
		<p class="text-sm" style="color: var(--color-muted);">Loading pool…</p>
	{:else if poolQuery.isError}
		<PageHeader title="Pool" subtitle="Error" />
		<p class="text-sm text-red-400">Failed to load pool.</p>
	{:else if !pool}
		<PageHeader title="Pool" subtitle="Not found" />
		<p class="text-sm" style="color: var(--color-muted);">
			No pool matches this id.
		</p>
	{:else}
		<PageHeader
			title="Pool"
			subtitle="{pool.protocol} · {pool.address.slice(0, 10)}…"
		/>
		<PoolDetailBody {pool} />
	{/if}
</div>
