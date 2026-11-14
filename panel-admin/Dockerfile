FROM node:22-alpine AS build

WORKDIR /app/panel-admin
ARG VITE_API_BASE_URL=""
ARG VITE_APPROVER_CHANNEL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APPROVER_CHANNEL=${VITE_APPROVER_CHANNEL}

COPY panel-admin/package*.json ./

RUN npm ci

COPY panel-admin/src ./src
COPY panel-admin/public ./public
COPY panel-admin/index.html panel-admin/vite.config.js ./
COPY frontend/src/services/update-checker.js /app/frontend/src/services/update-checker.js
COPY backend/src/utils/approval-policy.js backend/src/utils/manejo-authorization-policy.js /app/backend/src/utils/

RUN npm run build


FROM nginx:1.27-alpine

COPY panel-admin/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/panel-admin/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK \
  --interval=10s \
  --timeout=5s \
  --retries=5 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
