#!/usr/bin/env bash
# Local staging: the production Compose stack (app image, MongoDB, Caddy HTTPS, Mailpit as the SMTP server)
# on https://localhost:8443, isolated from any other Compose project and from the host's trust store.
#   deploy/staging.sh up            build the image, seed the blog_e2e database, start everything
#   deploy/staging.sh e2e [args]    re-seed, then run the Playwright suite against the stack (default --project=chromium)
#   deploy/staging.sh down          stop it and delete its volumes
set -euo pipefail
cd "$(dirname "$0")/.."

export COMPOSE_PROJECT_NAME=vedev-staging
export APP_ENV_FILE=deploy/staging/app.env
export APP_PORT=5101 MONGO_PORT=27019 HTTP_PORT=8080 HTTPS_PORT=8443 MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026
export COMPOSE_MONGODB_URI=mongodb://mongo:27017/blog_e2e SITE_DOMAIN=localhost
SITE="https://localhost:$HTTPS_PORT"
HOST_MONGODB_URI="mongodb://127.0.0.1:$MONGO_PORT/blog_e2e"

compose() { docker compose --profile proxy --profile mail "$@"; }

seed() {
    MONGODB_URI="$HOST_MONGODB_URI" npx tsx e2e/seed.ts
    # The seed drops the database; a restart rebuilds the indexes on the fresh one.
    compose restart app
    compose up -d --wait app
}

case "${1:-}" in
    up)
        mkdir -p deploy/staging
        if [ ! -f "$APP_ENV_FILE" ]; then
            vapid=$(npx web-push generate-vapid-keys --json)
            cat > "$APP_ENV_FILE" <<ENV
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_URL=$SITE
SITE_URL=$SITE
SMTP_HOST=mailpit
SMTP_PORT=1025
MAIL_FROM="Vedev.Guru Staging <no-reply@localhost>"
VAPID_PUBLIC_KEY=$(node -p "JSON.parse(process.argv[1]).publicKey" "$vapid")
VAPID_PRIVATE_KEY=$(node -p "JSON.parse(process.argv[1]).privateKey" "$vapid")
VAPID_CONTACT_EMAIL=mailto:staging@example.com
OPERATOR_NAME="Staging Operator"
OPERATOR_LOCATION="Thane, Maharashtra, India"
CONTACT_EMAIL=contact@example.com
ENV
        fi
        compose build app
        compose up -d --wait mongo mailpit
        MONGODB_URI="$HOST_MONGODB_URI" npx tsx e2e/seed.ts
        compose up -d --wait app caddy
        echo "Staging is up on $SITE (inbox: http://127.0.0.1:$MAILPIT_UI_PORT)"
        ;;
    e2e)
        shift
        # One project per run, like npm run test:e2e: every project expects a freshly seeded database.
        [ $# -eq 0 ] && set -- --project=chromium
        seed
        E2E_BASE_URL="$SITE" E2E_MONGODB_URI="$HOST_MONGODB_URI" E2E_MAILPIT_URL="http://127.0.0.1:$MAILPIT_UI_PORT" \
            npx playwright test "$@"
        ;;
    down)
        compose down -v
        ;;
    *)
        echo "usage: deploy/staging.sh up | e2e [playwright args] | down" >&2
        exit 1
        ;;
esac
