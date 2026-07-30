// ==UserScript==
// @name         Bot de Venda Avançado V7.2 (Híbrido) - Baiak Idle
// @namespace    http://tampermonkey.net/
// @version      7.2
// @description  V7 base + Tiers por JSON isolados apenas na Loot Pouch (fim do ping-pong).
// @match        *://baiakidle.com/jogar/*
// @match        *://www.baiakidle.com/jogar/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    let rotinaEmExecucao = false;

    // Dispara a sequência completa de um clique humano com Shift e Botão Esquerdo
    function shiftClick(element) {
        console.log("🔼 Movendo item raro para a Backpack (Shift + Left Click)...");
        ['mousedown', 'mouseup', 'click'].forEach(eventType => {
            const event = new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: window,
                shiftKey: true,
                button: 0,
                buttons: eventType === 'mousedown' ? 1 : 0
            });
            element.dispatchEvent(event);
        });
    }

    function rightClick(element) {
        console.log("🖱️ Abrindo menu de contexto...");
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, button: 2, buttons: 2 });
        element.dispatchEvent(event);
    }

    function clicarPorTextoExato(textoProcurado) {
        const tags = ['button', 'div', 'span', 'a', 'li']; 
        for (let tag of tags) {
            for (let el of document.querySelectorAll(tag)) {
                if (el.innerText && el.innerText.trim().toLowerCase() === textoProcurado.toLowerCase() && el.offsetWidth > 0) {
                    el.click();
                    return true;
                }
            }
        }
        return false;
    }

    function clicarPorTextoParcial(textoProcurado) {
        const tags = ['button', 'div', 'span', 'a', 'li']; 
        for (let tag of tags) {
            for (let el of document.querySelectorAll(tag)) {
                if (el.innerText && el.innerText.trim().toLowerCase().includes(textoProcurado.toLowerCase()) && el.offsetWidth > 0) {
                    el.click();
                    return true;
                }
            }
        }
        return false;
    }

    function buscarElementos(termoBusca) {
        let encontrados = [];
        for (let el of document.querySelectorAll('div, span, img')) {
            let texto = (el.innerText || el.getAttribute('alt') || el.getAttribute('title') || "").toLowerCase();
            if (texto.includes(termoBusca.toLowerCase()) && el.offsetWidth > 0) {
                encontrados.push(el);
            }
        }
        return encontrados;
    }

    // NOVA FUNÇÃO ISOLADA: Busca itens raros APENAS dentro da Loot Pouch (o <invgrid> de baixo)
    function buscarRaros() {
        let encontrados = [];
        
        // Pega as mochilas da tela (0 = Backpack, 1 = Loot Pouch)
        let grids = document.querySelectorAll('invgrid, .invgrid');
        
        // Se a Loot Pouch estiver aberta
        if (grids.length >= 2) {
            let lootPouch = grids[1]; 
            
            // Vasculha os elementos JSON apenas DENTRO dela
            for (let el of lootPouch.querySelectorAll('[data-cmpitem]')) {
                let cmpData = el.getAttribute('data-cmpitem');
                // Procura os Tiers 3 (Epic), 4 (Legendary) ou 5 (Mythical)
                if (cmpData && cmpData.match(/"tier":\s*([345])/) && el.offsetWidth > 0) {
                    encontrados.push(el);
                }
            }
        }
        return encontrados;
    }

    function inventarioLotado() {
        const matches = [...document.body.innerText.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
        if (matches.length > 0) {
            const ultimoMatch = matches[matches.length - 1]; // Sempre valida pela Loot Pouch
            return parseInt(ultimoMatch[1]) >= parseInt(ultimoMatch[2]); 
        }
        return false;
    }

    function vendaEstaAtiva() {
        for (let el of document.querySelectorAll('div, button, span')) {
            if (el.innerText && el.innerText.trim().toLowerCase() === "venda" && el.offsetWidth > 0) {
                return true;
            }
        }
        return false;
    }

    async function rotinaDeInventario() {
        if (rotinaEmExecucao) return; 
        rotinaEmExecucao = true;

        try {
            // =========================================================
            // ROTINA 1: AÇÕES 100% INDEPENDENTES
            // =========================================================

            // Proteger Raros (Agora ele só enxerga os que estão na bolsa de baixo)
            let raros = buscarRaros();
            for (let i = 0; i < raros.length; i++) {
                let itensAtuais = buscarRaros();
                if (itensAtuais.length > 0) {
                    shiftClick(itensAtuais[0]); 
                    await sleep(300); 
                }
            }

            let bps = buscarElementos("glooth backpack");
            for (let i = 0; i < bps.length; i++) {
                let bpsAtuais = buscarElementos("glooth backpack");
                if (bpsAtuais.length > 0) {
                    rightClick(bpsAtuais[0]); 
                    await sleep(300); 
                    clicarPorTextoExato("destruir");
                    await sleep(300); 
                }
            }

            // =========================================================
            // ROTINA 2: AÇÕES DEPENDENTES DE ESPAÇO E TEMPO
            // =========================================================
            
            let isCheio = inventarioLotado();
            let isVendaLiberada = vendaEstaAtiva();

            // AÇÃO A: Vender Tudo
            if (isCheio && isVendaLiberada) {
                console.log("⚙️ Loot Pouch cheia e venda liberada! Iniciando venda...");
                if (clicarPorTextoExato('venda')) {
                    await sleep(400); 
                    clicarPorTextoExato('vender tudo');
                    console.log("✅ Venda concluída.");
                    await sleep(400);
                }
                rotinaEmExecucao = false;
                return; 
            }

            // AÇÃO B: Abrir Bags
            if (!isCheio && isVendaLiberada) {
                let bags = buscarElementos("glooth bag");
                let limiteTentativas = Math.min(bags.length, 2); 

                for (let i = 0; i < limiteTentativas; i++) {
                    let bagsAtuais = buscarElementos("glooth bag");
                    if (bagsAtuais.length === 0) break;

                    rightClick(bagsAtuais[0]);
                    await sleep(300); 
                    
                    if (clicarPorTextoParcial("abrir tudo")) {
                        console.log("🎒 Abrindo Glooth Bag...");
                        await sleep(600); 
                    } else {
                        document.body.click(); 
                        await sleep(200);
                    }
                }
            } else if (!isCheio && !isVendaLiberada) {
                console.log("⏳ Aguardando tempo da venda carregar para abrir novas bags...");
            }

        } catch (erro) {
            console.error("Erro no Bot:", erro);
        } finally {
            rotinaEmExecucao = false; 
        }
    }

    setInterval(rotinaDeInventario, 2000);

})();