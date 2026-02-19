<script lang="ts">
	import { onDestroy } from "svelte"
	import type { EChartsOption } from "echarts"

	// #region agent log
	const _dl = (loc: string, msg: string, data: Record<string, unknown> = {}) => fetch('http://127.0.0.1:7269/ingest/b638804f-8af4-4301-99b7-26f3662c2582',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'db0893'},body:JSON.stringify({sessionId:'db0893',location:`EChart.svelte:${loc}`,message:msg,data,timestamp:Date.now()})}).catch(()=>{});
	// #endregion

	let {
		option,
		height = "300px",
	}: { option: EChartsOption; height?: string } = $props()

	let container: HTMLDivElement | undefined = $state()
	let chart = $state<import("echarts").ECharts | null>(null)
	let resizeObserver: ResizeObserver | null = null

	$effect(() => {
		const el = container
		// #region agent log
		_dl('effect1-entry', 'init effect triggered', {
			hypothesisId: 'H1,H2,H4,H5',
			elExists: !!el,
			elType: el ? Object.prototype.toString.call(el) : 'N/A',
			isHTMLDivElement: el instanceof HTMLDivElement,
			isConnected: el?.isConnected ?? false,
			offsetWidth: (el as HTMLDivElement)?.offsetWidth ?? -1,
			offsetHeight: (el as HTMLDivElement)?.offsetHeight ?? -1,
			clientWidth: (el as HTMLDivElement)?.clientWidth ?? -1,
			clientHeight: (el as HTMLDivElement)?.clientHeight ?? -1,
		})
		// #endregion
		if (!el?.isConnected) return

		let cancelled = false
		import("echarts").then((echarts) => {
			// #region agent log
			_dl('effect1-then', 'import resolved', {
				hypothesisId: 'H3,H4',
				cancelled,
				elStillConnected: el.isConnected,
				elOffsetW: el.offsetWidth,
				elOffsetH: el.offsetHeight,
			})
			// #endregion
			if (cancelled) return
			// #region agent log
			_dl('effect1-pre-init', 'about to call echarts.init', {
				hypothesisId: 'H1,H2',
				elTagName: el.tagName,
				isHTMLDivElement: el instanceof HTMLDivElement,
				isHTMLElement: el instanceof HTMLElement,
				elId: el.id,
				elClassName: el.className,
				parentConnected: el.parentElement?.isConnected ?? false,
				computedWidth: getComputedStyle(el).width,
				computedHeight: getComputedStyle(el).height,
			})
			// #endregion
			try {
				const instance = echarts.init(el, "dark")
				chart = instance
				instance.setOption(option)
				const ro = new ResizeObserver(() => instance.resize())
				resizeObserver = ro
				ro.observe(el)
				// #region agent log
				_dl('effect1-success', 'chart init success', { hypothesisId: 'ALL' })
				// #endregion
			} catch (err) {
				// #region agent log
				_dl('effect1-error', 'echarts.init FAILED', {
					hypothesisId: 'H1,H2',
					error: String(err),
					errorMessage: (err as Error)?.message,
				})
				// #endregion
			}
		})

		return () => {
			// #region agent log
			_dl('effect1-cleanup', 'cleanup called', {
				hypothesisId: 'H3',
				cancelled,
				chartExists: !!chart,
			})
			// #endregion
			cancelled = true
			resizeObserver?.disconnect()
			resizeObserver = null
			const c = chart
			if (c) {
				c.dispose()
				chart = null
			}
		}
	})

	$effect(() => {
		const c = chart
		// #region agent log
		_dl('effect2', 'setOption effect', {
			hypothesisId: 'H5',
			chartExists: !!c,
			optionSeriesLength: Array.isArray(option?.series) ? option.series.length : -1,
		})
		// #endregion
		if (!c) return
		try {
			c.setOption(option, true)
		} catch {
			// ignore if disposed
		}
	})

	onDestroy(() => {
		// #region agent log
		_dl('onDestroy', 'component destroying', {
			hypothesisId: 'H3,H4',
			chartExists: !!chart,
		})
		// #endregion
		resizeObserver?.disconnect()
		resizeObserver = null
		const c = chart
		if (c) {
			c.dispose()
			chart = null
		}
	})
</script>

<div bind:this={container} style="width: 100%; height: {height};"></div>
