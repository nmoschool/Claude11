#!/usr/bin/env bash
# نسخة احتياطية مشفّرة لقاعدة البيانات وملفات الطالبات — docs القسم 7.5 (قاعدة 3-2-1)
#
#   BACKUP_DIR=/var/backups/lughati BACKUP_PASSPHRASE_FILE=/etc/lughati/backup.pass ./scripts/backup.sh [daily|weekly|term]
#
# - pg_dump بصيغة custom ثم تشفير AES-256 (openssl, PBKDF2 200k).
# - الاحتفاظ: daily 30 نسخة، weekly 12، term دائمة (تُحذف يدوياً بعد 5 سنوات).
# - BACKUP_S3_URI (اختياري): نسخة بعيدة off-site عبر aws cli (يدعم أي مزود متوافق مع S3).
# - مفتاح FIELD_ENCRYPTION_KEY لا يُنسخ هنا عمداً: احفظيه منفصلاً (خزنة كلمات المرور) — بدونه لا تُقرأ الحقول الحساسة.
set -euo pipefail

KIND="${1:-daily}"
case "$KIND" in daily) KEEP=30 ;; weekly) KEEP=12 ;; term) KEEP=0 ;; *) echo "النوع: daily|weekly|term" >&2; exit 2 ;; esac
: "${DATABASE_URL:?DATABASE_URL مطلوب}"
: "${BACKUP_PASSPHRASE_FILE:?BACKUP_PASSPHRASE_FILE مطلوب}"
BACKUP_DIR="${BACKUP_DIR:-./.data/backups}"
FILES_DIR="${FILE_STORAGE_DIR:-.data/uploads}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/$KIND"
mkdir -p "$OUT"
umask 077

DB_URL="${DATABASE_URL%%\?*}" # pg_dump لا يفهم معاملات prisma مثل ?schema=
enc() { openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$BACKUP_PASSPHRASE_FILE"; }

echo "[$(date -u +%FT%TZ)] بدء النسخ ($KIND)"
pg_dump --format=custom --no-owner --no-privileges "$DB_URL" | enc > "$OUT/db-$STAMP.dump.enc"
DB_SIZE=$(stat -c %s "$OUT/db-$STAMP.dump.enc")
if [ "$DB_SIZE" -lt 1024 ]; then echo "✖ ملف النسخة صغير بشكل مريب ($DB_SIZE بايت)" >&2; exit 1; fi
sha256sum "$OUT/db-$STAMP.dump.enc" | awk '{print $1}' > "$OUT/db-$STAMP.dump.enc.sha256"

if [ -d "$FILES_DIR" ] && [ "${FILE_STORAGE_DRIVER:-local}" = "local" ]; then
  tar -C "$FILES_DIR" -cf - . | gzip -6 | enc > "$OUT/files-$STAMP.tar.gz.enc"
fi

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$OUT/db-$STAMP.dump.enc" "$BACKUP_S3_URI/$KIND/" --only-show-errors
  aws s3 cp "$OUT/db-$STAMP.dump.enc.sha256" "$BACKUP_S3_URI/$KIND/" --only-show-errors
  [ -f "$OUT/files-$STAMP.tar.gz.enc" ] && aws s3 cp "$OUT/files-$STAMP.tar.gz.enc" "$BACKUP_S3_URI/$KIND/" --only-show-errors
fi

if [ "$KEEP" -gt 0 ]; then
  for pattern in "db-*.dump.enc" "files-*.tar.gz.enc"; do
    ls -1t "$OUT"/$pattern 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do rm -f "$old" "$old.sha256"; done
  done
fi
echo "[$(date -u +%FT%TZ)] ✅ تم: $OUT/db-$STAMP.dump.enc ($DB_SIZE بايت)"
