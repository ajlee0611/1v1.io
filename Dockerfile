FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json packages/shared/
COPY packages/server/package*.json packages/server/
RUN npm ci

# Copy root TypeScript config files so child tsconfigs can extend them
COPY tsconfig*.json ./

COPY packages/shared packages/shared
COPY packages/server packages/server
RUN npm run build:shared && npm --workspace=@1v1/server run build

FROM node:20-slim
WORKDIR /app

COPY package*.json ./
COPY --from=builder /app/packages/shared packages/shared
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/server/package*.json packages/server/
RUN npm ci --omit=dev

ENV PORT=3001
EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]