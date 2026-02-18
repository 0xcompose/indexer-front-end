<script lang="ts">
	let { address, short = true }: { address: string; short?: boolean } =
		$props()

	let copied = $state(false)
	let timer: ReturnType<typeof setTimeout>

	function shorten(addr: string) {
		if (!addr || addr.length < 12) return addr
		return `${addr.slice(0, 6)}…${addr.slice(-4)}`
	}

	function copy() {
		navigator.clipboard.writeText(address)
		copied = true
		clearTimeout(timer)
		timer = setTimeout(() => (copied = false), 1500)
	}
</script>

<span class="group inline-flex items-center gap-1 font-mono text-xs">
	<span style="color: var(--color-accent);"
		>{short ? shorten(address) : address}</span
	>
	<button
		class="text-[0.85rem] opacity-0 transition-all duration-150 group-hover:opacity-60 hover:!opacity-100"
		style={copied ? "color: #3fb950; opacity: 1;" : ""}
		onclick={copy}
		title={copied ? "Copied!" : "Copy address"}
	>
		{#if copied}
			<span style="display:inline-block; animation: pop 0.15s ease-out;"
				>✓</span
			>
		{:else}
			⎘
		{/if}
	</button>
</span>

<style>
	@keyframes pop {
		0% {
			transform: scale(0.6);
			opacity: 0;
		}
		60% {
			transform: scale(1.3);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
