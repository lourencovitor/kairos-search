# Contribuindo — Kairos

## Pré-requisitos

- Node.js >= 20.0.0
- pnpm >= 10

```bash
pnpm install
```

## Antes de abrir um PR

Certifique-se de que os seguintes comandos passam sem erros:

```bash
pnpm typecheck     # TypeScript sem erros
pnpm lint          # ESLint sem erros
pnpm test          # Todos os testes passando
pnpm build:client  # Frontend buildando
```

O pre-commit hook (husky) roda lint e format automaticamente nos arquivos staged.

## Convenções de branch

```
feat/nome-da-feature
fix/descricao-do-bug
chore/tarefa-de-manutencao
docs/descricao-da-documentacao
refactor/descricao-do-refactor
```

## Convenções de commit

Mensagens em português, formato:

```
tipo(escopo): descrição curta

corpo opcional explicando o porquê
```

Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`

Exemplos:
```
feat(sources): adicionar suporte ao Revelo como fonte
fix(ranker): corrigir cálculo de score para vagas internacionais
chore(data): atualizar vagas e build
docs(api): documentar endpoint de upload
```

## Adicionando uma nova fonte de vagas

Ver [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md#como-adicionar-uma-nova-fonte-http).

## Reportar bugs

Abra uma issue descrevendo:
1. O que aconteceu
2. O que era esperado
3. Como reproduzir
4. Versão do Node.js e output relevante dos logs

## Sugerir melhorias

Abra uma issue descrevendo o problema que a melhoria resolve e, se possível, uma proposta de implementação.
