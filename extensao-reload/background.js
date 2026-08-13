chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "monitor_aba") return;

    const tabId = port.sender.tab.id;

    port.onDisconnect.addListener(() => {
        // Verifica se a aba ainda existe (não foi fechada intencionalmente pelo usuário)
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                // A aba foi fechada pelo usuário, não fazemos nada.
                console.log(`Aba ${tabId} fechada normalmente.`);
            } else {
                // A aba ainda existe, mas a conexão caiu. Provável crash ou recarregamento manual.
                // Como não queremos recarregar uma aba que o usuário está navegando, 
                // você pode adicionar lógicas extras aqui, mas a base de reload é:
                console.log(`Aba ${tabId} desconectou inesperadamente. Recarregando...`);
                chrome.tabs.reload(tabId);
            }
        });
    });
});
