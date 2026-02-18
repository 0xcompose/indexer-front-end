import { CHAINS } from "$lib/graphql/types"

class ChainStore {
	selected = $state<number | null>(CHAINS[0].id)
}

export const chainStore = new ChainStore()
