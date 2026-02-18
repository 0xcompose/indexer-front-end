<script lang="ts">
	import { onMount, onDestroy } from "svelte"
	import type { EChartsOption } from "echarts"

	let {
		option,
		height = "300px",
	}: { option: EChartsOption; height?: string } = $props()

	let container: HTMLDivElement | undefined = $state()
	let chart: import("echarts").ECharts | null = null

	onMount(async () => {
		if (!container) return
		const echarts = await import("echarts")
		chart = echarts.init(container, "dark")
		chart.setOption(option)

		const ro = new ResizeObserver(() => chart?.resize())
		ro.observe(container)
		return () => ro.disconnect()
	})

	$effect(() => {
		if (chart) {
			chart.setOption(option, true)
		}
	})

	onDestroy(() => {
		chart?.dispose()
	})
</script>

<div bind:this={container} style="width: 100%; height: {height};"></div>
