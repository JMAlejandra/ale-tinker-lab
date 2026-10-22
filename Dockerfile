# Dev-only image. No multi-stage build, no prod target — see docs/adr/0001-dev-only-docker-scope.md
FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
