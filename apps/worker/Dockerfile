# Import worker. The M2 spike ruled kitinerary-extractor out of this image
# (not packaged in Debian; Alpine ships only the library at ~640MB of Qt) —
# extraction is schema.org + capped LLM; KITINERARY_BIN stays an optional
# hook if that ever changes. See tracker ticket 017.
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
