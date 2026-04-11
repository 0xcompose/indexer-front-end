<script lang="ts">
	import type { PoolWithTokens } from "$lib/graphql/types"
	import { chainlistStore } from "$lib/stores/chainlist.svelte"
	import ProtocolBadge from "$lib/components/ui/ProtocolBadge.svelte"
	import AddressCell from "$lib/components/ui/AddressCell.svelte"
	import TokenAddressCell from "$lib/components/ui/TokenAddressCell.svelte"
	import PoolModalInsights from "$lib/components/pools/PoolModalInsights.svelte"
	import PoolModalV2Events from "$lib/components/pools/PoolModalV2Events.svelte"

	let { pool }: { pool: PoolWithTokens } = $props()

	function chainName(id: number) {
		return chainlistStore.getChainName(id)
	}

	function formatCreationBlock(
		value: string | number | bigint | null | undefined,
	): string {
		if (value == null || value === "") return ""
		try {
			return BigInt(value).toLocaleString()
		} catch {
			return String(value)
		}
	}
</script>

<div class="flex flex-col gap-4 text-sm">
	<div>
		<p
			class="mb-1 text-xs font-medium uppercase"
			style="color: var(--color-muted);"
		>
			Address
		</p>
		<AddressCell address={pool.address} short={false} />
	</div>
	<div>
		<p
			class="mb-1 text-xs font-medium uppercase"
			style="color: var(--color-muted);"
		>
			Protocol
		</p>
		<ProtocolBadge protocol={pool.protocol} />
	</div>
	<div>
		<p
			class="mb-1 text-xs font-medium uppercase"
			style="color: var(--color-muted);"
		>
			Chain
		</p>
		<span style="color: var(--color-text);">{chainName(pool.chainId)}</span>
	</div>
	<div>
		<p
			class="mb-1 text-xs font-medium uppercase"
			style="color: var(--color-muted);"
		>
			Creation block
		</p>
		{#if pool.createdAtBlock != null && pool.createdAtBlock !== ""}
			<span
				class="font-mono tabular-nums"
				style="color: var(--color-text);"
			>
				{formatCreationBlock(pool.createdAtBlock)}
			</span>
		{:else}
			<span style="color: var(--color-muted);">—</span>
		{/if}
	</div>
	<div>
		<p
			class="mb-1 text-xs font-medium uppercase"
			style="color: var(--color-muted);"
		>
			Creator Contract
		</p>
		<AddressCell address={pool.creatorContract} short={false} />
	</div>
	<div>
		<p
			class="mb-2 text-xs font-medium uppercase"
			style="color: var(--color-muted);"
		>
			Tokens
		</p>
		<div class="flex flex-col gap-2">
			{#each pool.poolTokens.toSorted((a, b) => a.tokenIndex - b.tokenIndex) as pt (pt.token.id)}
				<div
					class="flex items-center gap-3 rounded-md border p-2"
					style="border-color: var(--color-border); background: var(--color-bg);"
				>
					<span
						class="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
						style="background: var(--color-border); color: var(--color-muted);"
					>
						{pt.tokenIndex}
					</span>
					<TokenAddressCell
						chainId={pt.token.chainId}
						address={pt.token.address}
						short={false}
					/>
				</div>
			{/each}
		</div>
	</div>

	<PoolModalInsights pool={pool} open={true} />

	<PoolModalV2Events pool={pool} open={true} />
</div>
