FROM node:20-bookworm-slim

WORKDIR /app

# Install build deps for native modules (needed by sia-storage)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN mkdir -p /app/data

EXPOSE 4000

CMD ["node", "dist/index.js"]