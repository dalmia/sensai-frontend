# Stage 1: Dependencies
FROM node:22.12-alpine AS deps
WORKDIR /app

# Install dependencies only when needed
COPY package.json package-lock.json ./
RUN npm ci --include=dev --prefer-offline --no-audit

# Stage 2: Builder
FROM node:22.12-alpine AS builder
WORKDIR /app

# Define build arguments
ARG NODE_ENV
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG BACKEND_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG JUDGE0_API_URL
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_NOTION_CLIENT_ID
ARG NOTION_CLIENT_ID
ARG NOTION_CLIENT_SECRET

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=${NODE_ENV}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV BACKEND_URL=${BACKEND_URL}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
ENV GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV JUDGE0_API_URL=${JUDGE0_API_URL}
ENV NOTION_CLIENT_ID=${NOTION_CLIENT_ID}
ENV NEXT_PUBLIC_NOTION_CLIENT_ID=${NEXT_PUBLIC_NOTION_CLIENT_ID}
ENV NOTION_CLIENT_SECRET=${NOTION_CLIENT_SECRET}

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application files
COPY . .

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:22.12-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
