import { fetchChainlist, type ChainlistChain } from "$lib/services/chainlist"

class ChainlistStore {
	/** chainId -> chain metadata */
	chainsById = $state<Map<number, ChainlistChain>>(new Map())
	loading = $state(false)
	error = $state<string | null>(null)

	async load(): Promise<void> {
		if (this.chainsById.size > 0) return
		this.loading = true
		this.error = null
		try {
			const list = await fetchChainlist()
			const map = new Map<number, ChainlistChain>()
			for (const c of list) {
				if (c.chainId != null && !map.has(c.chainId)) map.set(c.chainId, c)
			}
			this.chainsById = map
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Failed to load chainlist"
		} finally {
			this.loading = false
		}
	}

	getChainName(chainId: number): string {
		return this.chainsById.get(chainId)?.name ?? `Chain ${chainId}`
	}

	getExplorerUrl(chainId: number): string | null {
		const explorers = this.chainsById.get(chainId)?.explorers
		return explorers?.[0]?.url ?? null
	}

	/** Base URL for block explorer (e.g. https://etherscan.io). No trailing slash. */
	getExplorerBaseUrl(chainId: number): string | null {
		return this.getExplorerUrl(chainId) ?? null
	}

	/** URL for address on explorer (e.g. https://etherscan.io/address/0x...) */
	getAddressUrl(chainId: number, address: string): string | null {
		const base = this.getExplorerUrl(chainId)
		if (!base) return null
		const normalized = base.replace(/\/$/, "")
		return `${normalized}/address/${address}`
	}

	getNativeSymbol(chainId: number): string | null {
		return this.chainsById.get(chainId)?.nativeCurrency?.symbol ?? null
	}

	getRpcUrls(chainId: number): string[] {
		const rpc = this.chainsById.get(chainId)?.rpc
		if (!rpc?.length) return []
		return rpc.map((e) => e.url).filter((u) => u.startsWith("http"))
	}
}

export const chainlistStore = new ChainlistStore()
