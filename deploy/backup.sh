#!/usr/bin/env bash
# Backs up MongoDB and the uploaded files into <backup-dir>/<UTC timestamp>/ and prunes old backups.
#   deploy/backup.sh [backup-dir]                 Docker Compose stack (run from the repo directory)
#   BACKUP_MODE=host deploy/backup.sh [dir]       MongoDB and uploads on this host (MONGODB_URI, UPLOAD_DIR)
# Env: BACKUP_KEEP_DAYS (default 14), MONGO_DB (compose mode, default blog).
set -euo pipefail

dest=${1:-backups}
keep_days=${BACKUP_KEEP_DAYS:-14}
dir="$dest/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$dir"

if [ "${BACKUP_MODE:-compose}" = compose ]; then
    docker compose exec -T mongo mongodump --quiet --db "${MONGO_DB:-blog}" --archive --gzip > "$dir/mongo.archive.gz"
    docker compose cp app:/app/uploads "$dir/uploads"
else
    : "${MONGODB_URI:?set MONGODB_URI}" "${UPLOAD_DIR:?set UPLOAD_DIR}"
    mongodump --quiet --uri "$MONGODB_URI" --archive="$dir/mongo.archive.gz" --gzip
    mkdir -p "$dir/uploads"
    cp -a "$UPLOAD_DIR/." "$dir/uploads/"
fi
tar -czf "$dir/uploads.tar.gz" -C "$dir" uploads
rm -rf "$dir/uploads"
(cd "$dir" && sha256sum mongo.archive.gz uploads.tar.gz > SHA256SUMS)

# Only timestamped backup folders are pruned, never anything else in the directory.
find "$dest" -mindepth 1 -maxdepth 1 -type d -name '20*Z' -mtime +"$keep_days" -exec rm -rf {} +
echo "Backup written to $dir"
