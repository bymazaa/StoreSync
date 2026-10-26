FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Baked into the static metadata (og:image / canonical URLs) at build time.
ARG APP_URL
ENV APP_URL=${APP_URL:-http://localhost:3000}

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
