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
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_ENABLE_DEV_LOGIN

# Make it available to Next.js at build time
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_ENABLE_DEV_LOGIN=$NEXT_PUBLIC_ENABLE_DEV_LOGIN

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Set build-time environment variables
# Next.js needs these at build time for static optimization
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# (optional) validate critical environment variables
# Note: NEXT_PUBLIC_API_BASE_URL is optional (defaults to /api/v1)
# Only fail if NEXT_PUBLIC_ENABLE_DEV_LOGIN is not set
RUN test -n "$NEXT_PUBLIC_ENABLE_DEV_LOGIN" || (echo "NEXT_PUBLIC_ENABLE_DEV_LOGIN is missing" && exit 1)

# Build Next.js application
RUN \
    if [ -f pnpm-lock.yaml ]; then \
        corepack enable pnpm && pnpm run build; \
    else \
        npm run build; \
    fi

# Strip devDependencies from all package.json files in the standalone output.
# Production packages (next.js, typescript, etc.) embed devDependencies in their
# package.json files. Trivy's node-pkg scanner traces through them and reports
# false positives for packages that are not actually installed (e.g. minimatch@9.0.5
# via typescript -> @typescript-eslint/utils -> minimatch). Removing devDependencies
# from the standalone node_modules package.json files prevents these false positives.
RUN node -e " \
  const fs = require('fs'), path = require('path'); \
  function strip(dir) { \
    if (!fs.existsSync(dir)) return; \
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { \
      const full = path.join(dir, entry.name); \
      if (entry.isDirectory()) { strip(full); } \
      else if (entry.name === 'package.json') { \
        try { \
          const p = JSON.parse(fs.readFileSync(full, 'utf8')); \
          if (p.devDependencies || p.pnpm || p.overrides) { \
            delete p.devDependencies; delete p.pnpm; delete p.overrides; \
            fs.writeFileSync(full, JSON.stringify(p, null, 2)); \
          } \
        } catch(e) { console.error('strip failed:', full, e.message); } \
      } \
    } \
  } \
  strip('.next/standalone'); \
"

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

# Upgrade npm to v11+ to replace the bundled minimatch@9.x (CVE-2026-26996)
# that ships with Node.js 20's default npm@10. npm@11.6.1+ bundles minimatch@10.x.
RUN npm install -g npm@11.10.0

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
