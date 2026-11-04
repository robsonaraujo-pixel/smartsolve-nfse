# Serviço único: API Fastify servindo o front compilado. Funciona em Railway, Render, Fly.io, Cloud Run ou qualquer VPS com Docker.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build -w packages/core && npm run build -w apps/web && npm run build -w apps/api

FROM node:22-bookworm-slim
ENV NODE_ENV=production
# openssl é usado para abrir o PFX (A1)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/core/package.json packages/core/
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/web/package.json apps/web/
RUN npm ci --omit=dev
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/drizzle apps/api/drizzle
COPY --from=build /app/apps/web/dist apps/web/dist
# Dados persistentes (SQLite) ficam em /data — monte um volume aí.
RUN mkdir -p /data
ENV DATABASE_URL=file:/data/nfse.db
ENV PORT=3000
EXPOSE 3000
WORKDIR /app/apps/api
CMD ["node", "dist/src/server.js"]
