#!/bin/sh
set -eu

log() {
  printf '%s %s\n' "[chrome-vnc]" "$*"
}

case "${SCRIPT_MODE}" in
  native|tampermonkey|none) ;;
  *)
    log "SCRIPT_MODE invalido: ${SCRIPT_MODE}. Use native, tampermonkey ou none."
    exit 64
    ;;
esac

case "${SCREEN_RESOLUTION}" in
  *x*) ;;
  *)
    log "SCREEN_RESOLUTION invalida: ${SCREEN_RESOLUTION}. Exemplo: 1366x768"
    exit 64
    ;;
esac

if [ -n "${VNC_PASSWORD_FILE:-}" ]; then
  if [ ! -r "$VNC_PASSWORD_FILE" ]; then
    log "VNC_PASSWORD_FILE nao pode ser lido: ${VNC_PASSWORD_FILE}"
    exit 64
  fi
  VNC_PASSWORD=$(tr -d '\r\n' < "$VNC_PASSWORD_FILE")
  export VNC_PASSWORD
fi

if [ -z "${VNC_PASSWORD:-}" ]; then
  log "VNC_PASSWORD e obrigatoria; configure-a no arquivo .env."
  exit 64
fi

if [ "${#VNC_PASSWORD}" -gt 8 ]; then
  log "VNC_PASSWORD tem mais de 8 caracteres; x11vnc usara somente os primeiros 8."
fi

mkdir -p "$CHROME_USER_DATA_DIR" /tmp/runtime-chrome
chown -R chrome:chrome "$CHROME_USER_DATA_DIR" /tmp/runtime-chrome

# O arquivo fica fora do volume persistente para que a senha seja aplicada a
# cada boot e jamais seja gravada no perfil do Chrome.
umask 077
x11vnc -storepasswd "$VNC_PASSWORD" /tmp/runtime-chrome/vnc-passwd >/dev/null
chown chrome:chrome /tmp/runtime-chrome/vnc-passwd

cleanup() {
  for pid in "${CHROME_PID:-}" "${NOVNC_PID:-}" "${VNC_PID:-}" "${OPENBOX_PID:-}" "${XVFB_PID:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  for pid in "${CHROME_PID:-}" "${NOVNC_PID:-}" "${VNC_PID:-}" "${OPENBOX_PID:-}" "${XVFB_PID:-}"; do
    [ -n "$pid" ] && wait "$pid" 2>/dev/null || true
  done
  rm -f /tmp/.X99-lock
}
trap cleanup INT TERM EXIT

gosu chrome Xvfb :99 -screen 0 "${SCREEN_RESOLUTION}x24" -ac -nolisten tcp +extension RANDR +extension GLX &
XVFB_PID=$!

# Aguarda o socket X estar disponível sem depender de utilitários extras.
attempt=0
while [ ! -S /tmp/.X11-unix/X99 ]; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 100 ] || { log "Xvfb nao iniciou."; exit 1; }
  sleep 0.1
done

gosu chrome openbox --sm-disable &
OPENBOX_PID=$!
gosu chrome x11vnc -display :99 -forever -shared -rfbport 5900 \
  -rfbauth /tmp/runtime-chrome/vnc-passwd -noxrecord -noxfixes -noxdamage -xkb &
VNC_PID=$!
gosu chrome websockify --web=/usr/share/novnc 6080 localhost:5900 &
NOVNC_PID=$!

set -- google-chrome-stable \
  --user-data-dir="$CHROME_USER_DATA_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-gpu \
  --password-store=basic \
  --ozone-platform=x11

if [ "$SCRIPT_MODE" = "native" ]; then
  set -- "$@" \
    --disable-extensions-except=/opt/userscript-loader,/opt/extensao-reload \
    --load-extension=/opt/userscript-loader,/opt/extensao-reload
elif [ "$SCRIPT_MODE" = "tampermonkey" ]; then
  log "Tampermonkey sera instalado pela politica do Chrome; aguarde o primeiro boot."
  set -- "$@" \
    --load-extension=/opt/extensao-reload
elif [ "$SCRIPT_MODE" = "none" ]; then
  set -- "$@" \
    --load-extension=/opt/extensao-reload
fi

log "Iniciando Chrome (${SCRIPT_MODE}) em ${SCREEN_RESOLUTION}; noVNC: 6080, VNC: 5900."
gosu chrome "$@" &
CHROME_PID=$!

wait "$CHROME_PID"
