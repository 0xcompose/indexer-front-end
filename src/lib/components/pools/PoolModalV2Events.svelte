<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query"
	import { browser } from "$app/environment"
	import { fetchUniswapV2PoolRecentEvents } from "$lib/services/uniswapV2PoolLogs"
	import { chainlistStore } from "$lib/stores/chainlist.svelte"
	import type { PoolWithTokens } from "$lib/graphql/types"

	let { pool, open = false }: { pool: PoolWithTokens | null; open?: boolean } =
		$props()

	function txUrl(chainId: number, txHash: string): string | null {
		const base = chainlistStore.getExplorerUrl(chainId)?.replace(/\/$/, "")
		if (!base) return null
		return `${base}/tx/${txHash}`
	}

	function fmtBlock(s: string): string {
		try {
			return BigInt(s).toLocaleString()
		} catch {
			return s
		}
	}

	const hasHttpRpc = $derived(
		pool ? chainlistStore.getRpcUrls(pool.chainId).length > 0 : false,
	)

	const logsQuery = createQuery(() => ({
		queryKey: ["v2-pool-logs", pool?.id, pool?.createdAtBlock],
		queryFn: () =>
			fetchUniswapV2PoolRecentEvents({
				chainId: pool!.chainId,
				poolAddress: pool!.address,
				createdAtBlock: pool!.createdAtBlock,
				rpcUrls: chainlistStore.getRpcUrls(pool!.chainId),
			}),
		enabled:
			browser &&
			open &&
			pool !== null &&
			pool.protocol === "UniswapV2" &&
			hasHttpRpc,
	}))
</script>

{#if pool?.protocol === "UniswapV2"}
	<div
		class="border-t pt-4"
		style="border-color: var(--color-border);"
	>
		<p
			class="mb-1 text-xs font-medium uppercase"
			style="color: var(--color-muted);"
		>
			Recent swaps & liquidity (RPC)
		</p>
		<p class="mb-3 text-[0.7rem] leading-snug" style="color: var(--color-muted);">
			Latest Mint / Burn / Swap logs from a public RPC (not indexed). Lower bound
			is <code class="text-[0.65rem]">max(createdAtBlock, ~30d floor from block timestamps)</code>
			(RPC probes batched block times until the month boundary; wide scan capped).
			Older pools don’t scan full chain history.
		</p>

		{#if !hasHttpRpc}
			<p class="text-xs" style="color: var(--color-muted);">
				No HTTP RPC in chainlist for this chain — cannot load logs.
			</p>
		{:else if logsQuery.isLoading}
			<p class="text-xs" style="color: var(--color-muted);">Loading logs…</p>
		{:else if logsQuery.isError}
			<p class="text-xs text-red-400">
				{logsQuery.error instanceof Error
					? logsQuery.error.message
					: "Failed to fetch logs"}
			</p>
		{:else if logsQuery.data && logsQuery.data.events.length === 0}
			<p class="text-xs leading-relaxed" style="color: var(--color-muted);">
				No Swap / Mint / Burn in blocks
				<span class="font-mono tabular-nums" style="color: var(--color-text);">
					{fmtBlock(logsQuery.data.scannedFromBlock)}</span
				>
				–
				<span class="font-mono tabular-nums" style="color: var(--color-text);">
					{fmtBlock(logsQuery.data.scannedToBlock)}</span
				>
				(inclusive, chain head at fetch time).
			</p>
		{:else if logsQuery.data}
			<p class="mb-2 font-mono text-[0.7rem] tabular-nums" style="color: var(--color-muted);">
				Scanned blocks {fmtBlock(logsQuery.data.scannedFromBlock)} →
				{fmtBlock(logsQuery.data.scannedToBlock)} (inclusive)
			</p>
			<div class="max-h-56 overflow-y-auto overflow-x-auto rounded border text-xs" style="border-color: var(--color-border);">
				<table class="w-full min-w-[28rem] text-left">
					<thead>
						<tr style="background: var(--color-bg);">
							<th class="px-2 py-1.5 font-medium" style="color: var(--color-muted);"
								>Type</th
							>
							<th class="px-2 py-1.5 font-medium" style="color: var(--color-muted);"
								>Block</th
							>
							<th class="px-2 py-1.5 font-medium" style="color: var(--color-muted);"
								>Summary</th
							>
						</tr>
					</thead>
					<tbody>
						{#each logsQuery.data.events as row (row.transactionHash + String(row.logIndex))}
							<tr style="border-top: 1px solid var(--color-border);">
								<td class="whitespace-nowrap px-2 py-1.5 font-mono" style="color: var(--color-accent);">
									{row.kind}
								</td>
								<td class="whitespace-nowrap px-2 py-1.5 font-mono tabular-nums" style="color: var(--color-text);">
									{BigInt(row.blockNumber).toLocaleString()}
								</td>
								<td class="px-2 py-1.5 font-mono text-[0.65rem]" style="color: var(--color-muted);">
									<div class="break-all">{row.summary}</div>
									{#if txUrl(pool.chainId, row.transactionHash)}
										<a
											href={txUrl(pool.chainId, row.transactionHash)}
											target="_blank"
											rel="noopener noreferrer"
											class="mt-0.5 inline-block text-[0.65rem] underline"
											style="color: var(--color-accent);"
										>
											View tx
										</a>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
{/if}
