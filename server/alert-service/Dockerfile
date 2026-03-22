FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY server/alert-service/package.json server/alert-service/
COPY shared/package.json shared/

RUN npm install -w server/alert-service -w shared

COPY shared/ shared/
COPY server/alert-service/ server/alert-service/

WORKDIR /app/server/alert-service

CMD ["npx", "tsx", "watch", "src/index.ts"]
