FROM node:22-alpine AS build

WORKDIR /app
ARG VITE_API_BASE_URL=""
ARG VITE_APPROVER_CHANNEL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APPROVER_CHANNEL=${VITE_APPROVER_CHANNEL}

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK \
  --interval=10s \
  --timeout=5s \
  --retries=5 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
