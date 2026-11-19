#!/bin/sh
# حاوية النسخ: يومياً 02:00 بتوقيت الرياض، وأسبوعياً يوم الجمعة. السجلات في /backups/backup.log
set -e
apk add --no-cache bash openssl coreutils aws-cli >/dev/null 2>&1 || apk add --no-cache bash openssl coreutils >/dev/null
export DATABASE_URL="postgresql://lughati:$(cat "$DB_PASSWORD_FILE")@db:5432/lughati"
echo "[backup] بدء الجدولة (TZ=$TZ)"
while true; do
  now=$(date +%s)
  target=$(date -d "$(date +%Y-%m-%d) 02:00" +%s 2>/dev/null || date -D "%Y-%m-%d %H:%M" -d "$(date +%Y-%m-%d) 02:00" +%s)
  [ "$target" -le "$now" ] && target=$((target + 86400))
  sleep $((target - now))
  bash /deploy/backup.sh daily >> /backups/backup.log 2>&1 || echo "[backup] ✖ فشل النسخ اليومي $(date)" >> /backups/backup.log
  [ "$(date +%u)" = "5" ] && { bash /deploy/backup.sh weekly >> /backups/backup.log 2>&1 || echo "[backup] ✖ فشل النسخ الأسبوعي" >> /backups/backup.log; }
done
