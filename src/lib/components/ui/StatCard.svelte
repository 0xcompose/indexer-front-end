<script lang="ts">
	let {
		label,
		value,
		sub = "",
	}: { label: string; value: string | number; sub?: string } = $props()
</script>

<div
	class="rounded-lg border p-4"
	style="background: var(--color-surface); border-color: var(--color-border);"
>
	<p
		class="mb-1 text-xs font-medium uppercase tracking-wider"
		style="color: var(--color-muted);"
	>
		{label}
	</p>
	<p
		class="text-2xl font-semibold tabular-nums"
		style="color: var(--color-text);"
	>
		{value}
	</p>
	{#if sub}
		<p class="mt-0.5 text-xs" style="color: var(--color-muted);">{sub}</p>
	{/if}
</div>
