# Desenvolvimento — Kairos

## Convenções

### Linguagem

- Código-fonte: **inglês** (nomes de variáveis, funções, tipos, comentários)
- Commits: **português** (mensagens de commit)
- Documentação: **português**

### TypeScript

- `strict: true` habilitado
- `noUncheckedIndexedAccess: true` — acesso a arrays e objetos sempre deve tratar `undefined`
- Sem `any` explícito sem justificativa
- Tipos de domínio centralizados em `domain/job.types.ts`

### Estrutura de arquivo

Cada source, skill, service e route vive em seu próprio arquivo. Sem barrels (`index.ts`) que reexportem tudo — imports são diretos.

### Testes

Todo arquivo em `skills/`, `report/` e `web/services/` deve ter cobertura mínima de:
- Statements: 80%
- Branches: 70%
- Functions: 80%

Teste em `*.test.ts` ao lado do arquivo correspondente.

## Fluxo de desenvolvimento

```bash
# 1. Instale dependências
pnpm install

# 2. Rode em modo dev
pnpm job-web

# 3. Antes de commitar
pnpm typecheck
pnpm lint
pnpm test
```

O pre-commit hook (husky + lint-staged) roda ESLint e Prettier automaticamente nos arquivos staged.

## Como adicionar uma nova fonte HTTP

1. Crie `src/job-research-agent/sources/minha-fonte.source.ts`
2. Implemente a interface `JobSource`:
   ```typescript
   import type { JobSource, RawJobPosting } from '../domain/job.types.js';
   import type { JobResearchConfig } from '../config/job-research.config.js';

   export class MinhaFonteSource implements JobSource {
     async fetch(config: JobResearchConfig): Promise<RawJobPosting[]> {
       // ...
     }
   }
   ```
3. Adicione configuração em `src/job-research-agent/config/job-research.config.ts`:
   ```typescript
   minhaFonte: {
     enabled: true,
     // outros parâmetros
   }
   ```
4. Registre a fonte em `src/job-research-agent/index.ts` no array de sources
5. Escreva testes em `minha-fonte.source.test.ts`

## Como adicionar um novo site ao Browser MCP

1. Crie `src/job-research-agent/sources/browser-mcp/site-adapters/meu-site.adapter.ts`
2. Implemente a interface `SiteAdapter`
3. Registre em `site-adapters/index.ts`
4. Adicione configuração em `job-research.config.ts` sob `browserMcp.sites`

## Como adicionar um novo grupo de relatório

1. Adicione o valor em `SeniorityReportGroupV2` em `domain/job.types.ts`
2. Atualize `toSeniorityReportGroupV2()` em `shared/job-taxonomy.util.ts` com a nova regra de mapeamento
3. Atualize `CsvReportGenerator` em `report/csv-report.generator.ts` para gerar o novo CSV
4. Atualize o frontend: `src/job-research-agent/web/client/src/utils/report-group.ts`

## Como rodar testes

```bash
pnpm test                    # todos os testes (sem watch)
vitest                       # modo watch
vitest --coverage            # com relatório de cobertura
vitest path/to/file.test.ts  # arquivo específico
```

Cobertura gerada em `coverage/`. Thresholds configurados em `vitest.config.ts`.

## Como debugar

### Pipeline CLI

Adicione `console.log` temporariamente — o output vai direto para o terminal.

Para inspecionar um run já executado:
```bash
cat data/job-research/latest/filter-funnel.json   # rejeições por etapa
cat data/job-research/latest/summary.json          # distribuição de mercado
cat data/job-research/latest/ranked-jobs.json      # todos os jobs ranqueados
```

### Browser MCP

Com o Browser MCP ativo, o trace de navegação fica em:
```bash
cat data/job-research/latest/browser-mcp-trace.json
```

### Servidor web

Logs vão para stdout. Em produção (Render.com), acompanhe pelo dashboard.

## Linting e formatação

```bash
pnpm lint          # ESLint
pnpm lint:fix      # ESLint com auto-fix
pnpm format        # Prettier (escreve)
pnpm format:check  # Prettier (apenas verifica)
```

Imports são ordenados automaticamente pelo Prettier via `@trivago/prettier-plugin-sort-imports`.

## Build do frontend

```bash
pnpm build:client
```

O build vai para `dist/`. Em produção, o servidor serve este diretório estaticamente.

> O build requer Node.js >= 20.19 ou 22.12 (restrição do Vite 8). Em dev, qualquer Node 20+ funciona.

## Erros comuns

**TypeScript não encontra módulo após criar um arquivo novo:**
O projeto usa `.js` nas importações TypeScript (NodeNext module resolution). Ao importar seu novo arquivo, use:
```typescript
import { MinhaFonte } from './minha-fonte.source.js';  // .js, não .ts
```

**Testes falham com "Cannot find module":**
Verifique se o arquivo de teste usa a mesma convenção de extensão `.js` nos imports.

**`pnpm test` passa mas coverage falha:**
Os thresholds de cobertura são obrigatórios. Se adicionou código novo sem testes, o pipeline de CI vai falhar. Escreva testes ou ajuste os thresholds com justificativa.
