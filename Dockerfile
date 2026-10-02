# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app/site
COPY site/package*.json ./
RUN npm ci --no-audit --no-fund
COPY site/ ./
RUN npm run build:production

FROM nginx:alpine
# Avoid sizing worker count to the host CPU count for this small static service.
RUN sed -i "s/worker_processes  auto;/worker_processes  2;/" /etc/nginx/nginx.conf
COPY --from=builder /app/site/dist /usr/share/nginx/html
COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
