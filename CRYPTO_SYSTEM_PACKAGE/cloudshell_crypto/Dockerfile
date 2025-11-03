FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY crypto-event-generation.js ./

# Run the event generation script
CMD ["node", "crypto-event-generation.js"]