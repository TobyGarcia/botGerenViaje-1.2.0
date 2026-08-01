#!/bin/sh
set -eu

CONFIG_SOURCE="/etc/ngrok/base.yml"
CONFIG_RUNTIME="/tmp/ngrok.yml"
MINI_DOMAIN="${NGROK_MINI_APP_DOMAIN:-${NGROK_DOMAIN:-}}"

normalize_url() {
  case "$1" in
    http://*|https://*) printf '%s' "$1" ;;
    *) printf 'https://%s' "$1" ;;
  esac
}

cp "$CONFIG_SOURCE" "$CONFIG_RUNTIME"

if [ -n "$MINI_DOMAIN" ]; then
  MINI_URL="$(normalize_url "$MINI_DOMAIN")"
  sed "/name: mini-app/a\\    url: $MINI_URL" "$CONFIG_RUNTIME" > "${CONFIG_RUNTIME}.next"
  mv "${CONFIG_RUNTIME}.next" "$CONFIG_RUNTIME"
fi

exec ngrok start --all --config "$CONFIG_RUNTIME"
