# syntax=docker/dockerfile:1

# Build the Qwik static site from the site/ subdirectory
FROM node:22-alpine AS builder
WORKDIR /app/site

COPY site/package*.json ./
RUN npm ci --prefer-offline --no-audit

COPY site/ ./
RUN npm run build.client && npm run build.server && npx vite build -c adapters/static/vite.config.ts

# Serve the static site with nginx
FROM nginx:alpine
COPY --from=builder /app/site/dist /usr/share/nginx/html
COPY --from=builder /app/site/server/assets /usr/share/nginx/html/assets

RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /assets { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
