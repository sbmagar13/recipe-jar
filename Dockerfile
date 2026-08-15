# Self-hosted Recipe Jar: static build + the portable link-fetch proxy.
# The app itself runs entirely in the browser; the container only serves
# files and fetches recipe pages on the user's behalf. No telemetry.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server/server.mjs ./server.mjs
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server.mjs"]
