#!/usr/bin/env bash
# Variante ohne Docker: baut die Seite und lädt dist/ per rsync auf den Server.
# Aufruf:  ./deploy/deploy-rsync.sh benutzer@server:/var/www/monthgrid
# Einstellungen (SITE_URL, Rybbit) kommen aus .env.
set -euo pipefail
TARGET="${1:?Ziel angeben, z. B. benutzer@server:/var/www/monthgrid}"
cd "$(dirname "$0")/.."
npm ci --no-audit --no-fund
npm run build
rsync -avz --delete dist/ "${TARGET%/}/"
echo "Fertig: dist/ → ${TARGET}"
