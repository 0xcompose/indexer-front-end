<script lang="ts">
	let { title, subtitle = "" }: { title: string; subtitle?: string } =
		$props()
</script>

<div class="mb-6">
	<h1 class="text-xl font-semibold" style="color: var(--color-text);">
		{title}
	</h1>
	{#if subtitle}
		<p class="mt-0.5 text-sm" style="color: var(--color-muted);">
			{subtitle}
		</p>
	{/if}
</div>
