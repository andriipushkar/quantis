FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/api-gateway/package.json server/api-gateway/
COPY shared/package.json shared/
RUN npm install -w server/api-gateway -w shared
COPY shared/ shared/
COPY server/api-gateway/ server/api-gateway/
WORKDIR /app/server/api-gateway
RUN npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server/api-gateway/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/api-gateway/package.json .
EXPOSE 3001
CMD ["node", "dist/index.js"]
