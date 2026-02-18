<script lang="ts">
	let {
		value = $bindable(""),
		placeholder = "Search...",
	}: { value?: string; placeholder?: string } = $props()
</script>

<div class="relative">
	<span
		class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm"
		style="color: var(--color-muted);"
	>
		⌕
	</span>
	<input
		type="text"
		{placeholder}
		bind:value
		class="w-full rounded-md border py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-1"
		style="background: var(--color-surface); border-color: var(--color-border); color: var(--color-text);"
	/>
</div>
