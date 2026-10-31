#!/usr/bin/env bash
# Restores a backup made by deploy/backup.sh. Replaces the target database's collections and the uploads.
#   deploy/restore.sh <backup-folder>                 Docker Compose stack (run from the repo directory)
#   BACKUP_MODE=host deploy/restore.sh <folder>       MongoDB and uploads on this host (MONGODB_URI, UPLOAD_DIR)
# Env: MONGO_DB (compose mode, default blog); RESTORE_FROM_DB / RESTORE_TO_DB restore into another
# database name (e.g. a restore drill into blog_restore) instead of overwriting the original.
set -euo pipefail

dir=${1:?usage: deploy/restore.sh <backup-folder>}
(cd "$dir" && sha256sum --check --quiet SHA256SUMS)

rename=()
if [ -n "${RESTORE_TO_DB:-}" ]; then
    rename=(--nsFrom "${RESTORE_FROM_DB:?set RESTORE_FROM_DB}.*" --nsTo "$RESTORE_TO_DB.*")
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
tar -xzf "$dir/uploads.tar.gz" -C "$work"

if [ "${BACKUP_MODE:-compose}" = compose ]; then
    docker compose exec -T mongo mongorestore --quiet --drop --archive --gzip "${rename[@]}" < "$dir/mongo.archive.gz"
    if [ -z "${RESTORE_TO_DB:-}" ]; then
        docker compose cp "$work/uploads/." app:/app/uploads
    fi
else
    : "${MONGODB_URI:?set MONGODB_URI}"
    mongorestore --quiet --drop --uri "$MONGODB_URI" --archive="$dir/mongo.archive.gz" --gzip "${rename[@]}"
    if [ -z "${RESTORE_TO_DB:-}" ]; then
        : "${UPLOAD_DIR:?set UPLOAD_DIR}"
        mkdir -p "$UPLOAD_DIR"
        cp -a "$work/uploads/." "$UPLOAD_DIR/"
    fi
fi
echo "Restored $dir"
