# MonthGrid – Calendar Grid Generator (Kalendarium-Generator)
# Baut die statische Seite und liefert sie mit nginx aus (Port 80, HTTPS macht der Reverse-Proxy davor).
#
#   Dokploy: Build-Typ „Dockerfile“, Container-Port 80 (Einstellungen aus .env.production / Build-Argumenten)
#   docker compose up -d --build        (Einstellungen aus .env, siehe .env.example)

# ---- 1. Build ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG SITE_URL=""
ARG RYBBIT_SCRIPT_URL=""
ARG RYBBIT_SITE_ID=""
ARG SEO_YEAR=""
ENV SITE_URL=$SITE_URL \
    RYBBIT_SCRIPT_URL=$RYBBIT_SCRIPT_URL \
    RYBBIT_SITE_ID=$RYBBIT_SITE_ID \
    SEO_YEAR=$SEO_YEAR
RUN npm run build

# ---- 2. Auslieferung ----
FROM nginx:1.29-alpine
# Rybbit: Script wird beim Start aus RYBBIT_SITE_ID/RYBBIT_SCRIPT_URL eingesetzt (falls nicht schon beim
# Build geschehen); die Adresse für die Content-Security-Policy wird aus der Seite gelesen.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/15-rybbit.envsh /docker-entrypoint.d/15-rybbit.envsh
RUN chmod +x /docker-entrypoint.d/15-rybbit.envsh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
