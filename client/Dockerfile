# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY client/package.json client/
COPY shared/package.json shared/
RUN npm install -w client -w shared
COPY shared/ shared/
COPY client/ client/
WORKDIR /app/client
RUN npx vite build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY docker/nginx/client.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
