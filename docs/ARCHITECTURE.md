# Arquitetura — Kairos

## C4 Level 1 — Contexto do Sistema

Visão de mais alto nível: quem usa o Kairos e com quais sistemas externos ele se integra.

```mermaid
C4Context
    title Nível 1: Contexto — Kairos

    Person(user, "Engenheiro de Software", "Candidato buscando vagas tech no Brasil/LATAM")

    System(kairos, "Kairos", "Agrega vagas de 12+ fontes, ranqueia com heurísticas Brasil-first e apresenta via web UI filtrada")

    System_Ext(jobApis, "APIs Públicas de Vagas", "ProgramaThor, LinkedIn, Himalayas, Get on Board, Gupy, Remotive, RemoteOK")
    System_Ext(ats, "ATS Diretos", "Greenhouse, Lever, Ashby — boards públicos de empresas")
    System_Ext(browserMcpServer, "Browser MCP Server", "browsermcp.io — bridge para sessão de browser já autenticada (opt-in)")
    System_Ext(render, "Render.com", "Plataforma de deploy e hospedagem (free tier)")
    System_Ext(githubActions, "GitHub Actions", "CI/CD: lint, typecheck, testes e build em cada push/PR")

    Rel(user, kairos, "Acessa e filtra vagas via browser")
    Rel(kairos, jobApis, "Coleta vagas via HTTP REST")
    Rel(kairos, ats, "Coleta boards públicos de ATS via HTTP")
    Rel(kairos, browserMcpServer, "Navegação autenticada em sites bloqueados (opcional)")
    Rel(render, kairos, "Hospeda e serve em produção")
    Rel(githubActions, kairos, "Valida qualidade em cada PR e push")
```

---

## C4 Level 2 — Containers

Os principais processos e componentes implantáveis dentro do Kairos.

```mermaid
C4Container
    title Nível 2: Containers — Kairos

    Person(user, "Engenheiro de Software")

    System_Boundary(kairos, "Kairos") {
        Container(spa, "React SPA", "React 19 + MUI 9 + Vite", "Interface web com filtros por grupo, mercado, modalidade e relevância mínima. Tema dark/light.")
        Container(server, "Web Server", "Node.js HTTP nativo + tsx", "Serve a SPA estática, expõe a REST API e gerencia o estado de runs do pipeline")
        Container(pipeline, "Pipeline de Vagas", "Node.js + TypeScript", "Coleta, normaliza, filtra, ranqueia, deduplica e seleciona vagas. Roda via CLI ou disparado pela API.")
        Container(storage, "File Storage", "Disco local (JSON / CSV / MD)", "Persiste cada run em runs/<timestamp>/. Mantém symlinks em latest/ para acesso rápido.")
    }

    System_Ext(jobApis, "APIs Públicas de Vagas")
    System_Ext(ats, "ATS Diretos (Greenhouse, Lever, Ashby)")
    System_Ext(browserMcpServer, "Browser MCP Server (opcional)")

    Rel(user, spa, "Visualiza e filtra vagas", "HTTPS")
    Rel(spa, server, "GET /api/latest, GET /api/download/*", "HTTP / JSON")
    Rel(server, pipeline, "Dispara via POST /api/run ou pnpm job-research")
    Rel(server, storage, "Lê latest/ para servir os dados ao frontend")
    Rel(pipeline, storage, "Salva artefatos do run e atualiza symlinks latest/")
    Rel(pipeline, jobApis, "Fetch de vagas em paralelo", "HTTP / REST")
    Rel(pipeline, ats, "Fetch de boards públicos", "HTTP / REST")
    Rel(pipeline, browserMcpServer, "Navegação autenticada por MCP Protocol (opt-in)")
```

---

## C4 Level 3 — Componentes do Pipeline

O pipeline é o coração do sistema. Este diagrama detalha os componentes internos e o fluxo de dados entre eles.

```mermaid
C4Component
    title Nível 3: Componentes — Pipeline de Vagas (index.ts)

    Container_Ext(trigger, "Web Server / CLI", "Dispara o pipeline")
    Container_Ext(storage, "File Storage", "Persiste artefatos")

    Container_Boundary(pipeline, "Pipeline de Vagas") {
        Component(sources, "Source Adapters (12)", "sources/*.source.ts", "Coleta vagas em paralelo via Promise.allSettled(). Falha em uma fonte não cancela as demais.")
        Component(normalizer, "Job Normalizer", "skills/job-normalizer.skill.ts", "Mapeia RawJobPosting → JobOpportunity. Detecta: remote policy, mercado, stack signals, senioridade, restrições de visto.")
        Component(filter, "Job Filter", "skills/job-filter.skill.ts", "Remove vagas irrelevantes por: role, idade da vaga (14–90 dias), restrição de visto, remote policy.")
        Component(ranker, "Job Ranker", "skills/job-ranker.skill.ts", "Calcula score 0–100+ por: título, senioridade, mercado, localização Brasil, stack técnico, recência e qualidade da fonte.")
        Component(dedup, "Duplicate Detector", "skills/duplicate-detector.skill.ts", "Detecta e remove duplicatas entre fontes por título+empresa+URL. Mantém a entrada com maior score.")
        Component(selector, "Selection Policy", "skills/job-selection-policy.skill.ts", "Aplica estratégia Brasil-first (92/8), cotas de senioridade, limite de 30% por fonte e validação de URLs via HTTP HEAD.")
        Component(reportMd, "Markdown Generator", "report/markdown-report.generator.ts", "Gera report.md agrupado por senioridade e categoria de role.")
        Component(reportCsv, "CSV Generator", "report/csv-report.generator.ts", "Gera report.csv geral + 8 CSVs por grupo (junior, pleno, senior, staff, arq, qa, devops, management).")
        Component(expansion, "Search Expansion Loop", "index.ts", "Se vagas insuficientes após a primeira rodada, incrementa limites de paginação e re-executa até 2x.")
    }

    Rel(trigger, sources, "Inicia pipeline com config")
    Rel(sources, normalizer, "RawJobPosting[] (~500–1000)")
    Rel(normalizer, filter, "JobOpportunity[] (campos unificados)")
    Rel(filter, ranker, "JobOpportunity[] (relevantes)")
    Rel(ranker, dedup, "JobOpportunity[] (com score calculado)")
    Rel(dedup, expansion, "JobOpportunity[] (deduplicados)")
    Rel(expansion, sources, "Re-executa com paginação expandida se insuficiente")
    Rel(expansion, selector, "JobOpportunity[] (suficientes ou limite atingido)")
    Rel(selector, reportMd, "JobOpportunity[] (Top N selecionados)")
    Rel(selector, reportCsv, "JobOpportunity[] (Top N selecionados)")
    Rel(reportMd, storage, "report.md")
    Rel(reportCsv, storage, "report.csv, report-junior.csv, ..., report-management.csv")
    Rel(selector, storage, "summary.json, selected-jobs.json, ranked-jobs.json, filter-funnel.json")
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

## Fluxo de dados detalhado

```
CLI flags / POST /api/run
         │
         ▼
  JobResearchAgent.run()
         │
         ├─ Promise.allSettled([11 fontes HTTP + Browser MCP opcional])
         │         │
         │         ▼ RawJobPosting[] (~500–1000)
         │
         ├─ normalize  → JobOpportunity[] (campos unificados)
         ├─ filter     → remove irrelevantes
         ├─ rank       → adiciona score 0–100+
         ├─ dedup      → remove duplicatas
         │         │
         │         ▼ (search expansion loop — até 2x se insuficiente)
         │
         ├─ selectReportJobs()
         │   ├─ 92% Brazil-first (com cotas de senioridade)
         │   ├─ 8% fallback internacional
         │   ├─ máx 30% por fonte
         │   └─ validação de URLs via HTTP HEAD
         │         │
         │         ▼ JobOpportunity[] (Top N)
         │
         ├─ MarkdownReportGenerator → report.md
         ├─ CsvReportGenerator     → report.csv + 8 CSVs por grupo
         └─ FileJobStorage         → runs/<timestamp>/ + latest/
```

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
