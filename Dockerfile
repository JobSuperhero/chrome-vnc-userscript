FROM debian:bookworm-slim

ARG TARGETARCH

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    HOME=/home/chrome \
    CHROME_USER_DATA_DIR=/home/chrome/.config/google-chrome \
    SCREEN_RESOLUTION=1366x768 \
    SCRIPT_MODE=native \
    TZ=Etc/UTC

# Google Chrome e um ambiente X propositalmente mínimo. KasmVNC/webtop foi
# evitado aqui porque traz um desktop completo desnecessário para um navegador.
RUN if [ "$TARGETARCH" != "amd64" ] && [ -n "$TARGETARCH" ]; then \
      echo "Esta imagem usa Google Chrome e requer linux/amd64." >&2; exit 1; \
    fi \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg gosu tini \
        dbus-x11 fonts-liberation fonts-noto-color-emoji \
        novnc openbox websockify x11vnc xvfb \
    && install -d -m 0755 /etc/apt/keyrings \
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
        | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && useradd --create-home --uid 1000 --shell /bin/bash chrome \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Esta política baixa o Tampermonkey assinado da Chrome Web Store no primeiro
# boot em modo tampermonkey. O navegador precisa de internet nesse primeiro uso.
COPY chrome-policy/tampermonkey.json /etc/opt/chrome/policies/managed/tampermonkey.json
COPY extension/ /opt/userscript-loader/
COPY script.js /opt/userscript-loader/script.js
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod 0755 /usr/local/bin/entrypoint.sh \
    && chown -R chrome:chrome /home/chrome /opt/userscript-loader

EXPOSE 5900 6080
VOLUME ["/home/chrome/.config/google-chrome"]

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
