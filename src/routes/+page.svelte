<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query"
	import { gqlClient } from "$lib/graphql/client"
	import { DASHBOARD_STATS, POOLS_BY_PROTOCOL } from "$lib/graphql/queries"
	import { chainStore } from "$lib/stores/chain.svelte"
	import { CHAINS, ALL_PROTOCOLS } from "$lib/graphql/types"
	import StatCard from "$lib/components/ui/StatCard.svelte"
	import PageHeader from "$lib/components/ui/PageHeader.svelte"
	import EChart from "$lib/components/charts/EChart.svelte"
	import type { EChartsOption } from "echarts"

	const PROTOCOL_COLORS: Record<string, string> = {
		UniswapV2: "#ff007a",
		UniswapV3: "#ff69b4",
		UniswapV4: "#e040fb",
		PancakeSwapInfinity: "#1fc7d4",
		AlgebraIntegral: "#f0b90b",
		Curve: "#d62728",
		BalancerV3: "#1e90ff",
	}

	const statsQuery = createQuery(() => ({
		queryKey: ["dashboard-stats", chainStore.selected],
		queryFn: () =>
			gqlClient.request(DASHBOARD_STATS, {
				chainId: chainStore.selected ?? CHAINS[0].id,
			}),
	}))

	const protocolQuery = createQuery(() => ({
		queryKey: ["pools-by-protocol", chainStore.selected],
		queryFn: () =>
			gqlClient.request(POOLS_BY_PROTOCOL, {
				chainId: chainStore.selected ?? CHAINS[0].id,
			}),
	}))

	const totalPools = $derived(
		(statsQuery.data as any)?.Pool_aggregate?.aggregate?.count ?? 0,
	)
	const totalTokens = $derived(
		(statsQuery.data as any)?.Token_aggregate?.aggregate?.count ?? 0,
	)

	const protocolData = $derived(
		ALL_PROTOCOLS.map((p) => ({
			name: p,
			value: (protocolQuery.data as any)?.[p]?.aggregate?.count ?? 0,
		})).filter((d) => d.value > 0),
	)

	const pieOption = $derived<EChartsOption>({
		backgroundColor: "transparent",
		tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
		legend: {
			orient: "vertical",
			right: 10,
			top: "center",
			textStyle: { color: "#8b949e", fontSize: 12 },
		},
		series: [
			{
				type: "pie",
				radius: ["40%", "70%"],
				center: ["35%", "50%"],
				data: protocolData.map((d) => ({
					...d,
					itemStyle: { color: PROTOCOL_COLORS[d.name] ?? "#8b949e" },
				})),
				label: { show: false },
				emphasis: {
					label: { show: true, fontSize: 14, fontWeight: "bold" },
				},
			},
		],
	})

	const barOption = $derived<EChartsOption>({
		backgroundColor: "transparent",
		tooltip: { trigger: "axis" },
		grid: { left: 16, right: 16, top: 8, bottom: 40, containLabel: true },
		xAxis: {
			type: "category",
			data: protocolData.map((d) => d.name),
			axisLabel: { color: "#8b949e", fontSize: 11, rotate: 20 },
			axisLine: { lineStyle: { color: "#30363d" } },
		},
		yAxis: {
			type: "value",
			axisLabel: { color: "#8b949e", fontSize: 11 },
			splitLine: { lineStyle: { color: "#30363d" } },
		},
		series: [
			{
				type: "bar",
				data: protocolData.map((d) => ({
					value: d.value,
					itemStyle: { color: PROTOCOL_COLORS[d.name] ?? "#8b949e" },
				})),
				barMaxWidth: 40,
			},
		],
	})

	function fmt(n: number) {
		return n.toLocaleString()
	}

	const chainLabel = $derived(
		chainStore.selected
			? `Chain: ${CHAINS.find((c) => c.id === chainStore.selected)?.name ?? chainStore.selected}`
			: "All chains",
	)
</script>

<div class="p-6">
	<PageHeader title="Dashboard" subtitle={chainLabel} />

	{#if statsQuery.isLoading}
		<p class="text-sm" style="color: var(--color-muted);">Loading stats…</p>
	{:else if statsQuery.isError}
		<p class="text-sm text-red-400">
			Failed to load stats. Is the indexer running?
		</p>
	{:else}
		<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
			<StatCard label="Total Pools" value={fmt(totalPools)} />
			<StatCard label="Total Tokens" value={fmt(totalTokens)} />
			<StatCard label="Protocols Active" value={protocolData.length} />
			<StatCard
				label="Avg tokens/pool"
				value={totalPools > 0
					? (totalTokens / totalPools).toFixed(2)
					: "—"}
			/>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div
				class="rounded-lg border p-4"
				style="background: var(--color-surface); border-color: var(--color-border);"
			>
				<h2
					class="mb-3 text-sm font-semibold"
					style="color: var(--color-text);"
				>
					Pools by Protocol
				</h2>
				{#if protocolQuery.isLoading}
					<p class="text-sm" style="color: var(--color-muted);">
						Loading…
					</p>
				{:else}
					<EChart option={pieOption} height="260px" />
				{/if}
			</div>

			<div
				class="rounded-lg border p-4"
				style="background: var(--color-surface); border-color: var(--color-border);"
			>
				<h2
					class="mb-3 text-sm font-semibold"
					style="color: var(--color-text);"
				>
					Pool Count per Protocol
				</h2>
				{#if protocolQuery.isLoading}
					<p class="text-sm" style="color: var(--color-muted);">
						Loading…
					</p>
				{:else}
					<EChart option={barOption} height="260px" />
				{/if}
			</div>
		</div>

		{#if protocolData.length > 0}
			<div
				class="mt-6 overflow-hidden rounded-lg border"
				style="background: var(--color-surface); border-color: var(--color-border);"
			>
				<table class="w-full text-sm">
					<thead>
						<tr
							style="border-bottom: 1px solid var(--color-border);"
						>
							<th
								class="px-4 py-2 text-left font-medium"
								style="color: var(--color-muted);">Protocol</th
							>
							<th
								class="px-4 py-2 text-right font-medium"
								style="color: var(--color-muted);">Pools</th
							>
							<th
								class="px-4 py-2 text-right font-medium"
								style="color: var(--color-muted);">Share</th
							>
						</tr>
					</thead>
					<tbody>
						{#each protocolData as row}
							<tr
								style="border-bottom: 1px solid var(--color-border)22;"
							>
								<td
									class="px-4 py-2"
									style="color: var(--color-text);"
									>{row.name}</td
								>
								<td
									class="px-4 py-2 text-right tabular-nums"
									style="color: var(--color-text);"
									>{fmt(row.value)}</td
								>
								<td
									class="px-4 py-2 text-right tabular-nums"
									style="color: var(--color-muted);"
								>
									{totalPools > 0
										? (
												(row.value / totalPools) *
												100
											).toFixed(1) + "%"
										: "—"}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
