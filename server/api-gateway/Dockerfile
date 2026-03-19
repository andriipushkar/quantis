FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/api-gateway/package.json server/api-gateway/
COPY shared/package.json shared/

RUN npm install -w server/api-gateway -w shared

COPY shared/ shared/
COPY server/api-gateway/ server/api-gateway/

WORKDIR /app/server/api-gateway

CMD ["npx", "tsx", "watch", "src/index.ts"]
