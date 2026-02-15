# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app

# Install root deps
COPY package*.json ./
RUN npm ci

# Install server deps
COPY server/package*.json ./server/
RUN cd server && npm ci

# Install client deps
COPY client/package*.json ./client/
RUN cd client && npm ci

# Copy source and build
COPY tsconfig.base.json ./
COPY server/ ./server/
COPY client/ ./client/

# Build client (outputs to dist/client)
RUN cd client && npx vite build

# Build server (outputs to dist/server)
RUN cd server && npx tsc

FROM node:20-alpine AS production
RUN apk add --no-cache wget
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
RUN mkdir -p /data
ENV DATABASE_PATH=/data/bosarsalog.db
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
