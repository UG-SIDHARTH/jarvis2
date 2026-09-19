# Use official Node.js 22 LTS Alpine image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install build dependencies if needed for native modules
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy project source code and configuration
COPY src/ ./src/
COPY README.md ./

# Create data directory for persistent memory storage
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user
USER node

# Environment defaults
ENV NODE_ENV=production
ENV DATA_PATH=/app/data/jarvis_store.json
ENV PORT=3001

EXPOSE 3001

# Expose volume for persistent memory
VOLUME ["/app/data"]

# Default command: launch all configured gateways (Telegram, Discord, CLI)
CMD ["node", "--experimental-strip-types", "src/index.ts", "--all"]
