FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY public ./public
COPY data ./data

EXPOSE 8080

CMD ["node", "src/server.js"]
