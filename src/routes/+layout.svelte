<script lang="ts">
	import "../app.css"
	import { onMount } from "svelte"
	import type { Snippet } from "svelte"
	import { goto } from "$app/navigation"
	import { resolve } from "$app/paths"
	import { page } from "$app/state"
	import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query"
	import { chainStore } from "$lib/stores/chain.svelte"
	import { chainlistStore } from "$lib/stores/chainlist.svelte"
	import { CHAINS_QUERY } from "$lib/graphql/queries"
	import { gqlClient } from "$lib/graphql/client"

	let { children }: { children: Snippet } = $props()

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				refetchOnWindowFocus: false,
			},
		},
	})

	const navItems = [
		{ href: "/", label: "Dashboard", icon: "⬡" },
		{ href: "/pools", label: "Pools", icon: "◈" },
		{ href: "/tokens", label: "Tokens", icon: "◎" },
		{ href: "/status", label: "Status", icon: "◉" },
	]

	function isActive(href: string) {
		const path = resolve(href as "/")
		if (href === "/") return page.url.pathname === path
		return page.url.pathname === path || page.url.pathname.startsWith(`${path}/`)
	}

	let chainsLoading = $state(true)

	onMount(async () => {
		chainlistStore.load()
		try {
			const data = await gqlClient.request<{
				_meta: { chainId: number; progressBlock?: unknown }[]
			}>(CHAINS_QUERY)
			const ids = data._meta.map((m) => m.chainId)
			chainStore.chains = ids
		} finally {
			chainsLoading = false
		}
	})

	const chainQueryParam = $derived(
		chainStore.selected === null ? "all" : String(chainStore.selected),
	)

	function navHref(path: string): string {
		return `${resolve(path as "/")}?chain=${chainQueryParam}`
	}

	/** Keep `chainStore` in sync with `?chain=<id>|all` (bookmarkable, survives reload). */
	$effect(() => {
		if (chainsLoading || chainStore.chains.length === 0) return

		void page.url.search
		const ids = chainStore.chains
		const param = page.url.searchParams.get("chain")

		let next: number | null
		if (param === "all") {
			next = null
		} else if (param != null && param !== "") {
			const id = parseInt(param, 10)
			next =
				Number.isFinite(id) && ids.includes(id) ? id : (ids[0] ?? null)
		} else {
			// No `chain` param: keep valid in-memory choice (SPA) or default to first
			next =
				chainStore.selected !== null && ids.includes(chainStore.selected)
					? chainStore.selected
					: (ids[0] ?? null)
		}

		if (chainStore.selected !== next) {
			chainStore.selected = next
		}

		const want = chainStore.selected === null ? "all" : String(chainStore.selected)
		if (page.url.searchParams.get("chain") === want) return

		const u = new URL(page.url.href)
		u.searchParams.set("chain", want)
		goto(`${u.pathname}${u.search}${u.hash}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		})
	})
</script>

<QueryClientProvider client={queryClient}>
	<div
		class="flex h-screen overflow-hidden"
		style="background: var(--color-bg);"
	>
		<aside
			class="flex w-56 flex-shrink-0 flex-col border-r"
			style="background: var(--color-surface); border-color: var(--color-border);"
		>
			<div class="px-5 py-5">
				<div class="flex items-center gap-2">
					<span class="text-xl" style="color: var(--color-accent);"
						>◈</span
					>
					<span
						class="text-sm font-semibold tracking-wide"
						style="color: var(--color-text);">Pool Explorer</span
					>
				</div>
			</div>

			<nav class="flex flex-col gap-1 px-2">
				{#each navItems as item (item.href)}
					<a
						href={navHref(item.href)}
						class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
						style={isActive(item.href)
							? "background: rgba(88,166,255,0.12); color: var(--color-accent);"
							: "color: var(--color-muted);"}
					>
						<span>{item.icon}</span>
						{item.label}
					</a>
				{/each}
			</nav>

			<div
				class="mt-auto border-t px-4 py-4"
				style="border-color: var(--color-border);"
			>
				<label
					for="chain-select"
					class="mb-1 block text-xs"
					style="color: var(--color-muted);"
				>
					Chain
				</label>
				<select
					id="chain-select"
					class="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none"
					style="background: var(--color-bg); border-color: var(--color-border); color: var(--color-text);"
					value={chainStore.selected === null
						? "all"
						: String(chainStore.selected)}
					onchange={(e) => {
						const v = e.currentTarget.value
						const u = new URL(page.url.href)
						u.searchParams.set("chain", v)
						goto(`${u.pathname}${u.search}${u.hash}`, {
							replaceState: true,
							noScroll: true,
							keepFocus: true,
						})
					}}
				>
					<option value="all">All chains</option>
					{#if chainsLoading}
						<option disabled>Loading…</option>
					{:else}
						{#each chainStore.chains as chainId (chainId)}
							<option value={String(chainId)}
								>{chainlistStore.getChainName(chainId)} ({chainId})</option
							>
						{/each}
					{/if}
				</select>
			</div>
		</aside>

		<main class="flex flex-1 flex-col overflow-auto">
			{@render children()}
		</main>
	</div>
</QueryClientProvider>
