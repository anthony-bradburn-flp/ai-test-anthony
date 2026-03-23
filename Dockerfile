# Multi-stage build for production
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev deps needed for build)
RUN npm ci

# Copy source files
COPY . .

# Build client (Vite) and server (esbuild)
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built output from builder stage
COPY --from=builder /app/dist ./dist

# Expose port (EB/ECS use PORT env var; default 5000)
EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/index.cjs"]
