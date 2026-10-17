# VELUNORA — صورة Docker للتشغيل الدائم (المحرّك المحلي أو Firebase)
#
# الاستخدام:
#   docker build -t velunora .
#   docker run -d --name velunora -p 3000:3000 \
#     -e SESSION_SECRET="..." -e APP_URL="https://your-domain" \
#     -v velunora_data:/app/var \
#     velunora
#
# مهم: مجلد البيانات `var/` يُوصَل بحجم دائم (volume) حتى لا تُفقد الطلبات/العملاء.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# sharp يحتاج بعض المكتبات على Debian slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# قيمة مؤقتة للتوقيع أثناء البناء فقط (لا تُستخدم في التشغيل)
ENV SESSION_SECRET=build-time-placeholder-not-used-at-runtime
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 10001 velunora
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/seeds ./seeds
COPY --from=builder /app/tools ./tools
# مجلد البيانات (يُوصَل بحجم دائم عند التشغيل)
RUN mkdir -p /app/var && chown -R velunora:velunora /app/var
USER velunora
EXPOSE 3000
VOLUME ["/app/var"]
CMD ["npm", "start"]
