FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
RUN pnpm --dir dashboard build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN groupadd --gid 1001 aster && \
    useradd --uid 1001 --gid aster --shell /bin/bash --create-home aster

COPY --from=build /app/dist ./dist
COPY --from=build /app/dashboard/.output ./dashboard/.output
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

USER aster

EXPOSE 3000

CMD ["node", "dist/src/index.js"]
