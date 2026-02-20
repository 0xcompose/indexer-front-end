<script lang="ts">
	import type { DexProtocol } from "$lib/graphql/types"

	let { protocol }: { protocol: DexProtocol } = $props()

	const colors: Record<DexProtocol, string> = {
		UniswapV2: "#ff007a",
		UniswapV3: "#ff69b4",
		UniswapV4: "#e040fb",
		PancakeSwapInfinity: "#1fc7d4",
		AlgebraIntegral: "#f0b90b",
		Curve: "#d62728",
		BalancerV2: "#1e88e5",
		BalancerV3: "#1e90ff",
		VelodromeSlipstreamCL: "#00d4aa",
		VelodromeCPMM: "#f93d82",
	}

	const color = $derived(colors[protocol] ?? "#8b949e")
</script>

<span
	class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
	style="background: {color}22; color: {color}; border: 1px solid {color}44;"
>
	{protocol}
</span>
