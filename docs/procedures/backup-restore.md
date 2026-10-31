# Backup and restore

The blog's state lives in two places: the MongoDB database and the uploaded images (`UPLOAD_DIR`; the `uploads` volume in Docker). Both are needed for a usable restore: posts reference images by URL. Secrets (`.env`, VAPID keys) are not in the backup; keep them in a password manager, because a new `AUTH_SECRET` signs everyone out and new VAPID keys break existing push subscriptions.

## Scripts

| Command | What it does |
|---|---|
| `deploy/backup.sh [dir]` | Dumps the Compose stack's database (`mongodump --archive --gzip`, database `MONGO_DB`, default `blog`) and copies the `uploads` volume into `dir/<UTC timestamp>/` (default `dir`: `backups/`), writes `SHA256SUMS`, and deletes timestamped backups older than `BACKUP_KEEP_DAYS` (default 14). |
| `deploy/restore.sh <backup-folder>` | Verifies the checksums, replaces the database's collections (`mongorestore --drop`) and copies the images back into the `uploads` volume. |
| `BACKUP_MODE=host …` | Either script against a MongoDB and upload directory on the host, using `MONGODB_URI` and `UPLOAD_DIR` instead of the Compose services. Needs the MongoDB Database Tools (`mongodump`, `mongorestore`). |

Run both from the repository directory on the server (they call `docker compose` for the running stack). Each backup folder holds `mongo.archive.gz`, `uploads.tar.gz` and `SHA256SUMS`.

## Schedule and offsite copies

A daily cron entry on the server, for example at 03:15:

```cron
15 3 * * * cd /srv/vedev-blog && deploy/backup.sh /var/backups/vedev-blog >> /var/log/vedev-backup.log 2>&1
```

A backup on the same disk doesn't survive losing the server. Copy each new folder offsite right after the backup, for example with `rclone copy /var/backups/vedev-blog remote:vedev-blog-backups` (S3, Backblaze B2, Google Drive and others) or `aws s3 sync`. Turn on the bucket's own versioning or object lock so a compromised server can't delete the history, and encrypt the copies (rclone's `crypt` remote, or `age`/`gpg` before upload) because the dump contains email addresses and password hashes.

Retention: 14 daily backups locally; offsite, keep dailies for 30 days plus monthlies for a year (bucket lifecycle rules). Deleted accounts stay in older backups until those expire, which the privacy policy states.

## Consistency

`mongodump` of a standalone server copies collections one after another, so a write during the dump can appear in one collection and not another (for example a comment without its post's updated count). For a blog this is acceptable at a quiet hour. A managed database (MongoDB Atlas) has its own point-in-time backups; use those instead of `deploy/backup.sh` for the database there, and keep backing up the uploads.

## Restore

1. Pick the backup folder and copy it to the server if it's offsite.
2. Stop writes: `docker compose stop app`.
3. `deploy/restore.sh /var/backups/vedev-blog/<timestamp>`. It refuses to run if a checksum doesn't match.
4. `docker compose start app` and check `GET /api/health`, a post with images, and a sign-in.

Restoring replaces the current data. To inspect a backup without touching production, restore it into another database name: `RESTORE_FROM_DB=blog RESTORE_TO_DB=blog_restore deploy/restore.sh <folder>` (images are left alone in this mode), then drop `blog_restore` when done.

## Restore drill

Test a restore at least once a month and after any change to the stack: restore the latest backup into `blog_restore` as above and compare document counts per collection with production (`mongosh` → `db.getCollectionNames()` and `countDocuments()` on both). A backup that has never been restored isn't a backup.
