FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy server file
COPY server.js ./

# Copy React build files (they are in the root directory)
COPY static/ ./static/
COPY fonts/ ./fonts/
COPY index.html ./
COPY manifest.json ./
COPY robots.txt ./
COPY sitemap.xml ./
COPY favicon.ico ./
COPY logo.png ./
COPY asset-manifest.json ./

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
