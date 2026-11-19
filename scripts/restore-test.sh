#!/usr/bin/env bash
# اختبار الاستعادة الدوري (شهرياً على الأقل): يستعيد أحدث نسخة إلى قاعدة مؤقتة ويتحقق منها ثم يحذفها.
# «النسخة غير المختبرة لا تُعدّ نسخة».
#   ADMIN_DATABASE_URL=postgresql://user@host:5432/postgres BACKUP_PASSPHRASE_FILE=... FIELD_ENCRYPTION_KEY=... ./scripts/restore-test.sh
set -euo pipefail
: "${ADMIN_DATABASE_URL:?رابط قاعدة إدارية لإنشاء قاعدة مؤقتة}"
BACKUP_DIR="${BACKUP_DIR:-./.data/backups}"
LATEST="$(ls -1t "$BACKUP_DIR"/*/db-*.dump.enc 2>/dev/null | head -1 || true)"
[ -n "$LATEST" ] || { echo "✖ لا توجد نسخ في $BACKUP_DIR" >&2; exit 1; }
TMPDB="lughati_restore_test_$(date +%s)"
BASE="${ADMIN_DATABASE_URL%/*}"
T0=$(date +%s)
psql "$ADMIN_DATABASE_URL" -qc "CREATE DATABASE $TMPDB" >/dev/null
trap 'psql "$ADMIN_DATABASE_URL" -qc "DROP DATABASE IF EXISTS $TMPDB" >/dev/null' EXIT
"$(dirname "$0")/restore.sh" "$LATEST" "$BASE/$TMPDB" >/dev/null
DURATION=$(( $(date +%s) - T0 ))
DATABASE_URL="$BASE/$TMPDB" npx --yes tsx "$(dirname "$0")/verify-restore.ts" "$LATEST" "$DURATION"
