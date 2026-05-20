# Arquitetura — Kairos

## Visão geral

Kairos é um pipeline de processamento de vagas composto por dois modos de operação:

1. **Modo CLI** (`pnpm job-research`): executa o pipeline completo e salva relatórios em disco
2. **Modo Web** (`pnpm job-web`): sobe um servidor HTTP que serve a API REST e a SPA React; o pipeline pode ser disparado via `POST /api/run`

Os dois modos compartilham o mesmo núcleo de pipeline definido em `src/job-research-agent/index.ts`.

## Módulos e responsabilidades

```
src/job-research-agent/
├── index.ts                    ← Orquestrador do pipeline
├── config/                     ← Configuração central
├── domain/                     ← Tipos de domínio
├── sources/                    ← Adaptadores de fontes
│   └── browser-mcp/            ← Engine Browser MCP (opcional)
├── skills/                     ← Transformações do pipeline
├── report/                     ← Geradores de relatório
├── storage/                    ← Persistência em disco
├── shared/                     ← Utilities compartilhados
├── cli/                        ← Entry point CLI
└── web/                        ← Servidor HTTP + SPA React
    ├── server.ts
    ├── app.ts
    ├── routes/
    ├── middleware/
    ├── services/
    └── client/                 ← Frontend React (Vite)
```

### `index.ts` — Orquestrador

Responsável por coordenar todas as etapas do pipeline. Implementa o loop de search expansion: se não houver vagas suficientes após a primeira rodada, incrementa os limites de paginação e re-executa fetching, normalização, filtragem e ranking antes de selecionar.

### `config/` — Configuração central

`job-research.config.ts` define a configuração default do pipeline, incluindo:
- Habilitar/desabilitar fontes individualmente
- Search queries por fonte
- Alvos de senioridade e role
- Parâmetros de scoring (pesos, thresholds)
- Configuração do Browser MCP por site
- Distribuição de senioridade no relatório

Todas as opções podem ser sobrescritas programaticamente ou via CLI flags.

### `domain/` — Tipos de domínio

Define os tipos centrais do sistema:

- `JobOpportunity` — modelo unificado de vaga após normalização
- `JobMarket` — `brazil | brazil_friendly | latam | international | unclear`
- `SeniorityLevel` — `junior | mid_level | senior | lead | staff | principal | staff_or_principal | architect | unknown`
- `RoleCategory` — `software_engineering | tech_lead | devops | software_architecture | solutions_architecture | cloud_architecture | qa | management`
- `RemotePolicy` — `remote | hybrid | onsite | unknown`
- `SeniorityReportGroupV2` — 8 grupos para CSV e UI
- `JobSourceTier` — `manual_curated | brazil_public_api | direct_company_board | global_aggregator`

### `sources/` — Adaptadores de fontes

Cada fonte implementa a interface `JobSource`:

```typescript
interface JobSource {
  fetch(config: JobResearchConfig): Promise<RawJobPosting[]>
}
```

Todas as fontes são executadas em paralelo via `Promise.allSettled()`. Falha em uma fonte não interrompe as demais.

**Fontes HTTP disponíveis (11):**
- `manual-job-input.source.ts` — Lê JSONs de `data/manual-inputs/`
- `programathor.source.ts` — API pública ProgramaThor
- `linkedin.source.ts` — API pública LinkedIn (sem autenticação)
- `himalayas.source.ts` — API pública Himalayas
- `getonboard.source.ts` — API pública Get on Board
- `gupy.source.ts` — API pública Gupy
- `greenhouse.source.ts` — Boards de ATS Greenhouse (lista configurável de empresas)
- `lever.source.ts` — Boards de ATS Lever (lista configurável de empresas)
- `ashby.source.ts` — Boards de ATS Ashby (lista configurável de empresas)
- `remotive.source.ts` — Agregador Remotive
- `remoteok.source.ts` — Agregador RemoteOK

**Browser MCP Engine (opcional):**
- `browser-mcp/browser-mcp.engine.ts` — Orquestra navegação via MCP
- `browser-mcp/site-adapters/` — 10 adaptadores: LinkedIn, ProgramaThor, Glassdoor, Vagas.com, Catho, InfoJobs BR, Gupy public, Trampos.co, Revelo, GeekHunter

### `skills/` — Pipeline de transformação

Cada skill recebe e retorna dados do domínio sem efeitos colaterais:

| Skill | Entrada | Saída | Responsabilidade |
|---|---|---|---|
| `job-normalizer` | `RawJobPosting[]` | `JobOpportunity[]` | Mapeia campos, detecta remote policy, classifica mercado, extrai stack signals, detecta senioridade |
| `job-filter` | `JobOpportunity[]` | `JobOpportunity[]` | Remove irrelevantes (role, idade, visto, remote policy) |
| `job-ranker` | `JobOpportunity[]` | `JobOpportunity[]` | Calcula `score` (0–100+) para cada vaga |
| `duplicate-detector` | `JobOpportunity[]` | `JobOpportunity[]` | Remove duplicatas por título+empresa+URL; mantém maior score |
| `job-market-classifier` | `RawJobPosting` | `JobMarket` | Classifica mercado do job |
| `remote-policy-detector` | `RawJobPosting` | `RemotePolicy` | Detecta modalidade |
| `visa-restriction-detector` | `RawJobPosting` | `VisaSignal` | Detecta restrições de visto |
| `stack-matcher` | `string` | `StackSignal[]` | Detecta tecnologias na descrição |
| `job-selection-policy` | `JobOpportunity[]` | `JobOpportunity[]` | Aplica estratégia Brasil-first, diversidade de fonte e validação de URL |

### `report/` — Geradores de relatório

- `markdown-report.generator.ts` — Gera `report.md` legível, agrupado por senioridade e categoria
- `csv-report.generator.ts` — Gera `report.csv` geral + 8 CSVs por grupo (`report-junior.csv`, `report-pleno.csv`, etc.)

### `storage/` — Persistência

`FileJobStorage` salva todos os artefatos em `data/job-research/runs/<timestamp>/` e cria/atualiza symlinks em `data/job-research/latest/` para o run mais recente.

**Artefatos por run:**
- `report.md`, `report.csv`, `report-*.csv` — Relatórios
- `summary.json` — Metadata (contagens, distribuição de mercado)
- `selected-jobs.json` — Top N vagas com todos os campos
- `ranked-jobs.json` — Todos os jobs ranqueados (para análise)
- `filter-funnel.json` — Estatísticas de rejeição por etapa
- `browser-mcp-trace.json` — Trace de navegação (apenas se Browser MCP ativo)

### `web/` — Servidor HTTP e frontend

**`server.ts`** — Entry point. Sobe o servidor HTTP nativo do Node. Em `NODE_ENV=development`, também inicia o Vite dev server como middleware. Em produção, serve os arquivos pré-buildados de `dist/`.

**`app.ts`** — Define o roteador de APIs e aplica middlewares globais (CORS, rate limit, auth).

**`routes/`** — Um arquivo por endpoint. Ver [`docs/API.md`](API.md) para referência completa.

**`middleware/`** — CORS configurável, rate limiting (60 req/min), autenticação por bearer token.

**`client/`** — SPA React 19 + MUI 9 buildada com Vite. Consome `GET /api/latest` e exibe as vagas com filtros interativos.

## Fluxo de dados

```
CLI flags / POST /api/run
         │
         ▼
  JobResearchAgent.run()                        [index.ts]
         │
         ├── Promise.allSettled([fonte1, ..., fonte11, browserMcp?])
         │         │
         │         ▼
         │   RawJobPosting[] (~500-1000 por run típico)
         │         │
         ├── normalize  → JobOpportunity[] (campos unificados, sinais detectados)
         ├── filter     → remove irrelevantes (role, idade, visto, remote)
         ├── rank       → adiciona score (0-100+)
         ├── dedup      → remove duplicatas entre fontes
         │         │
         │         ▼ (loop de search expansion se vagas insuficientes)
         │
         ├── selectReportJobs()
         │   ├── Filtra por minReportScore
         │   ├── Aloca 92% Brazil-first (com cotas de senioridade)
         │   ├── Preenche 8% com fallback internacional
         │   ├── Limita 30% por fonte
         │   └── Valida URLs (HTTP HEAD)
         │         │
         │         ▼
         │   JobOpportunity[] (Top N selecionados)
         │         │
         ├── MarkdownReportGenerator → report.md
         ├── CsvReportGenerator     → report.csv + 8 CSVs por grupo
         └── FileJobStorage         → salva em runs/<timestamp>/, symlinks latest/
```

## Decisões arquiteturais

### File-based, sem banco de dados
**Decisão:** Todos os dados são persistidos em JSON/CSV/MD no disco.  
**Motivo:** Simplicidade de deploy (zero dependências externas), portabilidade, inspecionabilidade dos outputs sem ferramentas especiais.  
**Limitação:** Não escala para múltiplos usuários simultâneos rodando pipelines; histórico de runs ocupa disco gradualmente.

### `Promise.allSettled()` para fontes
**Decisão:** Falha em uma fonte não cancela as demais.  
**Motivo:** Fontes externas são instáveis; um timeout do Remotive não deve impedir resultados do ProgramaThor.

### Browser MCP como opt-in
**Decisão:** Browser MCP requer double opt-in (flag global + por site).  
**Motivo:** Requer Playwright instalado e sessão autenticada no browser do usuário. Deploy em servidor (Render.com) usa `DISABLE_BROWSER=true`.

### Score como número único
**Decisão:** O ranking usa um score 0–100+ composto.  
**Motivo:** Simplifica ordenação e filtragem. O score detalhado (`JobScoreBreakdown`) está disponível para debug mas não é exposto na UI.

### Symlinks `latest/`
**Decisão:** `data/job-research/latest/` aponta sempre para o run mais recente via symlinks.  
**Motivo:** A API (`GET /api/latest`) e o `refresh.sh` sempre leem de `latest/`, sem precisar saber o timestamp do run atual.

## Pontos de extensão

- **Nova fonte HTTP**: implementar `JobSource`, registrar em `index.ts`, adicionar configuração em `job-research.config.ts`
- **Nova fonte Browser MCP**: criar adaptador em `sources/browser-mcp/site-adapters/`, registrar no índice
- **Novo grupo de relatório**: adicionar em `SeniorityReportGroupV2` (domain), `toSeniorityReportGroupV2()` (shared), atualizar `CsvReportGenerator`
- **Novo sinal de stack**: adicionar em `stack-matcher.skill.ts` e no ranker

## Limitações conhecidas

- Um único pipeline por processo (sem fila de jobs)
- Sem autenticação para o frontend React (qualquer um com a URL acessa)
- `pnpm build:client` requer Node.js >= 20.19 ou 22.12 (Vite 8 restrição); CI roda com Node 20 usando versão compatível
- Symlinks de `latest/` podem quebrar em sistemas de arquivo Windows sem suporte a symlinks

## Possíveis melhorias futuras

- Agendamento automático do pipeline (cron via Render ou GitHub Actions scheduled)
- Persistência em SQLite para histórico de runs e variety tracking
- Autenticação no frontend
- Paginação na API `GET /api/latest` (atualmente retorna todos os jobs em memória)
- Webhook para notificar quando um novo run termina
