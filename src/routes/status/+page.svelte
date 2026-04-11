<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query"
	import { browser } from "$app/environment"
	import PageHeader from "$lib/components/ui/PageHeader.svelte"
	import {
		fetchIndexerSyncStatus,
		syncProgressPercent,
	} from "$lib/services/indexerSyncStatus"

	const POLL_MS = 15_000
	const headerSubtitle = `Per-chain sync vs public RPC head · refreshes every ${POLL_MS / 1000}s`

	const statusQuery = createQuery(() => ({
		queryKey: ["indexer-sync-status"],
		queryFn: fetchIndexerSyncStatus,
		enabled: browser,
		refetchInterval: POLL_MS,
		staleTime: 10_000,
	}))

	const rows = $derived(statusQuery.data ?? [])

	function formatBlocks(n: string | null) {
		if (n == null) return "—"
		return BigInt(n).toLocaleString()
	}
</script>

<div class="flex min-h-0 min-w-0 flex-1 flex-col gap-6 p-6">
	<PageHeader title="Indexer status" subtitle={headerSubtitle} />

	{#if statusQuery.isLoading}
		<p class="text-sm" style="color: var(--color-muted);">Loading status…</p>
	{:else if statusQuery.isError}
		<p class="text-sm text-red-400">
			Failed to load status. Is the indexer GraphQL up?
		</p>
	{:else if rows.length === 0}
		<p class="text-sm" style="color: var(--color-muted);">
			No chains in <code class="text-xs">_meta</code>.
		</p>
	{:else}
		<div
			class="min-w-0 overflow-x-auto rounded-lg border"
			style="border-color: var(--color-border); background: var(--color-surface); -webkit-overflow-scrolling: touch;"
		>
			<table class="w-full min-w-[44rem] text-sm">
				<thead>
					<tr style="border-bottom: 1px solid var(--color-border);">
						<th
							class="px-4 py-2 text-left font-medium"
							style="color: var(--color-muted);">Chain</th
						>
						<th
							class="px-4 py-2 text-right font-medium"
							style="color: var(--color-muted);">Indexed block</th
						>
						<th
							class="px-4 py-2 text-right font-medium"
							style="color: var(--color-muted);">Chain head</th
						>
						<th
							class="px-4 py-2 text-left font-medium"
							style="color: var(--color-muted);">Progress</th
						>
						<th
							class="px-4 py-2 text-right font-medium"
							style="color: var(--color-muted);">Pools</th
						>
						<th
							class="px-4 py-2 text-right font-medium"
							style="color: var(--color-muted);">Tokens</th
						>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.chainId)}
						{@const pct = syncProgressPercent(row)}
						<tr
							style="border-bottom: 1px solid var(--color-border);"
						>
							<td class="px-4 py-2.5">
								<span style="color: var(--color-text);"
									>{row.name}</span
								>
								<span
									class="ml-1 text-xs tabular-nums"
									style="color: var(--color-muted);"
									>({row.chainId})</span
								>
							</td>
							<td
								class="px-4 py-2.5 text-right font-mono text-xs tabular-nums"
								style="color: var(--color-text);"
							>
								{formatBlocks(row.indexedBlock)}
							</td>
							<td
								class="px-4 py-2.5 text-right font-mono text-xs tabular-nums"
								style="color: var(--color-text);"
							>
								{#if row.headError}
									<span title={row.headError}>—</span>
								{:else}
									{formatBlocks(row.headBlock)}
								{/if}
							</td>
							<td class="px-4 py-2.5">
								{#if pct == null}
									<span style="color: var(--color-muted);">—</span>
								{:else}
									<div class="flex items-center gap-2">
										<div
											class="h-2 flex-1 max-w-[140px] overflow-hidden rounded-full"
											style="background: var(--color-border);"
										>
											<div
												class="h-full rounded-full transition-[width]"
												style="width: {pct}%; background: var(--color-accent);"
											></div>
										</div>
										<span
											class="tabular-nums text-xs"
											style="color: var(--color-muted);">{pct.toFixed(
												1,
											)}%</span
										>
									</div>
								{/if}
							</td>
							<td
								class="px-4 py-2.5 text-right tabular-nums"
								style="color: var(--color-text);"
							>
								{row.totalPools.toLocaleString()}
							</td>
							<td
								class="px-4 py-2.5 text-right tabular-nums"
								style="color: var(--color-text);"
							>
								{row.totalTokens.toLocaleString()}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p
			class="min-w-0 max-w-full text-xs leading-relaxed break-words"
			style="color: var(--color-muted);"
		>
			<strong style="color: var(--color-text);">Indexed block</strong> comes from
			<code class="text-[0.7rem]">_meta.progressBlock</code> per
			<code class="text-[0.7rem]">chainId</code>. <strong
				style="color: var(--color-text);">Chain head</strong> uses the first HTTP RPC
			from chainlist for the chain.
		</p>
	{/if}
</div>
