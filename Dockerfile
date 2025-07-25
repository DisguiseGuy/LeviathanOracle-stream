# Use the latest LTS version of Node.js
FROM node:20-alpine

# Install OS dependencies and create a non-root user
RUN apk add --no-cache build-base python3 make && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application as the non-root user
COPY --chown=appuser:appgroup . .

# Switch to the non-root user
USER appuser

# Start the bot
CMD ["node", "src/index.js"]