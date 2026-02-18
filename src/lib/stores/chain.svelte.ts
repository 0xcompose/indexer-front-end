class ChainStore {
	chains = $state<number[]>([])
	selected = $state<number | null>(null)

	get firstChainId(): number | null {
		return this.chains[0] ?? null
	}
}

export const chainStore = new ChainStore()
