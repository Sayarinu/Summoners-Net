# Build from the repository root (docker build -f deploy/Dockerfile .); BuildKit applies
# deploy/Dockerfile.dockerignore to that context.
FROM node:26.13.0-bookworm-slim@sha256:add5c17c14752c54d2f3d519ec46a3815684d41c33f198bcb09fb998f7dcbf68 AS build
ENV NEXT_TELEMETRY_DISABLED=1 STORYBOOK_DISABLE_TELEMETRY=1 TURBO_TELEMETRY_DISABLED=1 CI=1
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/data/package.json ./packages/data/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/tokens/package.json ./packages/tokens/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm --filter @summonersnet/data deploy --prod --legacy /worker

FROM node:26.13.0-bookworm-slim@sha256:add5c17c14752c54d2f3d519ec46a3815684d41c33f198bcb09fb998f7dcbf68 AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /worker ./worker
RUN mkdir -p /app/.local/imports && chown -R node:node /app/.local
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
