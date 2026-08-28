# Import worker. M2's kitinerary spike decides whether the
# kitinerary-extractor binary joins this image (it needs Qt libs — that is
# the spike's question).
FROM node:22-bookworm-slim AS base
RUN corepack enable 2>/dev/null || npm i -g pnpm@11
WORKDIR /repo

COPY pnpm-workspace.yaml package.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile=false --filter @trailhead/worker...

COPY packages/domain packages/domain
COPY apps/worker apps/worker

CMD ["pnpm", "--filter", "@trailhead/worker", "start"]
