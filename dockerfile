# Use the latest LTS version of Node.js
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Set environment variables (optional)
# ENV NODE_ENV=production

# Start the bot
CMD ["node", "src/index.js"]