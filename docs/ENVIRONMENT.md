# Variáveis de ambiente — Kairos

Todas as variáveis são opcionais com defaults seguros, exceto onde indicado.

O arquivo `.env.example` na raiz do projeto sempre reflete o estado atual das variáveis.

## Servidor

| Variável | Default | Descrição |
|---|---|---|
| `PORT` | `3355` | Porta do servidor HTTP (produção e desenvolvimento) |
| `API_PORT` | `3356` | Porta do Vite dev server (apenas em `NODE_ENV=development`). O frontend faz proxy para esta porta. |
| `NODE_ENV` | `development` | `production` serve o build pré-compilado de `dist/` e desabilita o Vite dev server |
| `KAIROS_LOCAL_ONLY` | `false` | Se `true`, o servidor faz bind em `127.0.0.1` apenas. Use `true` localmente, `false` em produção (necessário para o Render detectar a porta) |

## Segurança

| Variável | Default | Descrição |
|---|---|---|
| `KAIROS_API_TOKEN` | _(vazio)_ | Bearer token para `POST /api/run` e endpoints de download. Deixar vazio permite acesso sem autenticação (não recomendado para deploys públicos) |
| `KAIROS_UPLOAD_KEY` | _(vazio)_ | Chave secreta para `POST /api/upload-latest/:file`. Usado pelo `refresh.sh` para enviar dados novos sem redeploy. Gerar com: `openssl rand -hex 32`. Sem esta variável, o endpoint retorna 503. |
| `KAIROS_URL` | _(vazio)_ | URL pública do servidor, usada pelo `refresh.sh`. Exemplo: `https://kairos.onrender.com` |
| `KAIROS_ALLOWED_ORIGINS` | _(vazio = all)_ | Lista de origens CORS permitidas, separadas por vírgula. Vazio permite todas as origens. Exemplo: `https://kairos.app,http://localhost:3355` |

## Runtime

| Variável | Default | Descrição |
|---|---|---|
| `DISABLE_BROWSER` | `false` | Se `true`, desabilita completamente o Playwright e o Browser MCP Engine. Deve ser `true` em servidores sem interface gráfica (ex: Render.com free tier) |

## Frontend (build-time)

Estas variáveis são injetadas pelo Vite no momento do build (`pnpm build:client`) e não têm efeito em runtime. Para alterar, é necessário rebuildar o frontend.

| Variável | Default | Descrição |
|---|---|---|
| `VITE_ADSENSE_CLIENT` | _(vazio)_ | ID do cliente Google AdSense. Formato: `ca-pub-XXXXXXXXXXXXXXXX`. Sem esta variável, os slots de anúncios ficam invisíveis. |
| `VITE_AD_SLOT_LEADERBOARD` | _(vazio)_ | ID do slot AdSense para o banner leaderboard (topo) |
| `VITE_AD_SLOT_FEED` | _(vazio)_ | ID do slot AdSense para anúncios no feed |
| `VITE_AD_SLOT_SIDEBAR_TOP` | _(vazio)_ | ID do slot AdSense para sidebar superior |
| `VITE_AD_SLOT_SIDEBAR_BOT` | _(vazio)_ | ID do slot AdSense para sidebar inferior |

## Exemplo completo

```env
# ── Servidor ──────────────────────────────────────────────────────────────────
PORT=3355
API_PORT=3356
NODE_ENV=development
KAIROS_LOCAL_ONLY=true

# ── Segurança ─────────────────────────────────────────────────────────────────
KAIROS_API_TOKEN=meu-token-secreto
KAIROS_UPLOAD_KEY=aabbcc...  # openssl rand -hex 32
KAIROS_URL=https://kairos.onrender.com
KAIROS_ALLOWED_ORIGINS=

# ── Runtime ───────────────────────────────────────────────────────────────────
DISABLE_BROWSER=false

# ── Frontend (Vite inlined vars) ──────────────────────────────────────────────
# VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
# VITE_AD_SLOT_LEADERBOARD=0000000001
# VITE_AD_SLOT_FEED=0000000002
# VITE_AD_SLOT_SIDEBAR_TOP=0000000003
# VITE_AD_SLOT_SIDEBAR_BOT=0000000004
```
