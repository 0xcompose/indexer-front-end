FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY svelte.config.js vite.config.ts tsconfig.json ./
RUN npm ci

COPY static ./static
COPY src ./src

# Used by compose `build.args` — URL must be reachable from the *browser*
ARG PUBLIC_GRAPHQL_URL=http://localhost:8080/v1/graphql
ENV PUBLIC_GRAPHQL_URL=$PUBLIC_GRAPHQL_URL

# Same-origin path proxied by nginx to token-api (docker compose); leave unset for static deploys without token-api.
ARG PUBLIC_TOKEN_METADATA_RPC_URL=
ENV PUBLIC_TOKEN_METADATA_RPC_URL=$PUBLIC_TOKEN_METADATA_RPC_URL

RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
