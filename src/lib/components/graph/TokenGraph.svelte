<script lang="ts">
	import { onMount, onDestroy } from "svelte"
	import Graph from "graphology"
	import type Sigma from "sigma"
	import { gqlClient } from "$lib/graphql/client"
	import { GRAPH_EXPAND_TOKEN } from "$lib/graphql/queries"

	let {
		seedTokens = [],
		onNodeHover = () => {},
	}: { seedTokens?: any[]; onNodeHover?: (label: string | null) => void } =
		$props()

	let container: HTMLDivElement | undefined = $state()
	let sigma: Sigma | null = null
	let graph: Graph
	let expandedNodes = new Set<string>()

	const NODE_COLOR = "#58a6ff"
	const EDGE_COLOR = "#30363d"
	const HOVER_COLOR = "#f0b90b"

	function shortAddr(addr: string) {
		return `${addr.slice(0, 6)}…${addr.slice(-4)}`
	}

	function buildFromSeed(data: any[]) {
		graph = new Graph({ multi: false })

		const tokenPoolCount: Record<string, number> = {}
		for (const token of data) {
			for (const pt of token.poolTokens ?? []) {
				for (const pt2 of pt.pool?.poolTokens ?? []) {
					tokenPoolCount[pt2.token.id] =
						(tokenPoolCount[pt2.token.id] ?? 0) + 1
				}
			}
		}

		for (const token of data) {
			if (!graph.hasNode(token.id)) {
				const poolCount = tokenPoolCount[token.id] ?? 1
				graph.addNode(token.id, {
					label: shortAddr(token.address),
					x: Math.random(),
					y: Math.random(),
					size: Math.max(
						4,
						Math.min(20, Math.log2(poolCount + 1) * 4),
					),
					color: NODE_COLOR,
					address: token.address,
				})
			}
		}

		for (const token of data) {
			for (const pt of token.poolTokens ?? []) {
				const poolPts = pt.pool?.poolTokens ?? []
				for (let i = 0; i < poolPts.length; i++) {
					for (let j = i + 1; j < poolPts.length; j++) {
						const a = poolPts[i].token.id
						const b = poolPts[j].token.id
						if (
							graph.hasNode(a) &&
							graph.hasNode(b) &&
							!graph.hasEdge(a, b)
						) {
							graph.addEdge(a, b, { color: EDGE_COLOR, size: 1 })
						}
					}
				}
			}
		}
	}

	async function expandNode(nodeId: string) {
		if (expandedNodes.has(nodeId)) return
		expandedNodes.add(nodeId)

		try {
			const data: any = await gqlClient.request(GRAPH_EXPAND_TOKEN, {
				tokenId: nodeId,
			})
			const poolTokens: any[] = data?.PoolToken ?? []

			for (const pt of poolTokens) {
				const pool = pt.pool
				for (const pt2 of pool?.poolTokens ?? []) {
					const tid = pt2.token.id
					if (!graph.hasNode(tid)) {
						graph.addNode(tid, {
							label: shortAddr(pt2.token.address),
							x:
								(graph.getNodeAttribute(nodeId, "x") ?? 0.5) +
								(Math.random() - 0.5) * 0.2,
							y:
								(graph.getNodeAttribute(nodeId, "y") ?? 0.5) +
								(Math.random() - 0.5) * 0.2,
							size: 6,
							color: "#e040fb",
							address: pt2.token.address,
						})
					}
				}
				const pts = pool?.poolTokens ?? []
				for (let i = 0; i < pts.length; i++) {
					for (let j = i + 1; j < pts.length; j++) {
						const a = pts[i].token.id
						const b = pts[j].token.id
						if (
							graph.hasNode(a) &&
							graph.hasNode(b) &&
							!graph.hasEdge(a, b)
						) {
							graph.addEdge(a, b, { color: "#3d4451", size: 1 })
						}
					}
				}
			}

			sigma?.refresh()
		} catch (e) {
			console.error("Failed to expand node", e)
		}
	}

	onMount(async () => {
		if (!container) return

		const { default: SigmaLib } = await import("sigma")
		const { circular } = await import("graphology-layout")
		const FA2 = await import("graphology-layout-forceatlas2")

		buildFromSeed(seedTokens)
		circular.assign(graph)
		FA2.assign(graph, { iterations: 100, settings: { gravity: 1 } })

		sigma = new SigmaLib(graph, container, {
			renderEdgeLabels: false,
			defaultEdgeColor: EDGE_COLOR,
			defaultNodeColor: NODE_COLOR,
			labelColor: { color: "#8b949e" },
			labelSize: 11,
			minCameraRatio: 0.05,
			maxCameraRatio: 10,
		})

		sigma.on("enterNode", ({ node }) => {
			onNodeHover(graph.getNodeAttribute(node, "address") ?? null)
		})
		sigma.on("leaveNode", () => onNodeHover(null))
		sigma.on("clickNode", ({ node }) => {
			expandNode(node)
			graph.setNodeAttribute(node, "color", HOVER_COLOR)
			sigma?.refresh()
		})
	})

	$effect(() => {
		if (sigma && seedTokens.length > 0) {
			buildFromSeed(seedTokens)
			sigma.setGraph(graph)
			sigma.refresh()
		}
	})

	onDestroy(() => {
		sigma?.kill()
	})
</script>

<div
	bind:this={container}
	class="h-full w-full"
	style="background: var(--color-bg);"
></div>
