FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY svelte.config.js vite.config.ts tsconfig.json ./
COPY src ./src
RUN npm run build


FROM nginx:1.27-alpine AS runner

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

