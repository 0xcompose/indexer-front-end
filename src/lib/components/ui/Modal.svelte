<script lang="ts">
	import type { Snippet } from "svelte"

	let {
		open = false,
		title = "",
		onClose,
		children,
	}: {
		open?: boolean
		title?: string
		onClose: () => void
		children: Snippet
	} = $props()

	function handleKey(e: KeyboardEvent) {
		if (e.key === "Escape") onClose()
	}
</script>

<svelte:window onkeydown={handleKey} />

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background: rgba(0,0,0,0.7);"
		onclick={onClose}
		onkeydown={(e) => e.key === "Escape" && onClose()}
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border"
			style="background: var(--color-surface); border-color: var(--color-border);"
			onclick={(e) => e.stopPropagation()}
		>
			<div
				class="flex items-center justify-between border-b px-5 py-3"
				style="border-color: var(--color-border);"
			>
				<h2
					class="text-sm font-semibold"
					style="color: var(--color-text);"
				>
					{title}
				</h2>
				<button
					class="text-lg leading-none transition-opacity hover:opacity-70"
					style="color: var(--color-muted);"
					onclick={onClose}
				>
					✕
				</button>
			</div>
			<div class="overflow-y-auto p-5">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
