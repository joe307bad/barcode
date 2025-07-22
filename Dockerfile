# Use official Node.js runtime as base image
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code (excluding node_modules)
COPY src/ ./src/
COPY index.html ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Build the app
RUN npm run build

# Use nginx to serve the built app
FROM nginx:alpine

# Copy built app to nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config if needed (optional)
# COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]