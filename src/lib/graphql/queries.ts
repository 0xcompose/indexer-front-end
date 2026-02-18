import { gql } from "graphql-request"

export const CHAINS_QUERY = gql`
	query Chains {
		_meta {
			chainId
		}
	}
`

export const DASHBOARD_STATS = gql`
	query DashboardStats($chainId: Int!) {
		Pool_aggregate(where: { chainId: { _eq: $chainId } }) {
			aggregate {
				count
			}
		}
		Token_aggregate(where: { chainId: { _eq: $chainId } }) {
			aggregate {
				count
			}
		}
	}
`

export const POOLS_BY_PROTOCOL = gql`
	query PoolsByProtocol($chainId: Int!) {
		UniswapV2: Pool_aggregate(
			where: { chainId: { _eq: $chainId }, protocol: { _eq: UniswapV2 } }
		) {
			aggregate {
				count
			}
		}
		UniswapV3: Pool_aggregate(
			where: { chainId: { _eq: $chainId }, protocol: { _eq: UniswapV3 } }
		) {
			aggregate {
				count
			}
		}
		UniswapV4: Pool_aggregate(
			where: { chainId: { _eq: $chainId }, protocol: { _eq: UniswapV4 } }
		) {
			aggregate {
				count
			}
		}
		PancakeSwapInfinity: Pool_aggregate(
			where: {
				chainId: { _eq: $chainId }
				protocol: { _eq: PancakeSwapInfinity }
			}
		) {
			aggregate {
				count
			}
		}
		AlgebraIntegral: Pool_aggregate(
			where: {
				chainId: { _eq: $chainId }
				protocol: { _eq: AlgebraIntegral }
			}
		) {
			aggregate {
				count
			}
		}
		Curve: Pool_aggregate(
			where: { chainId: { _eq: $chainId }, protocol: { _eq: Curve } }
		) {
			aggregate {
				count
			}
		}
		BalancerV3: Pool_aggregate(
			where: { chainId: { _eq: $chainId }, protocol: { _eq: BalancerV3 } }
		) {
			aggregate {
				count
			}
		}
	}
`

export const RECENT_EVENTS = gql`
	query RecentEvents($limit: Int!, $offset: Int!) {
		UniswapV2Factory_PairCreated(
			limit: $limit
			offset: $offset
			order_by: { id: desc }
		) {
			id
			pair
			token0
			token1
		}
		UniswapV3Factory_PoolCreated(
			limit: $limit
			offset: $offset
			order_by: { id: desc }
		) {
			id
			pool
			token0
			token1
			fee
		}
	}
`

const POOL_FIELDS = `
	id
	chainId
	address
	protocol
	creatorContract
	poolTokens {
		tokenIndex
		token {
			id
			address
			chainId
		}
	}
`

export const POOLS_LIST_BY_CHAIN = gql`
	query PoolsListByChain($chainId: Int!, $limit: Int!, $offset: Int!) {
		Pool(
			where: { chainId: { _eq: $chainId } }
			limit: $limit
			offset: $offset
			order_by: { address: asc }
		) {
			${POOL_FIELDS}
		}
	}
`

export const POOLS_LIST_BY_CHAIN_AND_PROTOCOL = gql`
	query PoolsListByChainAndProtocol(
		$chainId: Int!
		$protocol: dexprotocol!
		$limit: Int!
		$offset: Int!
	) {
		Pool(
			where: { chainId: { _eq: $chainId }, protocol: { _eq: $protocol } }
			limit: $limit
			offset: $offset
			order_by: { address: asc }
		) {
			${POOL_FIELDS}
		}
	}
`

export const POOLS_LIST_ALL_CHAINS = gql`
	query PoolsListAllChains($limit: Int!, $offset: Int!) {
		Pool(limit: $limit, offset: $offset, order_by: { address: asc }) {
			${POOL_FIELDS}
		}
	}
`

export const POOLS_LIST_ALL_CHAINS_BY_PROTOCOL = gql`
	query PoolsListAllChainsByProtocol(
		$protocol: dexprotocol!
		$limit: Int!
		$offset: Int!
	) {
		Pool(
			where: { protocol: { _eq: $protocol } }
			limit: $limit
			offset: $offset
			order_by: { address: asc }
		) {
			${POOL_FIELDS}
		}
	}
`

export const POOLS_BY_TOKEN = gql`
	query PoolsByToken($tokenAddress: String!, $limit: Int!, $offset: Int!) {
		PoolToken(
			where: { token: { address: { _eq: $tokenAddress } } }
			limit: $limit
			offset: $offset
		) {
			tokenIndex
			pool {
				id
				chainId
				address
				protocol
				creatorContract
				poolTokens {
					tokenIndex
					token {
						id
						address
						chainId
					}
				}
			}
		}
	}
`

export const TOKENS_LIST = gql`
	query TokensList($chainId: Int, $limit: Int!, $offset: Int!) {
		Token(
			where: { chainId: { _eq: $chainId } }
			limit: $limit
			offset: $offset
			order_by: { address: asc }
		) {
			id
			chainId
			address
		}
	}
`

export const TOKENS_LIST_ALL_CHAINS = gql`
	query TokensListAllChains($limit: Int!, $offset: Int!) {
		Token(limit: $limit, offset: $offset, order_by: { address: asc }) {
			id
			chainId
			address
		}
	}
`

export const TOKEN_POOLS = gql`
	query TokenPools($tokenId: String!, $limit: Int!, $offset: Int!) {
		PoolToken(
			where: { token_id: { _eq: $tokenId } }
			limit: $limit
			offset: $offset
		) {
			tokenIndex
			pool {
				id
				chainId
				address
				protocol
				creatorContract
				poolTokens {
					tokenIndex
					token {
						id
						address
						chainId
					}
				}
			}
		}
	}
`

export const GRAPH_SEED_TOKENS = gql`
	query GraphSeedTokens($chainId: Int!, $limit: Int!) {
		Token(
			where: { chainId: { _eq: $chainId } }
			limit: $limit
			order_by: { address: asc }
		) {
			id
			address
			chainId
			poolTokens {
				pool {
					id
					address
					poolTokens {
						token {
							id
							address
						}
					}
				}
			}
		}
	}
`

export const GRAPH_EXPAND_TOKEN = gql`
	query GraphExpandToken($tokenId: String!) {
		PoolToken(where: { token_id: { _eq: $tokenId } }) {
			pool {
				id
				address
				poolTokens {
					token {
						id
						address
					}
				}
			}
		}
	}
`
