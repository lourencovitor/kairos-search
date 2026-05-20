# Kairos

[![CI](https://github.com/lourencovitor/kairos-search/actions/workflows/ci.yml/badge.svg)](https://github.com/lourencovitor/kairos-search/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Pipeline de coleta, ranking e apresentação de vagas de software engineering com foco Brasil-first.

Agrega vagas de 12+ fontes (APIs públicas, boards de ATS, agregadores globais e Browser MCP opcional), normaliza, filtra, ranqueia com heurísticas Brasil-first e entrega via web UI filtrada ou relatórios CSV/Markdown.

> **Por que "Kairos"?** Em grego, *kairos* (καιρός) significa o momento oportuno — a hora certa de agir. O nome reflete o objetivo: encontrar a vaga certa, na hora certa.

## Funcionalidades

- Coleta de vagas de 12 fontes em paralelo (APIs Brasil, ATS diretos, agregadores globais)
- Normalização para modelo unificado com detecção automática de remote policy, mercado, stack e senioridade
- Ranking com score 0–100+ baseado em: título, senioridade, mercado, localização Brasil, stack técnico, recência e qualidade da fonte
- Deduplicação entre fontes (mantém maior score)
- Seleção Brasil-first: 92% vagas Brasil/LATAM + 8% fallback internacional
- Relatórios em Markdown e CSV agrupados por 8 grupos de senioridade/categoria
- Web UI React com filtros por grupo, mercado, modalidade e relevância mínima
- REST API com autenticação por bearer token
- Download de relatórios em ZIP
- Browser MCP como fonte opcional para sites com sessão autenticada

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js ≥ 20, TypeScript 5.8 |
| Web Server | Node.js `http` nativo + Vite (dev) |
| Frontend | React 19 + MUI 9 + Vite 8 |
| Testes | Vitest 3 + fast-check |
| Browser automation | Playwright + MCP SDK (opcional) |
| Deploy | Render.com (free tier) |
| CI | GitHub Actions (Node 20 + 22) |

## Pré-requisitos

- Node.js >= 20.0.0
- pnpm >= 10

```bash
node --version   # deve ser >= 20.0.0
pnpm --version   # deve ser >= 10.0.0
```

## Instalação

```bash
git clone <repo>
cd job-search-engine
pnpm install
```

## Configuração

Copie o arquivo de exemplo e edite conforme necessário:

```bash
cp .env.example .env
```

As variáveis essenciais para rodar localmente:

```env
PORT=3355
API_PORT=3356
NODE_ENV=development
KAIROS_LOCAL_ONLY=true   # bind apenas em 127.0.0.1 localmente
```

Para deploy em produção, veja [`docs/SETUP.md`](docs/SETUP.md) e [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Como rodar

### Web UI + API (modo principal)

```bash
pnpm job-web
```

Acesse `http://localhost:3355`. Em desenvolvimento, o Vite dev server sobe automaticamente na porta `API_PORT` (3356 por padrão) e o frontend conecta nele.

### Pipeline CLI (coleta de vagas)

```bash
pnpm job-research
```

Gera relatórios em `data/job-research/runs/<timestamp>/` e atualiza `data/job-research/latest/`.

Flags disponíveis:

| Flag | Descrição |
|---|---|
| `--top=N` | Número de vagas no relatório (default: 100) |
| `--min-score=N` | Score mínimo para inclusão (default: 0) |
| `--output-dir=<path>` | Diretório de saída alternativo |
| `--manual-input-dir=<path>` | Diretório de inputs manuais alternativo |
| `--browser-mcp` | Força Browser MCP habilitado |
| `--no-browser-mcp` | Força Browser MCP desabilitado |
| `--browser-mcp-only` | Roda apenas o Browser MCP (desabilita fontes HTTP) |
| `--browser-mcp-site=<id>` | Habilita apenas o site especificado (repetível) |

### Build para produção

```bash
pnpm build:client   # build do frontend React
pnpm build          # typecheck do backend
```

## Testes

```bash
pnpm test           # executa todos os testes
pnpm typecheck      # valida tipos TypeScript
pnpm lint           # ESLint
pnpm format:check   # Prettier
```

## Estrutura de pastas

```
src/job-research-agent/
├── index.ts                  # Orquestrador principal do pipeline
├── config/                   # Configuração central (fontes, scoring, targets)
├── domain/                   # Tipos de domínio (JobOpportunity, JobMarket, etc.)
├── sources/                  # 12 adaptadores de fontes
│   └── browser-mcp/          # Browser MCP engine + 10 adaptadores de sites
├── skills/                   # Pipeline de transformação
│   ├── job-normalizer.skill.ts
│   ├── job-filter.skill.ts
│   ├── job-ranker.skill.ts
│   ├── duplicate-detector.skill.ts
│   └── job-selection-policy.skill.ts
├── report/                   # Geradores de relatório (Markdown, CSV)
├── storage/                  # Persistência em disco
├── shared/                   # Utilities (taxonomia, localização, HTTP)
├── cli/                      # Entry point CLI
└── web/                      # Servidor HTTP, API REST e frontend React
    ├── server.ts
    ├── app.ts
    ├── routes/
    ├── services/
    ├── middleware/
    └── client/               # SPA React (Vite)

data/
├── job-research/
│   ├── runs/<timestamp>/     # Outputs de cada run
│   └── latest/               # Symlinks para o run mais recente
└── manual-inputs/            # JSONs de vagas curadas manualmente
```

## Fontes de vagas

| Fonte | Tipo | Foco |
|---|---|---|
| Manual JSON (`data/manual-inputs/`) | Curado | Qualquer |
| ProgramaThor | API pública | Brasil |
| LinkedIn | API pública | Brasil/Global |
| Himalayas | API pública | Brasil |
| Get on Board | API pública | Brasil/LATAM |
| Gupy | API pública | Brasil |
| Greenhouse | ATS direto | Global |
| Lever | ATS direto | Global |
| Ashby | ATS direto | Global |
| Remotive | Agregador | Global (remote) |
| RemoteOK | Agregador | Global (remote) |
| Browser MCP | Browser autenticado | Variado (opt-in) |

### Tiers de fonte

| Tier | Qualidade | Fontes |
|---|---|---|
| `manual_curated` | 10 | Manual JSON |
| `brazil_public_api` | 6 | ProgramaThor, LinkedIn, Himalayas, Get on Board, Gupy |
| `direct_company_board` | 8 | Greenhouse, Lever, Ashby |
| `global_aggregator` | 3 | Remotive, RemoteOK, Browser MCP |

## Estratégia Brasil-first

O pipeline seleciona o Top N vagas com a seguinte alocação:

- **92%** de vagas com `jobMarket ∈ {brazil, brazil_friendly, latam}`
- **8%** de fallback para vagas internacionais (remote worldwide)

Dentro do pool Brasil-first, a distribuição por senioridade é:

| Grupo | Alvo |
|---|---|
| Junior | 5% |
| Pleno | 20% |
| Senior | 25% |
| Lead/Tech Lead | 15% |
| Staff | 10% |
| Principal | 10% |
| Arquitetura | 15% |

A fonte máxima por fornecedor é limitada a 30% para garantir diversidade.

## Grupos de relatório

Cada vaga é classificada em exatamente um grupo. Precedência: `devops → arq → qa → junior → pleno → senior → staff → management`.

| Grupo | CSV | Condição |
|---|---|---|
| `devops` | `report-devops.csv` | `roleCategory === "devops"` |
| `arq` | `report-arq.csv` | Arquitetura de software/soluções/cloud ou `seniority === "architect"` |
| `qa` | `report-qa.csv` | `roleCategory === "qa"` |
| `junior` | `report-junior.csv` | `seniority === "junior"` |
| `pleno` | `report-pleno.csv` | `seniority === "mid_level"` |
| `senior` | `report-senior.csv` | `seniority ∈ {senior, lead}` |
| `staff` | `report-staff.csv` | `seniority ∈ {staff, principal, staff_or_principal}` |
| `management` | `report-management.csv` | `roleCategory === "management"` |

## Intake manual

Scraping de LinkedIn, Indeed e Wellfound é intencionalmente não implementado. Use os arquivos de exemplo para curar vagas manualmente:

```bash
# Copie um dos templates
cp data/manual-inputs/linkedin-jobs.example.json data/manual-inputs/linkedin-jobs.json

# Edite e adicione vagas
# O pipeline lê qualquer *.json em data/manual-inputs/ (exceto *.example.json)
```

## Browser MCP (opcional)

Engine complementar que usa o [browsermcp.io](https://browsermcp.io/) para navegar com sessão autenticada. **Desabilitado por default.**

Para habilitar: `src/job-research-agent/config/job-research.config.ts` → `browserMcp.enabled = true`.

Sites suportados: LinkedIn, ProgramaThor, Glassdoor, Vagas.com, Catho, InfoJobs BR, Gupy public, Trampos.co, Revelo, GeekHunter.

Garantias: sem auto-apply, sem leitura de credenciais, rate limiting configurável por site, tokens sensíveis redactados do trace file.

## Deploy

O projeto está configurado para Render.com via `render.yaml`. Veja [`docs/OPERATIONS.md`](docs/OPERATIONS.md) para instruções completas.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Instalação e configuração detalhada |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitetura, módulos e fluxo de dados |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Convenções, como adicionar fontes e skills |
| [`docs/API.md`](docs/API.md) | Endpoints REST, autenticação e payloads |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Deploy, logs e operação |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Como contribuir |
| [`CHANGELOG.md`](CHANGELOG.md) | Histórico de mudanças |

## Licença

MIT © [Vitor Lourenco](https://github.com/lourencovitor) — veja [LICENSE](LICENSE) para detalhes.

Para reportar vulnerabilidades de segurança, veja [SECURITY.md](SECURITY.md).
