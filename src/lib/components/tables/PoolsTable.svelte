<script lang="ts">
	import ProtocolBadge from "$lib/components/ui/ProtocolBadge.svelte"
	import AddressCell from "$lib/components/ui/AddressCell.svelte"
	import { chainlistStore } from "$lib/stores/chainlist.svelte"
	import type { PoolWithTokens } from "$lib/graphql/types"

	let {
		pools = [],
		onSelect = null,
	}: {
		pools?: PoolWithTokens[]
		onSelect?: ((pool: PoolWithTokens) => void) | null
	} = $props()

	function chainName(id: number) {
		return chainlistStore.getChainName(id)
	}
</script>

<div
	class="overflow-hidden rounded-lg border"
	style="border-color: var(--color-border);"
>
	<table class="w-full text-sm">
		<thead>
			<tr
				style="background: var(--color-surface); border-bottom: 1px solid var(--color-border);"
			>
				<th
					class="px-4 py-2 text-left font-medium"
					style="color: var(--color-muted);">Address</th
				>
				<th
					class="px-4 py-2 text-left font-medium"
					style="color: var(--color-muted);">Protocol</th
				>
				<th
					class="px-4 py-2 text-left font-medium"
					style="color: var(--color-muted);">Chain</th
				>
				<th
					class="px-4 py-2 text-left font-medium"
					style="color: var(--color-muted);">Tokens</th
				>
			</tr>
		</thead>
		<tbody>
			{#each pools as pool}
				<tr
					class="transition-colors"
					style="border-bottom: 1px solid var(--color-border)22;"
					class:cursor-pointer={!!onSelect}
					onclick={() => onSelect?.(pool)}
				>
					<td class="px-4 py-2.5"
						><AddressCell address={pool.address} /></td
					>
					<td class="px-4 py-2.5"
						><ProtocolBadge protocol={pool.protocol} /></td
					>
					<td
						class="px-4 py-2.5 text-xs"
						style="color: var(--color-muted);"
					>
						{chainName(pool.chainId)}
					</td>
					<td class="px-4 py-2.5">
						<div class="flex flex-wrap gap-1">
							{#each pool.poolTokens.toSorted((a, b) => a.tokenIndex - b.tokenIndex) as pt}
								<AddressCell address={pt.token.address} />
							{/each}
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
