# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --silent

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy .env file handling script
COPY env-config.js /usr/share/nginx/html/
COPY env-config.sh /docker-entrypoint.d/

# Make the script executable
RUN chmod +x /docker-entrypoint.d/env-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]