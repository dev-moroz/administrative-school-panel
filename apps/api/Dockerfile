FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api apps/api
RUN pnpm --filter api exec prisma generate && pnpm --filter api build
RUN pnpm --filter api deploy --prod --legacy /out

# One-shot job: keeps all dependencies (prisma CLI and tsx are needed for migrate/seed).
FROM build AS migrate
WORKDIR /app/apps/api
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec prisma db seed"]

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /out ./
# A named volume mounted here inherits this ownership.
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 4000
CMD ["node", "dist/main"]
