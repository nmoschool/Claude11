#!/bin/sh
# يطبّق ترحيلات قاعدة البيانات (آمنة ومتسلسلة) ثم يشغّل الخادم
set -e
[ -f /app/.pdf-disabled ] && export PDF_ENGINE="${PDF_ENGINE:-browser}"
# مسار الحزم العامة (playwright-core) يختلف بين الصور الأساسية — نسأل npm عنه
NODE_PATH="$(npm root -g 2>/dev/null)${NODE_PATH:+:$NODE_PATH}"
export NODE_PATH
echo "[lughati] تطبيق ترحيلات قاعدة البيانات..."
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
echo "[lughati] بدء الخادم على المنفذ ${PORT:-3000}"
exec node server.js
