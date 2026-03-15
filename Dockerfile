# ──────────────────────────────────────────────────
# AIRoom Server — Multi-stage Docker Build
# ──────────────────────────────────────────────────
# Stage 1: Build
# Stage 2: Production runtime
# ──────────────────────────────────────────────────

# ── Stage 1: Build ──
FROM node:20-bookworm-slim AS builder

# Install build tools needed by native modules (bcrypt, mediasoup)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy only the packages needed by the server
COPY packages/shared/ ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/server/prisma/ ./apps/server/prisma/
COPY apps/server/tsconfig.json ./apps/server/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy server source code
COPY apps/server/src/ ./apps/server/src/

# Generate Prisma client and build TypeScript
WORKDIR /app/apps/server
RUN pnpm run build

# ── Stage 2: Production Runtime ──
FROM node:20-bookworm-slim AS runner

# Install runtime deps for mediasoup (needs python3 for worker process)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r airoom && useradd -r -g airoom -m airoom

WORKDIR /app

# Copy workspace config and lockfile
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy shared package (referenced at runtime by path)
COPY packages/shared/ ./packages/shared/

# Copy server package.json and prisma schema
COPY apps/server/package.json ./apps/server/
COPY apps/server/prisma/ ./apps/server/prisma/

# Install pnpm and production-only dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --prod

# Copy built output from builder stage
COPY --from=builder /app/apps/server/dist/ ./apps/server/dist/
# Copy generated Prisma client from custom local output
COPY --from=builder /app/apps/server/prisma/generated-client/ ./apps/server/prisma/generated-client/

# Create directories for uploads and logs
RUN mkdir -p /app/apps/server/public/uploads /app/apps/server/logs \
    && chown -R airoom:airoom /app

USER airoom

WORKDIR /app/apps/server

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 3001

# mediasoup RTC ports (UDP)
EXPOSE 40000-49999/udp

CMD ["node", "dist/index.js"]
