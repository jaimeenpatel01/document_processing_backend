# ============================================================
# Multi-stage Dockerfile for Document Processing API
# ============================================================

FROM node:20-alpine AS base

WORKDIR /app

# Install OpenSSL – required by Prisma's query engine on Alpine (musl)
RUN apk add --no-cache openssl

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production=false

# Copy application source
COPY . .

# Generate Prisma client (picks up binaryTargets from schema.prisma)
RUN npx prisma generate

# ── API Service ─────────────────────────────────────────────
FROM base AS api
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]

# ── Worker Service ──────────────────────────────────────────
FROM base AS worker
CMD ["node", "src/workers/documentWorker.js"]
