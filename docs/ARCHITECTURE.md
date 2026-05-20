# Arquitetura — Kairos

## Diagrama 1 — Visão Geral do Sistema

Quem usa o Kairos, o que está dentro do sistema e quais sistemas externos ele depende.

```mermaid
flowchart TB
    User(["👤 Engenheiro de Software\nBrasil / LATAM"])

    subgraph Kairos["Kairos"]
        direction LR
        SPA["⚛️ React SPA\nMUI 9 · Filtros · Dark mode"]
        Server["🖥️ Web Server\nNode.js HTTP"]
        Pipeline["⚙️ Pipeline\nTypeScript · 12 fontes"]
        Storage[("💾 File Storage\nJSON · CSV · Markdown")]

        SPA -- "GET /api/latest\nGET /api/download/*" --> Server
        Server -- "dispara" --> Pipeline
        Server -- "lê latest/" --> Storage
        Pipeline -- "salva artefatos\natualiza symlinks" --> Storage
    end

    subgraph Fontes["Fontes de Vagas"]
        direction TB
        BR["🇧🇷 APIs Brasil\nProgramaThor · LinkedIn\nHimalayas · Get on Board · Gupy"]
        ATS["🏢 ATS Diretos\nGreenhouse · Lever · Ashby"]
        AGG["🌍 Agregadores\nRemotive · RemoteOK"]
        BMCP["🔒 Browser MCP\nbrowsermcp.io — opt-in"]
    end

    Render["☁️ Render.com"]
    CI["⚙️ GitHub Actions\nNode 20 + 22"]

    User -- "acessa via browser" --> SPA
    Pipeline -- "fetch paralelo" --> BR & ATS & AGG
    Pipeline -. "opt-in" .-> BMCP
    Render -- "hospeda e serve" --> Kairos
    CI -- "lint · typecheck · test · build" --> Kairos
```

---

## Diagrama 2 — Fluxo do Pipeline

Como os dados fluem desde a coleta até os relatórios finais, incluindo o loop de expansão.

```mermaid
flowchart LR
    subgraph Coleta["Coleta — Promise.allSettled()"]
        direction TB
        S1["APIs Brasil\n5 fontes"]
        S2["ATS Diretos\n3 fontes"]
        S3["Agregadores\n2 fontes"]
        S4["Manual JSON"]
        S5["Browser MCP\nopt-in"]
    end

    N["Normalize\nRawJobPosting → JobOpportunity\nremote policy · mercado · stack · seniority"]
    F["Filter\nrole · idade 14–90d\nvisto · remote policy"]
    R["Rank\nscore 0–100+\ntítulo · mercado · stack · recência · fonte"]
    D["Dedup\ntítulo + empresa + URL\nmantém maior score"]

    EXP{"Vagas\nsuficientes?"}

    SEL["Selection Policy\n92% Brasil-first · 8% intl\ncotas seniority · máx 30%/fonte\nvalidação de URLs"]

    subgraph Output["Saída — data/job-research/latest/"]
        direction TB
        O1["report.md"]
        O2["report.csv\n+ 8 CSVs por grupo"]
        O3["summary.json\nselected-jobs.json\nranked-jobs.json\nfilter-funnel.json"]
    end

    Coleta --> N --> F --> R --> D --> EXP
    EXP -- "não — expande paginação\n(até 2×)" --> Coleta
    EXP -- "sim" --> SEL --> Output
```

---

## Diagrama 3 — Arquitetura Web

Como o servidor, a SPA e o file storage se relacionam em runtime.

```mermaid
flowchart TB
    subgraph Browser["Navegador"]
        SPA["React SPA\nFiltersPanel · JobCard · GroupDistribution\nuseFilteredJobs · useLatestPayload"]
    end

    subgraph WebServer["Web Server — Node.js"]
        MW["Middleware\nCORS · Rate limit 60 req/min · Bearer auth"]
        subgraph Routes["Rotas"]
            R1["GET /api/latest"]
            R2["POST /api/run"]
            R3["GET /api/download/:file\nGET /api/download-all"]
            R4["POST /api/upload-latest/:file"]
            R5["* → index.html (SPA fallback)"]
        end
        MW --> Routes
    end

    subgraph FS["File Storage"]
        Latest["latest/\n(symlinks para o run mais recente)"]
        Runs["runs/\n(histórico completo)"]
    end

    Pipeline["Pipeline de Vagas\n(processo assíncrono)"]
    RefreshSh["refresh.sh\nrun local → upload produção"]

    SPA -- "HTTP / JSON" --> MW
    R1 & R3 -- "lê" --> Latest
    R2 -- "dispara" --> Pipeline
    Pipeline -- "salva e cria symlink" --> Latest
    Pipeline -- "persiste" --> Runs
    RefreshSh -- "x-upload-key header" --> R4
    R4 -- "atualiza" --> Latest
```

---

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

Coordena todas as etapas do pipeline. Implementa o loop de search expansion: se não houver vagas suficientes após a primeira rodada, incrementa os limites de paginação e re-executa fetching, normalização, filtragem e ranking antes de selecionar.

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

| Tipo | Valores |
|---|---|
| `JobMarket` | `brazil \| brazil_friendly \| latam \| international \| unclear` |
| `SeniorityLevel` | `junior \| mid_level \| senior \| lead \| staff \| principal \| staff_or_principal \| architect \| unknown` |
| `RoleCategory` | `software_engineering \| tech_lead \| devops \| software_architecture \| solutions_architecture \| cloud_architecture \| qa \| management` |
| `RemotePolicy` | `remote \| hybrid \| onsite \| unknown` |
| `SeniorityReportGroupV2` | `junior \| pleno \| senior \| staff \| arq \| qa \| devops \| management \| other` |
| `JobSourceTier` | `manual_curated \| brazil_public_api \| direct_company_board \| global_aggregator` |

### `sources/` — Adaptadores de fontes

Cada fonte implementa a interface `JobSource`:

```typescript
interface JobSource {
  fetch(config: JobResearchConfig): Promise<RawJobPosting[]>
}
```

Todas as fontes são executadas em paralelo via `Promise.allSettled()`. Falha em uma fonte não interrompe as demais.

**Fontes HTTP (11):** Manual JSON, ProgramaThor, LinkedIn, Himalayas, Get on Board, Gupy, Greenhouse, Lever, Ashby, Remotive, RemoteOK.

**Browser MCP Engine (opcional):** 10 adaptadores de sites — LinkedIn, ProgramaThor, Glassdoor, Vagas.com, Catho, InfoJobs BR, Gupy public, Trampos.co, Revelo, GeekHunter.

### `skills/` — Pipeline de transformação

| Skill | Responsabilidade |
|---|---|
| `job-normalizer` | Mapeia campos heterogêneos para `JobOpportunity` unificado |
| `job-filter` | Remove irrelevantes (role, idade, visto, remote policy) |
| `job-ranker` | Calcula `score` 0–100+ |
| `duplicate-detector` | Remove duplicatas entre fontes; mantém maior score |
| `job-market-classifier` | Classifica mercado da vaga |
| `remote-policy-detector` | Detecta modalidade (remote / hybrid / onsite) |
| `visa-restriction-detector` | Detecta restrições de visto |
| `stack-matcher` | Extrai stack técnico da descrição |
| `job-selection-policy` | Aplica Brasil-first, cotas de senioridade, diversidade de fonte |

### `report/` — Geradores de relatório

- `markdown-report.generator.ts` — `report.md` legível, agrupado por senioridade e categoria
- `csv-report.generator.ts` — `report.csv` geral + 8 CSVs por grupo

### `storage/` — Persistência

`FileJobStorage` salva todos os artefatos em `data/job-research/runs/<timestamp>/` e mantém symlinks em `data/job-research/latest/`.

**Artefatos por run:**
- `report.md`, `report.csv`, `report-*.csv`
- `summary.json`, `selected-jobs.json`, `ranked-jobs.json`, `filter-funnel.json`
- `browser-mcp-trace.json` (apenas se Browser MCP ativo)

### `web/` — Servidor HTTP e frontend

**`server.ts`** — Entry point. Em `NODE_ENV=development`, inicia o Vite dev server como middleware. Em produção, serve os arquivos pré-buildados de `dist/`.

**`app.ts`** — Roteador de APIs com middlewares globais (CORS, rate limit, auth).

**`client/`** — SPA React 19 + MUI 9 buildada com Vite. Consome `GET /api/latest`.

---

## Decisões arquiteturais

### File-based, sem banco de dados

**Decisão:** Todos os dados são persistidos em JSON/CSV/MD no disco.

**Motivo:** Simplicidade de deploy (zero dependências externas), portabilidade, inspecionabilidade dos outputs sem ferramentas especiais.

**Limitação:** Não escala para múltiplos usuários simultâneos disparando pipelines; histórico de runs ocupa disco gradualmente.

### `Promise.allSettled()` para fontes

**Decisão:** Falha em uma fonte não cancela as demais.

**Motivo:** Fontes externas são instáveis. Um timeout no Remotive não deve impedir resultados do ProgramaThor.

### Browser MCP como double opt-in

**Decisão:** Requer habilitação global + por site.

**Motivo:** Requer Playwright instalado e sessão autenticada no browser do usuário. Deploy em servidor usa `DISABLE_BROWSER=true`.

### Score como número único (0–100+)

**Decisão:** Ranking usa um score composto.

**Motivo:** Simplifica ordenação e filtragem na UI. O detalhamento (`JobScoreBreakdown`) está disponível para debug mas não exposto na UI.

### Symlinks `latest/`

**Decisão:** `data/job-research/latest/` aponta para o run mais recente.

**Motivo:** A API e o `refresh.sh` sempre leem de `latest/` sem precisar saber o timestamp atual. Permite atualização atômica (rename) sem downtime.

---

## Pontos de extensão

| O que adicionar | Onde |
|---|---|
| Nova fonte HTTP | `sources/`, interface `JobSource`, registro em `index.ts` |
| Novo site Browser MCP | `sources/browser-mcp/site-adapters/` + registro no índice |
| Novo grupo de relatório | `domain/job.types.ts` → `skills/` → `report/csv-report.generator.ts` → frontend `utils/report-group.ts` |
| Novo sinal de stack | `skills/stack-matcher.skill.ts` + `skills/job-ranker.skill.ts` |
| Novo endpoint de API | `web/routes/` + registro em `web/app.ts` |

---

## Limitações conhecidas

- Um único pipeline por processo (sem fila; `POST /api/run` retorna 409 se já há um run ativo)
- Sem autenticação no frontend React (qualquer um com a URL acessa as vagas)
- `pnpm build:client` requer Node.js >= 20.19 ou 22.12 (Vite 8); CI roda com Node 20 que satisfaz este requisito
- Symlinks de `latest/` podem não funcionar em Windows sem privilégios de administrador ou modo Developer

## Possíveis melhorias futuras

- Agendamento automático do pipeline (cron via Render ou GitHub Actions scheduled)
- Persistência em SQLite para histórico de runs e variety tracking entre dias
- Autenticação na UI (Clerk, Auth.js ou similar)
- Paginação na API `GET /api/latest` (atualmente carrega tudo em memória)
- Webhook para notificar quando um novo run termina
- ADRs formais em `docs/DECISIONS/` à medida que decisões relevantes forem tomadas
