# ================================
# DeskPet Authoritative Game Server
# Multi-stage Docker build
# ================================

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Stage 2: Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Security: run as non-root
RUN addgroup --system --gid 1001 deskpet && \
    adduser --system --uid 1001 deskpet

COPY --from=deps /app/node_modules ./node_modules
COPY server.js ./

# Environment variables are injected at runtime (never baked in)
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

USER deskpet

# Health check for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
