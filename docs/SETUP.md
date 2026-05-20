# Setup — Kairos

## Pré-requisitos

| Ferramenta | Versão mínima | Verificar |
|---|---|---|
| Node.js | 20.0.0 | `node --version` |
| pnpm | 10.0.0 | `pnpm --version` |

> **Nota:** O build do frontend (Vite 8) requer Node.js >= 20.19 ou 22.12. Para desenvolvimento sem build, Node 20.0+ é suficiente.

**Instalar pnpm** (caso não tenha):
```bash
npm install -g pnpm
```

## Instalação

```bash
git clone <repo>
cd job-search-engine
pnpm install
```

O `pnpm install` instala todas as dependências, incluindo Playwright (necessário para Browser MCP). Se não for usar Browser MCP, isso é automático e transparente.

## Configuração de variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` conforme sua necessidade. Veja a tabela completa em [ENVIRONMENT.md](ENVIRONMENT.md).

### Configuração mínima para desenvolvimento local

```env
PORT=3355
API_PORT=3356
NODE_ENV=development
KAIROS_LOCAL_ONLY=true
DISABLE_BROWSER=false
```

### Configuração para produção (Render.com)

```env
PORT=3355
NODE_ENV=production
DISABLE_BROWSER=true
KAIROS_API_TOKEN=<token-seguro>
KAIROS_UPLOAD_KEY=<openssl rand -hex 32>
KAIROS_URL=https://seu-app.onrender.com
KAIROS_ALLOWED_ORIGINS=https://seu-app.onrender.com
```

## Como rodar localmente

### Modo Web (recomendado)

Sobe o servidor HTTP + Vite dev server + frontend React:

```bash
pnpm job-web
```

- Frontend: `http://localhost:3355`
- API: `http://localhost:3356` (proxiada automaticamente pelo Vite)

### Modo CLI (pipeline de coleta)

Executa o pipeline e salva relatórios em disco:

```bash
pnpm job-research
```

Outputs em `data/job-research/runs/<timestamp>/` e `data/job-research/latest/`.

## Configuração de fontes

As fontes são configuradas em `src/job-research-agent/config/job-research.config.ts`. Cada fonte tem `enabled: true/false` e parâmetros próprios.

### Intake manual (LinkedIn, Indeed, Wellfound)

Para incluir vagas curadas manualmente:

```bash
cp data/manual-inputs/linkedin-jobs.example.json data/manual-inputs/linkedin-jobs.json
```

Edite o arquivo e adicione vagas. O pipeline lê qualquer `*.json` em `data/manual-inputs/` que **não** termine em `.example.json`.

### Greenhouse e Lever (ATS diretos)

As empresas incluídas no scraping de Greenhouse e Lever são definidas em `job-research.config.ts`:

```typescript
greenhouse: {
  enabled: true,
  boards: ['workfit', 'devradical', /* ... */]
}
```

### Browser MCP (opcional)

Requer o server [browsermcp.io](https://browsermcp.io/) rodando localmente e uma sessão autenticada no browser.

1. Instale e configure o browser MCP
2. Habilite em `job-research.config.ts`: `browserMcp.enabled = true`
3. Habilite os sites desejados: `browserMcp.sites.linkedin.enabled = true`

Ou use a flag CLI: `pnpm job-research --browser-mcp`

## Validação do ambiente

Após instalar e configurar, valide:

```bash
# Testes devem passar
pnpm test

# TypeScript deve compilar sem erros
pnpm typecheck

# Lint deve passar
pnpm lint

# Servidor deve subir
pnpm job-web
# Acesse http://localhost:3355 — deve mostrar a UI
```

## Problemas comuns

**`Cannot find module` ao rodar `pnpm job-research`:**
```bash
pnpm install   # reinstala dependências
```

**Porta já em uso:**
```
Error: listen EADDRINUSE :::3355
```
Altere `PORT` no `.env` ou encerre o processo usando a porta.

**Vite exige Node >= 20.19:**
```
You are using Node.js 20.x.x. Vite requires Node.js version 20.19+
```
O aviso não impede o funcionamento em dev. Para build de produção, use Node 20.19+ ou 22.12+.

**Browser MCP não conecta:**
Certifique-se de que o servidor browsermcp.io está ativo localmente antes de rodar o pipeline. Alternativamente, use `DISABLE_BROWSER=true` ou `--no-browser-mcp`.
