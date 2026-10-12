# ==============================================================================
# STAGE 1: Build React + Vite Mobile Frontend
# ==============================================================================
FROM node:20-alpine AS client-builder
WORKDIR /app/client

# Install frontend dependencies
COPY client/package*.json ./
RUN npm ci

# Copy frontend source and build static assets
COPY client/ ./
RUN npm run build

# ==============================================================================
# STAGE 2: Build Express + Socket.io + Prisma Server
# ==============================================================================
FROM node:20-alpine AS server-builder
WORKDIR /app/server

# Install backend dependencies
COPY server/package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY server/prisma ./prisma
RUN npx prisma generate

# Copy backend TypeScript source and compile
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# ==============================================================================
# STAGE 3: Production Runner Image (Optimized for 8 GB RAM Linux Server)
# ==============================================================================
FROM node:20-alpine AS runner
WORKDIR /app/server

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install openssl for Prisma engine compatibility on Alpine
RUN apk add --no-cache openssl libc6-compat

# Install production dependencies only
COPY server/package*.json ./
RUN npm ci --omit=dev && npm install tsx

# Copy generated Prisma schema and client
COPY server/prisma ./prisma
RUN npx prisma generate

# Copy compiled backend dist from Stage 2
COPY --from=server-builder /app/server/dist ./dist

# Copy compiled frontend dist from Stage 1 (both relative locations for Express)
COPY --from=client-builder /app/client/dist /app/client/dist
COPY --from=client-builder /app/client/dist ./client/dist

# Copy entrypoint script
COPY server/docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Expose internal service port
EXPOSE 3000

# Healthcheck to ensure container is healthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
