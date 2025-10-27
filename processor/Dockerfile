# Dockerfile for Event-Based Processor
FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY processor/package*.json ./

# Install Node dependencies
RUN npm install

# Copy processor files
COPY processor/*.js ./

# Set environment variables (will be overridden by Cloud Run)
ENV NODE_ENV=production

# Run the parallel processor
ENTRYPOINT ["node", "run-parallel.js"]