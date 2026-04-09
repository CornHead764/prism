#!/bin/sh
# Prism Database Backup Script
# Runs inside the backup container, dumps PostgreSQL to /backups volume
# Optionally syncs to cloud storage via rclone

set -e

BACKUP_DIR="/backups"
RETENTION_DAYS=${RETENTION_DAYS:-7}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/prism_$TIMESTAMP.sql.gz"

echo "[$(date)] Starting backup..."

# Create backup with compression
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h db \
  -U prism \
  -d prism \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_FILE"

# Check if backup was created successfully
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup completed: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date)] ERROR: Backup failed!"
  exit 1
fi

# Remove backups older than retention period
echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "prism_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# List current backups
echo "[$(date)] Current backups:"
ls -lh "$BACKUP_DIR"/prism_*.sql.gz 2>/dev/null || echo "  (none)"

# Off-site backup via rclone (if configured)
if [ -n "$RCLONE_REMOTE" ] && command -v rclone >/dev/null 2>&1; then
  echo "[$(date)] Syncing database backup to off-site storage: $RCLONE_REMOTE..."
  if rclone copy "$BACKUP_FILE" "$RCLONE_REMOTE" --progress; then
    echo "[$(date)] Database backup sync completed successfully"

    # Clean up old remote backups too
    if [ -n "$RCLONE_RETENTION_DAYS" ]; then
      echo "[$(date)] Cleaning remote backups older than $RCLONE_RETENTION_DAYS days..."
      rclone delete "$RCLONE_REMOTE" --min-age "${RCLONE_RETENTION_DAYS}d" 2>/dev/null || true
    fi
  else
    echo "[$(date)] WARNING: Database backup off-site sync failed!"
  fi

  # Sync user-uploaded file assets (avatars, etc.)
  UPLOADS_REMOTE="${RCLONE_REMOTE%/*}/uploads"
  if [ -d "/uploads" ] && [ "$(ls -A /uploads 2>/dev/null)" ]; then
    echo "[$(date)] Syncing uploads directory to off-site storage: $UPLOADS_REMOTE..."
    if rclone sync /uploads "$UPLOADS_REMOTE" --progress; then
      echo "[$(date)] Uploads sync completed successfully"
    else
      echo "[$(date)] WARNING: Uploads off-site sync failed!"
    fi
  else
    echo "[$(date)] Uploads directory is empty or missing, skipping."
  fi
elif [ -n "$RCLONE_REMOTE" ]; then
  echo "[$(date)] WARNING: RCLONE_REMOTE set but rclone not installed"
fi

echo "[$(date)] Backup process complete."
