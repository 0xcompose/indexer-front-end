# Pool Explorer — Frontend

A static SvelteKit frontend that visualizes DEX pools and tokens indexed by [Envio HyperIndex](https://docs.envio.dev). Connects directly to the Envio GraphQL API and renders everything client-side — no server required.

## Architecture

```
Envio HyperIndex
  └── GraphQL API (:8080/v1/graphql)
        │
        ▼
SvelteKit (static adapter, client-side only)
  ├── Dashboard      /          — aggregate stats + protocol charts
  ├── Pool Explorer  /pools     — filterable pool list + detail modal
  ├── Token Explorer /tokens    — filterable token list + pools modal
  └── Network Graph  /graph     — force-directed token graph (Sigma.js)
```

## Data Model

The indexer exposes three core entities:

| Entity      | Key fields                                                                        |
| ----------- | --------------------------------------------------------------------------------- |
| `Token`     | `id` (`chainId:address`), `chainId`, `address`                                    |
| `Pool`      | `id` (`chainId:poolAddress`), `chainId`, `address`, `protocol`, `creatorContract` |
| `PoolToken` | `id`, `pool`, `token`, `tokenIndex`                                               |

Supported protocols: `UniswapV2`, `UniswapV3`, `UniswapV4`, `PancakeSwapInfinity`, `AlgebraIntegral`, `Curve`, `BalancerV3`

Currently indexed chains: **Fuse (122)**, **Story (1514)**. Base, Ethereum, Arbitrum, BSC planned.

> **Note:** `Token` and `Pool` entities have no timestamp fields. "Recent" activity is derived from protocol-specific event entities (`UniswapV2Factory_PairCreated`, etc.).

## Tech Stack

| Layer          | Library                                 |
| -------------- | --------------------------------------- |
| Framework      | SvelteKit 2 + Svelte 5 (static adapter) |
| Language       | TypeScript                              |
| Styling        | Tailwind CSS v4                         |
| Data fetching  | `@tanstack/svelte-query` v6             |
| GraphQL client | `graphql-request`                       |
| Charts         | ECharts (lazy loaded)                   |
| Network graph  | Sigma.js + Graphology (lazy loaded)     |
| Deployment     | GitHub Pages via GitHub Actions         |

## Features

### Dashboard (`/`)

- Chain selector synced across all pages
- Aggregate stats: total pools, total tokens, active protocol count
- Pools-by-protocol pie chart + bar chart (ECharts)
- Protocol breakdown table with percentage share

### Pool Explorer (`/pools`)

- Infinite-scroll list with offset pagination (100 per page)
- Filter by chain (sidebar), protocol (dropdown), token address (search)
- Address search within loaded results
- Click any row to open a detail modal (tokens, protocol, creator contract)
- Copy-to-clipboard on any address with animated feedback

### Token Explorer (`/tokens`)

- Infinite-scroll list sorted by address
- Address search within loaded results
- Click any token to see all pools it participates in (modal)

### Network Graph (`/graph`)

- Force-directed graph rendered via Sigma.js WebGL
- Nodes = tokens, sized by pool connection count
- Edges = pool connections between token pairs
- Seed: top 200 tokens for the selected chain
- Click any node to progressively expand its neighbors
- Hover shows full token address in toolbar

## Local Development

**Prerequisites:** Node 20+, Envio HyperIndex running locally

```bash
cd frontend
npm install
```

Copy the env file and point it at your local indexer:

```bash
cp .env .env.local
# edit PUBLIC_GRAPHQL_URL if your indexer runs on a different port
```

```bash
npm run dev       # http://localhost:5173
```

The default endpoint is `http://localhost:8080/v1/graphql`. Override it via:

```
PUBLIC_GRAPHQL_URL=http://localhost:8080/v1/graphql
```

### Token metadata enrichment (optional)

Set `PUBLIC_TOKEN_METADATA_RPC_URL` to enable human-readable token names and symbols across the UI:

```
PUBLIC_TOKEN_METADATA_RPC_URL=http://localhost:3001
```

**Local dev and CORS:** the browser always sends `Origin` on cross-origin `fetch`; relaxing CORS on the API is not always enough. For `npm run dev`, point Vite at your token API and use a same-origin proxy path:

```
PUBLIC_TOKEN_METADATA_USE_DEV_PROXY=true
TOKEN_METADATA_PROXY_TARGET=http://127.0.0.1:7777/rpc
```

Use a full URL: **origin** (scheme + host + port) and optional **path** (e.g. `/rpc`). Vite proxies to `origin` only and rewrites the browser path to your path — `TOKEN_METADATA_PROXY_TARGET=http://127.0.0.1:7777/rpc` maps `POST /__token-metadata__` → `POST http://127.0.0.1:7777/rpc`. A target with no path (e.g. `http://127.0.0.1:3001`) maps to `/` on that host.

(`TOKEN_METADATA_PROXY_TARGET` is read only by Vite, not exposed to the client.) Production and `npm run preview` keep using `PUBLIC_TOKEN_METADATA_RPC_URL` as usual.

The app calls `eth_getTokenMetadata` (JSON-RPC 2.0) per token address. In the browser, requests are **coalesced** (short delay, deduped by chain + address) and sent as **JSON-RPC batch arrays** when several tokens are needed at once (up to 100 calls per HTTP request). The RPC server must accept a JSON array of requests and return an array of results, per the JSON-RPC 2.0 batch spec. If the response is not an array, the client falls back to one request per token for that round. When the service is unreachable or returns an error, the UI silently falls back to displaying the raw address — nothing breaks. Metadata is cached in TanStack Query with a 24-hour stale time so repeated navigation does not re-fetch.

**Display behaviour when metadata is available:**
- Token addresses in pool rows and modals show `Name (SYMBOL) 0xabcd…1234` instead of just the address.
- The Token Explorer table gains a **Metadata** column (first column) showing `Name (Symbol)`, or `—` when not available.

**Docker:**
```bash
docker run -d --name pool-explorer \
  -e PUBLIC_GRAPHQL_URL=http://your-indexer:8080/v1/graphql \
  -e PUBLIC_TOKEN_METADATA_RPC_URL=http://your-token-api:3001 \
  -p 8088:80 pool-explorer-frontend:local
```

## Build

```bash
npm run build     # outputs to frontend/build/
npm run preview   # preview the static build locally
```

## Deployment (GitHub Pages)

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys the site on every push to `main`.

**Setup:**

1. Go to **Settings → Pages** and set source to _GitHub Actions_
2. Go to **Settings → Variables → Actions** and add:
    - `PUBLIC_GRAPHQL_URL` — your production indexer GraphQL endpoint

**Project pages** (deployed to `username.github.io/repo-name`) additionally require a base path in `svelte.config.js`:

```js
kit: {
	paths: {
		base: "/your-repo-name"
	}
}
```

**User/org pages** (`username.github.io`) work with the default config.

## Project Structure

```
frontend/
  src/
    lib/
      graphql/
        client.ts       # graphql-request client (reads PUBLIC_GRAPHQL_URL)
        queries.ts      # all GraphQL query definitions
        types.ts        # TypeScript types + chain/protocol constants
      components/
        charts/
          EChart.svelte       # lazy ECharts wrapper with resize observer
        graph/
          TokenGraph.svelte   # Sigma.js force-directed graph
        tables/
          PoolsTable.svelte   # reusable pool table
        ui/
          AddressCell.svelte  # shortened address + copy button
          LoadMore.svelte     # IntersectionObserver infinite scroll trigger
          Modal.svelte        # keyboard-dismissible overlay
          ProtocolBadge.svelte
          SearchInput.svelte
          StatCard.svelte
          PageHeader.svelte
      stores/
        chain.svelte.ts   # Svelte 5 $state — selected chain (global)
    routes/
      +layout.svelte      # sidebar nav, chain selector, QueryClientProvider
      +layout.ts          # prerender: true, ssr: false
      +page.svelte        # Dashboard
      pools/+page.svelte  # Pool Explorer
      tokens/+page.svelte # Token Explorer
      graph/+page.svelte  # Network Graph
    app.css               # Tailwind base + CSS custom properties (dark theme)
  .github/workflows/
    deploy.yml            # build → GitHub Pages
  .env                    # PUBLIC_GRAPHQL_URL (local default)
  svelte.config.js        # static adapter
  vite.config.ts          # Tailwind v4 plugin
```

## Known Limitations & Future Work

- **`_aggregate` queries** (`Pool_aggregate`, `Token_aggregate`) are not exposed at the root level of the current Envio endpoint. Pagination uses page-size comparison (`hasMore = lastPage.length >= PAGE_SIZE`) instead of total counts.
- **Token sort by pool count** requires either Hasura relationship-aggregate ordering (`order_by: { poolTokens_aggregate: { count: desc } }`) or adding a `poolCount` field to the `Token` entity in the indexer.
- **Auth/rate-limiting** not implemented — the frontend assumes an open local endpoint. Future: add Bearer token support or a serverless proxy.
- **Keyset/cursor pagination** not yet available. Offset pagination degrades on very large tables (Base, Ethereum). Future: add `blockNumber`/`logIndex` fields to `Pool` and use cursor-based pagination.
