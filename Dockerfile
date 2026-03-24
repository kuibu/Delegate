FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile \
  && pnpm db:generate \
  && pnpm build

EXPOSE 3000 3001 3002

CMD ["pnpm", "--filter", "@delegate/dashboard", "start"]
