# Contribuindo — Kairos

Obrigado pelo interesse em contribuir! Este guia explica como participar, desde reportar um bug até abrir um PR.

## Onde começar?

- **Bug?** Abra uma [issue de bug](https://github.com/lourencovitor/kairos-search/issues/new?template=bug_report.yml)
- **Ideia ou melhoria?** Abra uma [feature request](https://github.com/lourencovitor/kairos-search/issues/new?template=feature_request.yml)
- **Quer contribuir com código?** Leia este guia até o final

## Pré-requisitos

- Node.js >= 20.0.0
- pnpm >= 10

```bash
pnpm install
```

## Antes de abrir um PR

Os seguintes comandos devem passar sem erros:

```bash
pnpm typecheck     # TypeScript sem erros
pnpm lint          # ESLint sem erros
pnpm test          # Todos os testes passando
pnpm build:client  # Frontend buildando sem erros
```

O pre-commit hook (husky) roda lint e format automaticamente nos arquivos staged. Se o hook falhar, corrija antes de commitar.

## Convenções de branch

```
feat/nome-da-feature
fix/descricao-do-bug
chore/tarefa-de-manutencao
docs/descricao-da-documentacao
refactor/descricao-do-refactor
```

## Convenções de commit

Mensagens em **português**, formato:

```
tipo(escopo): descrição curta no imperativo

corpo opcional explicando o porquê (não o quê)
```

Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`

```bash
# Exemplos
feat(sources): adicionar suporte ao Revelo como fonte
fix(ranker): corrigir cálculo de score para vagas internacionais
chore(data): atualizar vagas e build
docs(api): documentar endpoint de upload
test(normalizer): adicionar casos para remote policy desconhecida
```

## Como adicionar uma nova fonte de vagas

Veja [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md#como-adicionar-uma-nova-fonte-http) para o passo a passo completo com código de exemplo.

## Abrindo o PR

1. Fork o repositório
2. Crie uma branch a partir de `main`
3. Implemente e teste
4. Abra o PR contra `main` — o template de PR já aparece automaticamente com o checklist

## Dúvidas?

Abra uma issue com a label `question` ou comente diretamente em um PR/issue existente.
