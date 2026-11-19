# syntax=docker/dockerfile:1.7
# منصة لغتي — صورة إنتاج (Next.js standalone + Prisma + Chromium لتوليد PDF)
#
#   docker build -t lughati .
#     صورة التشغيل الافتراضية: صورة Playwright الرسمية (Chromium ومتطلباته مثبتة مسبقاً) — PDF على الخادم.
#   docker build --build-arg RUNNER_IMAGE=node:22-bookworm --build-arg WITH_PDF=false -t lughati .
#     أخف: بلا Chromium (PDF من المتصفح فقط).
#
# خلف وكيل شبكة بشهادة خاصة (شائع في الشبكات المؤسسية):
#   docker build --secret id=extra_ca,src=/path/ca.crt --build-arg HTTPS_PROXY=... -t lughati .
#   (الشهادة تُستخدم وقت البناء فقط ولا تبقى في الصورة)
# لا يُستخدم apt إطلاقاً: كل المتطلبات النظامية موجودة في الصور الأساسية.

ARG RUNNER_IMAGE=mcr.microsoft.com/playwright:v1.65.1-noble

FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --no-audit --no-fund

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone SKIP_ENV_CHECK=true
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npx prisma generate && npm run build

FROM ${RUNNER_IMAGE} AS runner
ARG WITH_PDF=true
ARG PLAYWRIGHT_VERSION=1.65.1
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    if [ "$WITH_PDF" = "true" ]; then npm install -g --no-audit --no-fund playwright-core@$PLAYWRIGHT_VERSION && rm -rf /root/.npm; \
    else echo "PDF_ENGINE=browser" > /app/.pdf-disabled; fi
RUN (getent group app || groupadd -r app) && (id app || useradd -r -g app -d /app app)
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
# Prisma CLI لتطبيق الترحيلات عند الإقلاع
COPY --from=build --chown=app:app /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=app:app /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
# لسكربت إنشاء مدير النظام (deploy/create-admin.cjs)
COPY --from=build --chown=app:app /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --chown=app:app deploy/create-admin.cjs deploy/setup-year.cjs ./deploy/
COPY --chown=app:app deploy/entrypoint.sh ./entrypoint.sh
RUN mkdir -p /app/.data/uploads && chown -R app:app /app && chmod +x entrypoint.sh
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./entrypoint.sh"]
