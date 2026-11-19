#!/usr/bin/env bash
# استعادة نسخة قاعدة البيانات إلى قاعدة «هدف» (لا تستعيدي فوق الإنتاج مباشرة: استعيدي لقاعدة جديدة ثم بدّلي الاتصال)
#   BACKUP_PASSPHRASE_FILE=... ./scripts/restore.sh <file.dump.enc> <TARGET_DATABASE_URL>
set -euo pipefail
FILE="${1:?ملف النسخة}"; TARGET="${2:?رابط القاعدة الهدف}"
: "${BACKUP_PASSPHRASE_FILE:?BACKUP_PASSPHRASE_FILE مطلوب}"
if [ -f "$FILE.sha256" ] && [ "$(sha256sum "$FILE" | awk '{print $1}')" != "$(cat "$FILE.sha256")" ]; then
  echo "✖ بصمة الملف لا تطابق — الملف تالف أو معدّل" >&2; exit 1
fi
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$BACKUP_PASSPHRASE_FILE" -in "$FILE" \
  | pg_restore --no-owner --no-privileges --exit-on-error --dbname="${TARGET%%\?*}"
echo "✅ تمت الاستعادة إلى القاعدة الهدف"
