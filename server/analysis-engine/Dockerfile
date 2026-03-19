FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/analysis-engine/package.json server/analysis-engine/
COPY shared/package.json shared/

RUN npm install -w server/analysis-engine -w shared

COPY shared/ shared/
COPY server/analysis-engine/ server/analysis-engine/

WORKDIR /app/server/analysis-engine

CMD ["npx", "tsx", "watch", "src/index.ts"]
