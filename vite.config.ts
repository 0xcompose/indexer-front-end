import { fileURLToPath } from "node:url"
import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, loadEnv } from "vite"

/** Same-origin path in dev; Vite proxies to `TOKEN_METADATA_PROXY_TARGET`. */
export const TOKEN_METADATA_DEV_PROXY_PATH = "/__token-metadata__"

const projectRoot = fileURLToPath(new URL(".", import.meta.url))

/** Origin only for http-proxy; path (e.g. /rpc) applied in rewrite. */
function proxyOriginAndPath(targetUrl: string): { origin: string; upstreamPath: string } {
	const u = new URL(targetUrl)
	const origin = `${u.protocol}//${u.host}`
	let p = u.pathname
	if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1)
	const upstreamPath = p === "" ? "/" : p
	return { origin, upstreamPath }
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, projectRoot, "")
	const proxyTargetRaw = env.TOKEN_METADATA_PROXY_TARGET?.trim()

	const proxy =
		mode === "development" && proxyTargetRaw
			? (() => {
					const { origin, upstreamPath } = proxyOriginAndPath(proxyTargetRaw)
					const esc = TOKEN_METADATA_DEV_PROXY_PATH.replace(
						/[.*+?^${}()|[\]\\]/g,
						"\\$&",
					)
					return {
						[TOKEN_METADATA_DEV_PROXY_PATH]: {
							target: origin,
							changeOrigin: true,
							secure: false,
							rewrite: (path: string) => {
								const rest = path.replace(new RegExp(`^${esc}`), "")
								if (rest === "") return upstreamPath
								const join =
									upstreamPath.endsWith("/") || rest.startsWith("/")
										? ""
										: "/"
								return `${upstreamPath}${join}${rest}`
							},
						},
					}
				})()
			: undefined

	return {
		plugins: [tailwindcss(), sveltekit()],
		build: {
			chunkSizeWarningLimit: 1500,
		},
		...(proxy ? { server: { proxy } } : {}),
	}
})
