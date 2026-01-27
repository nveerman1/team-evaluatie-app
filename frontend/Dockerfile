# =============================================================================
# Multi-stage Dockerfile for Next.js Frontend (Production)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies - Install node modules
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Install dependencies for node-gyp (needed for some packages)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies using the appropriate package manager
RUN \
    if [ -f pnpm-lock.yaml ]; then \
        corepack enable pnpm && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
        npm ci; \
    else \
        npm install; \
    fi

# -----------------------------------------------------------------------------
# Stage 2: Builder - Build Next.js application
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Build arg coming from docker compose build.args
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ENABLE_DEV_LOGIN

# Make it available to Next.js at build time
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ENABLE_DEV_LOGIN=$NEXT_PUBLIC_ENABLE_DEV_LOGIN

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Set build-time environment variables
# Next.js needs these at build time for static optimization
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# (optional but very useful) fail fast if not set
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL is missing" && exit 1)

# Build Next.js application
RUN \
    if [ -f pnpm-lock.yaml ]; then \
        corepack enable pnpm && pnpm run build; \
    else \
        npm run build; \
    fi

# -----------------------------------------------------------------------------
# Stage 3: Runner - Production runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start Next.js server
CMD ["node", "server.js"]
