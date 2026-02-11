FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json knexfile.ts ./
COPY src/ src/
COPY client/ client/
COPY migrations/ migrations/

RUN npx tsc
RUN npx vite build --config client/vite.config.ts

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/client/dist/ client/dist/
COPY --from=builder /app/migrations/ migrations/
COPY knexfile.ts ./

RUN mkdir -p uploads data

EXPOSE 3000

CMD ["node", "dist/index.js"]
