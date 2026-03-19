FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy source
COPY . .

# Expose dev port
EXPOSE 5173

# Run dev server
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
