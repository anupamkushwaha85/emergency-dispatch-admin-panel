# Use Node version that supports our Vite configuration
FROM node:20-alpine AS build

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of our application code
COPY . .

# Build the React application for production
# Important for Vercel: Provide build-time environment variables IF they are required during the build process
# We will rely on Vercel's environment variables being injected at runtime, or we build on Vercel
RUN npm run build

# We use NGINX to serve our static files, which is faster and more production-ready than a Node server
FROM nginx:alpine

# Copy the build output from the `build` stage to nginx's serving directory
COPY --from=build /app/dist /usr/share/nginx/html

# Replace the default Nginx configuration to support React Router (SPA fallback)
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d

# Expose port 80 (Standard for HTTP)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
