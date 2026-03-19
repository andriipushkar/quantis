FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/data-collector/package.json server/data-collector/
COPY shared/package.json shared/

RUN npm install -w server/data-collector -w shared

COPY shared/ shared/
COPY server/data-collector/ server/data-collector/

WORKDIR /app/server/data-collector

CMD ["npx", "tsx", "watch", "src/index.ts"]
