# Use official Node.js 22 LTS Alpine image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy project source code, web dashboard assets, and configuration
COPY src/ ./src/
COPY public/ ./public/
COPY README.md ./

# Create data directory for persistent memory storage
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user
USER node

# Environment defaults
ENV NODE_ENV=production
ENV DATA_PATH=/app/data/jarvis.db
ENV PORT=3001

EXPOSE 3001

# Expose volume for persistent memory
VOLUME ["/app/data"]

# Default command: launch all configured gateways with optimized 512MB RAM heap limit
CMD ["node", "--experimental-strip-types", "--max-old-space-size=512", "src/index.ts", "--all"]
