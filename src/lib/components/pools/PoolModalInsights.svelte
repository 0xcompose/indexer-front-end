<script lang="ts">
	import { createQuery } from "@tanstack/svelte-query"
	import { browser } from "$app/environment"
	import { gqlClient } from "$lib/graphql/client"
	import { POOL_MODAL_IMMUTABLES } from "$lib/graphql/queries"
	import { chainlistStore } from "$lib/stores/chainlist.svelte"
	import type { PoolWithTokens } from "$lib/graphql/types"
	import { fetchPoolModalOnchainData } from "$lib/services/poolModalOnchain"
	import { formatTokenAmount } from "$lib/services/poolTokenBalances"

	let { pool, open = false }: { pool: PoolWithTokens | null; open?: boolean } =
		$props()

	function fmtScalar(v: unknown): string {
		if (v == null) return "—"
		if (typeof v === "boolean") return v ? "true" : "false"
		return String(v)
	}

	function fmtBigIntish(v: unknown): string {
		if (v == null) return "—"
		try {
			return BigInt(String(v)).toLocaleString()
		} catch {
			return String(v)
		}
	}

	/** No thousand separators (for sqrtPriceX96 copy/paste). */
	function fmtSqrtPriceX96Plain(v: bigint): string {
		return v.toString()
	}

	/** Uniswap V3 `TickMath` min/max; typical bound for slot0 `tick` on V3-style pools. */
	const UNISWAP_V3_TICK_MIN = -887_272
	const UNISWAP_V3_TICK_MAX = 887_272

	const hasHttpRpc = $derived(
		pool ? chainlistStore.getRpcUrls(pool.chainId).length > 0 : false,
	)

	const immutablesQuery = createQuery(() => ({
		queryKey: ["pool-modal-immutables", pool?.id],
		queryFn: () =>
			gqlClient.request(POOL_MODAL_IMMUTABLES, { poolId: pool!.id }),
		enabled: browser && open && pool !== null,
		staleTime: 60_000,
	}))

	const onchainQuery = createQuery(() => ({
		queryKey: ["pool-modal-onchain", pool?.id, pool?.address],
		queryFn: () =>
			fetchPoolModalOnchainData(
				pool!,
				chainlistStore.getRpcUrls(pool!.chainId),
			),
		enabled:
			browser &&
			open &&
			pool !== null &&
			hasHttpRpc,
		staleTime: 15_000,
	}))

	type ImmRow = { label: string; fields: Record<string, unknown> }

	const immutablesRows = $derived.by((): ImmRow[] => {
		const d = immutablesQuery.data as Record<string, unknown> | undefined
		if (!d) return []

		const groups: ImmRow[] = []

		const push = (label: string, key: string) => {
			const arr = d[key] as { id?: string }[] | undefined
			const row = arr?.[0]
			if (!row) return
			const { id: _id, ...rest } = row
			if (Object.keys(rest).length === 0) return
			groups.push({ label, fields: rest })
		}

		push("Uniswap V3", "UniswapV3PoolImmutables")
		push("Uniswap V4", "UniswapV4PoolImmutables")
		push("PancakeSwap Infinity", "PancakeSwapInfinityPoolImmutables")
		push("Balancer V2", "BalancerV2PoolImmutables")
		push("Balancer V3", "BalancerV3PoolImmutables")
		push("Algebra Integral", "AlgebraIntegralPoolImmutables")
		push("Velodrome Slipstream CL", "VelodromeSlipstreamCLPoolImmutables")
		push("Velodrome CPMM", "VelodromeCPMMPoolImmutables")

		return groups
	})
</script>

{#if pool}
	<div class="flex flex-col gap-4 border-t pt-4" style="border-color: var(--color-border);">
		{#if immutablesQuery.isLoading}
			<p class="text-xs" style="color: var(--color-muted);">Loading indexer immutables…</p>
		{:else if immutablesQuery.isError}
			<p class="text-xs text-red-400">
				{immutablesQuery.error instanceof Error
					? immutablesQuery.error.message
					: "Immutables query failed"}
			</p>
		{:else if immutablesRows.length > 0}
			<div>
				<p
					class="mb-2 text-xs font-medium uppercase"
					style="color: var(--color-muted);"
				>
					Indexer immutables
				</p>
				<div class="flex flex-col gap-3">
					{#each immutablesRows as g (g.label)}
						<div
							class="rounded-md border p-2 text-xs"
							style="border-color: var(--color-border); background: var(--color-bg);"
						>
							<p class="mb-1.5 font-medium" style="color: var(--color-accent);">
								{g.label}
							</p>
							<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
								{#each Object.entries(g.fields) as [k, v] (k)}
									<dt class="font-mono text-[0.65rem]" style="color: var(--color-muted);">
										{k}
									</dt>
									<dd class="break-all font-mono text-[0.7rem]" style="color: var(--color-text);">
										{fmtScalar(v)}
									</dd>
								{/each}
							</dl>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div>
			<p
				class="mb-2 text-xs font-medium uppercase"
				style="color: var(--color-muted);"
			>
				Reserves (ERC-20 balanceOf pool)
			</p>
			{#if !hasHttpRpc}
				<p class="text-xs" style="color: var(--color-muted);">
					No HTTP RPC in chainlist — cannot load balances.
				</p>
			{:else if onchainQuery.isLoading}
				<p class="text-xs" style="color: var(--color-muted);">Loading balances…</p>
			{:else if onchainQuery.isError}
				<p class="text-xs text-red-400">
					{onchainQuery.error instanceof Error
						? onchainQuery.error.message
						: "On-chain fetch failed"}
				</p>
			{:else if onchainQuery.data}
				{#if onchainQuery.data.reservesSkipped}
					<p class="text-xs leading-snug" style="color: var(--color-muted);">
						Not shown for this protocol (balancer-style / vault pools use different
						accounting than ERC-20 <code class="text-[0.65rem]">balanceOf(pool)</code>).
					</p>
				{:else}
					<div class="flex flex-col gap-2">
						{#each onchainQuery.data.tokens as t (t.address)}
							<div
								class="flex flex-wrap items-baseline justify-between gap-2 rounded border px-2 py-1.5 font-mono text-xs"
								style="border-color: var(--color-border);"
							>
								<span style="color: var(--color-muted);"
									>#{t.tokenIndex} {t.symbol}</span
								>
								<span class="tabular-nums" style="color: var(--color-text);">
									{t.balance !== null
										? formatTokenAmount(t.balance, t.decimals)
										: "—"}
								</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if onchainQuery.data.concentrated}
					{@const cl = onchainQuery.data.concentrated}
					<div class="mt-3">
						<p
							class="mb-1.5 text-xs font-medium uppercase"
							style="color: var(--color-muted);"
						>
							Concentrated liquidity (slot0)
						</p>
						<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[0.7rem]">
							<dt style="color: var(--color-muted);">liquidity</dt>
							<dd class="break-all tabular-nums" style="color: var(--color-text);">
								{fmtBigIntish(cl.liquidity)}
							</dd>
							<dt style="color: var(--color-muted);">sqrtPriceX96</dt>
							<dd class="break-all font-mono tabular-nums" style="color: var(--color-text);">
								{fmtSqrtPriceX96Plain(cl.sqrtPriceX96)}
							</dd>
							<dt style="color: var(--color-muted);">tick</dt>
							<dd class="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
								<span class="tabular-nums" style="color: var(--color-text);">
									{cl.tick}
								</span>
								<span
									class="max-w-full text-[0.65rem] leading-snug"
									style="color: var(--color-muted); opacity: 0.9;"
								>
									(V3-style bounds: min {UNISWAP_V3_TICK_MIN} · max {UNISWAP_V3_TICK_MAX})
								</span>
							</dd>
						</dl>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
