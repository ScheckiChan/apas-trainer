# APAS-Trainer web (static PWA served by nginx, /api proxied to the api service).
# Build context is the repo root:
#   docker build -f apps/web/Dockerfile .

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @apas/shared && npm run build -w @apas/web

# ---- runtime ----
FROM nginx:1.27-alpine
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
ENV API_UPSTREAM=http://api:3001
EXPOSE 80
