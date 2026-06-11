FROM node:20-alpine

WORKDIR /app

# Install build deps for native modules (needed by sia-storage WASM)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN mkdir -p /app/data

EXPOSE 4000

CMD ["node", "dist/index.js"]
