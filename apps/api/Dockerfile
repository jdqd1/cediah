FROM node:24-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile --filter @cediah/api... --filter @cediah/contracts...

COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN pnpm --filter @cediah/contracts build && pnpm --filter @cediah/api build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S cediah && adduser -S cediah -G cediah

COPY --from=build --chown=cediah:cediah /app/node_modules ./node_modules
COPY --from=build --chown=cediah:cediah /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=cediah:cediah /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=cediah:cediah /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=cediah:cediah /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=cediah:cediah /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=build --chown=cediah:cediah /app/packages/contracts/dist ./packages/contracts/dist

USER cediah
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
