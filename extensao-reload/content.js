// Conecta com o background script
const port = chrome.runtime.connect({ name: "monitor_aba" });

// Opcional: enviar pings periódicos para confirmar que está viva
setInterval(() => {
    try {
        port.postMessage({ status: "viva" });
    } catch (e) {
        // Se a porta fechar, o script morre
    }
}, 5000);
