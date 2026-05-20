# Changelog — Kairos

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Não lançado]

### Em andamento
- Documentação técnica do repositório

---

## [0.3.0] — 2026-05-19

### Adicionado
- Filtro multi-select por grupo de senioridade (DevOps + Staff simultâneos)
- Filtro de modalidade (Remoto / Híbrido / Presencial) com chips coloridos
- Score presets no filtro de relevância (55+ Boa aderência, 75+ Alta aderência)
- Botão scroll-to-top com anel de progresso animado
- Painel de filtros responsivo: abre inline no feed em tablet/mobile

### Melhorado
- Performance dos filtros com `useTransition` (React 19) e `React.memo` no JobCard
- Debounce na busca por texto (200ms)
- Animações limitadas aos primeiros 10 cards para reduzir jank

### Corrigido
- Filtros não abriam em tablet/mobile (Collapse estava atrás dos 250 cards)
- Seleção de todos os 3 filtros de modalidade retornava subset incorreto

---

## [0.2.0] — 2026-05-18

### Adicionado
- Endpoint `POST /api/upload-latest/:file` para atualização de dados sem redeploy
- Script `refresh.sh` para enviar dados do pipeline local para produção
- Fonte ProgramaThor (API pública Brasil)
- Fonte Gupy (API pública Brasil)
- Fonte Ashby (ATS direto)
- Grupo de relatório `management` (8 grupos no total)
- Suporte ao GeekHunter no Browser MCP Engine

### Melhorado
- Estratégia Brasil-first ajustada de 80%/20% para 92%/8%
- Servidor faz bind em `0.0.0.0` por default (necessário para Render.com)
- `KAIROS_LOCAL_ONLY=true` para restringir ao loopback localmente

### Corrigido
- Servidor não detectado pelo Render em produção (bind em 127.0.0.1)

---

## [0.1.0] — 2026-05-10

### Adicionado
- Pipeline de coleta, normalização, ranking e deduplicação de vagas
- Fontes: LinkedIn, Himalayas, Get on Board, Greenhouse, Lever, Remotive, RemoteOK, Manual JSON
- Estratégia Brasil-first (80%/20%)
- 7 grupos de relatório por senioridade/categoria (V2)
- Relatórios Markdown e CSV por grupo
- Browser MCP Engine (opt-in) com 9 adaptadores de sites
- Web UI React com filtros básicos e tema dark/light
- REST API com autenticação por bearer token
- Deploy no Render.com via `render.yaml`
- CI/CD via GitHub Actions (Node 20 + 22)
