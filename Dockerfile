# syntax=docker/dockerfile:1

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Instala dependencias con cache de capas
COPY package*.json ./
RUN npm ci

# Copia el código y construye los estáticos
COPY . .
RUN npm run build

# ---------- Stage 2: serve (nginx) ----------
FROM nginx:alpine AS runtime

# wget viene incluido en nginx:alpine (busybox) para el healthcheck
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
