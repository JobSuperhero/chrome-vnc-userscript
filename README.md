# Chrome + VNC + Userscript (Docker Compose)

Um navegador **Google Chrome** isolado em Docker, acessível por VNC clássico e noVNC, construído para rodar um userscript local ou o Tampermonkey completo.

Ele toma como inspiração a ideia do repositório [JobSuperhero/MetaTrader5-Docker](https://github.com/JobSuperhero/MetaTrader5-Docker): uma aplicação gráfica em Linux acessada remotamente pelo navegador. Aqui, porém, removemos Wine, MetaTrader e a camada de desktop completa. A imagem fica somente com Chrome, Xvfb, Openbox, x11vnc e noVNC.

## Início rápido

1. Copie o ambiente e escolha uma senha VNC de até 8 caracteres:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Coloque o userscript em `script.js` e escolha `SCRIPT_MODE=native` ou `SCRIPT_MODE=tampermonkey` em `.env`.

3. Suba o serviço:

   ```powershell
   docker compose up -d --build
   ```

4. Acesse uma das interfaces:

   - noVNC: `http://127.0.0.1:6080/vnc.html`
   - VNC: `127.0.0.1:5900`

Use a senha definida em `VNC_PASSWORD`. Para ver logs: `docker compose logs -f`.

## Modos de script

| Modo | Quando usar | Como funciona |
| --- | --- | --- |
| `native` (padrão) | O script usa DOM, `fetch`, eventos e APIs normais da página. | Uma extensão MV3 local injeta `script.js` no mundo principal, no início das páginas do Baiak Idle cobertas pelos `@match` atuais. Não exige instalação manual e recarregar a página aplica edições no arquivo. |
| `tampermonkey` | O script usa `GM_*`, `GM.*`, `@grant`, `@require`, `@resource`, menus ou armazenamento próprio do Tampermonkey. | O Chrome instala o Tampermonkey oficial pela política de extensão. No primeiro boot, abra o painel dele e importe/cole o `script.js`. O perfil e a extensão ficam no volume `chrome-data`. |
| `none` | Diagnóstico ou uso sem automação. | Não carrega a extensão nativa. O Tampermonkey que já existe no perfil permanece disponível. |

`native` não é uma emulação de Tampermonkey. Ela não disponibiliza as APIs `GM_*` nem interpreta permissões `@grant`; isto é uma limitação intencional da plataforma de extensões do Chrome. Portanto, para “todas as funcionalidades” de um userscript Tampermonkey, use `SCRIPT_MODE=tampermonkey`.

O arquivo `script.js` que acompanha este diretório estava vazio no momento da criação desta estrutura. Quando o conteúdo real for colocado nele, verifique seu bloco de metadados: em modo Tampermonkey, `@match`/`@include` precisa abranger o site alvo e `@grant` precisa refletir as APIs usadas.

## Como importar no Tampermonkey

1. Defina `SCRIPT_MODE=tampermonkey` e execute `docker compose up -d`.
2. Acesse o Chrome por VNC/noVNC. Com internet liberada, a política instala o Tampermonkey oficial na primeira inicialização.
3. Abra o ícone do Tampermonkey e escolha **Create a new script**; cole `script.js`, ou use **Utilities > Import from file**.
4. Salve e recarregue a página alvo. Caso o Chrome mostre a opção, habilite **Allow User Scripts** nos detalhes da extensão.

Depois do primeiro download, a extensão e os scripts importados persistem no volume Docker `chrome-data`. A instalação automática depende da Chrome Web Store estar acessível no primeiro boot; se a rede corporativa a bloquear, instale a extensão manualmente abrindo `chrome://extensions` pelo VNC e carregue apenas um pacote obtido da fonte oficial.

## Segurança e publicação remota

As portas são vinculadas a `127.0.0.1` por padrão; isso impede acesso direto pela rede. Para acesso remoto, mantenha esse padrão e use uma destas camadas:

- túnel SSH ou VPN (Tailscale/WireGuard), para VNC;
- reverse proxy HTTPS com autenticação, para noVNC.

VNC clássico usa uma senha de no máximo 8 caracteres e não é transporte seguro para internet aberta. Não altere `BIND_ADDRESS` para `0.0.0.0` sem uma camada de rede segura. O container não recebe `privileged`, Docker socket nem acesso desnecessário ao host. O Compose usa `seccomp=unconfined`, pois o sandbox do Chrome precisa criar namespaces e o perfil padrão do Docker Desktop bloqueia essa operação; mantenha as portas privadas e o host atualizado.

Em produção, prefira injetar a senha por Docker Secret, definindo `VNC_PASSWORD_FILE=/run/secrets/...` em um override de Compose, em vez de mantê-la em `.env`.

## Persistência, atualização e operação

- O volume nomeado `chrome-data` preserva perfil, cookies, extensões e configurações. Não o remova se quiser manter a sessão.
- `./script.js` é montado como somente leitura. No modo `native`, edite-o no host e recarregue a aba; não é necessário rebuild.
- Para atualizar o Chrome, faça rebuild: `docker compose build --pull --no-cache` e depois `docker compose up -d`.
- A imagem é `linux/amd64`, pois instala o pacote oficial do Google Chrome. Em ARM, seria preciso trocar para Chromium e adaptar as políticas.

## Estrutura

```text
.
├── chrome-policy/tampermonkey.json  # instalação oficial do TM por política
├── docker/entrypoint.sh             # Xvfb, VNC/noVNC e Chrome
├── extension/manifest.json          # loader MV3 para o modo native
├── compose.yaml
├── Dockerfile
└── script.js                         # seu userscript
```

## Decisões de arquitetura

- **Google Chrome oficial, não Chromium:** atende ao requisito do navegador e facilita o fluxo suportado da Chrome Web Store/Tampermonkey.
- **Xvfb + Openbox:** proporciona uma sessão gráfica real, mas sem um desktop completo. Isso reduz processos, superfície de ataque e memória em relação a imagens de workstation/KasmVNC.
- **x11vnc + noVNC:** entrega VNC padrão para clientes nativos e uma interface web simples no mesmo container. Um reverse proxy pode publicar apenas a porta 6080.
- **Perfil em volume e script fora dele:** credenciais/sessão sobrevivem a recriações; o script continua versionável e editável no repositório.
- **Tampermonkey por política, não CRX copiado:** evita embutir um CRX de origem/versionamento incertos. A extensão chega assinada pela Chrome Web Store e é atualizada pelo Chrome.
