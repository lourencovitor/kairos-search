# Prompt: Implementar BrowserMcpTransport Real + Validação End-to-End

## Objetivo

Implementar o BrowserMcpTransport real para conectar o job-search-engine ao servidor MCP da extensão Browser MCP (browsermcp.io) que está instalada e conectada no Chrome do usuário. Após implementar, executar o pipeline completo e validar que vagas reais são coletadas via navegador e CSVs são gerados corretamente.

## Contexto do projeto

- Projeto: `/Users/vitorlourenco/projects/job-search-engine`
- Stack: TypeScript, ESM (`type: "module"`), NodeNext, pnpm
- O spec completo está em `.kiro/specs/browsermcp-job-search-engine/` (requirements.md, design.md, tasks.md) — todas as 45 tasks estão completas
- O `BrowserMcpClient` já existe em `src/job-research-agent/sources/browser-mcp/browser-mcp.client.ts`
- Os 9 site adapters já existem e funcionam com fixtures de teste (296 testes passando)
- A interface `BrowserMcpTransport` está definida em `src/job-research-agent/sources/browser-mcp/browser-mcp.types.ts`:

```ts
interface BrowserMcpTransport {
  invoke<T = unknown>(tool: BrowserMcpToolName, args: Record<string, unknown>): Promise<T>;
  close(): Promise<void>;
}
```

- O transport atual é um **STUB** em `src/job-research-agent/index.ts` (função `createDefaultBrowserMcpEngine`) que lança `"BrowserMcpTransport not configured"`
- A extensão Browser MCP está instalada no Chrome e conectada (botão mostra "Disconnect")
- O CLI já suporta as flags `--browser-mcp`, `--browser-mcp-only`, `--browser-mcp-site=<id>`

## O que precisa ser implementado

### 1. Descobrir o protocolo de conexão da extensão Browser MCP

- Pesquisar como o browsermcp.io expõe o servidor MCP (SSE em localhost? stdio via npx? WebSocket?)
- Verificar se existe pacote npm oficial (ex: `@anthropic-ai/browser-mcp`, `@anthropic-ai/mcp-client`, `@anthropic-ai/browser-connector`, `@nicepkg/browser-mcp`, ou similar)
- Consultar https://browsermcp.io e docs para entender o mecanismo de conexão
- Verificar se a extensão expõe uma porta local quando conectada (ex: `http://localhost:3000/sse`)

### 2. Implementar o transport real

Criar novo arquivo: `src/job-research-agent/sources/browser-mcp/browser-mcp-transport.real.ts`

- Deve implementar a interface `BrowserMcpTransport`
- Usar `@modelcontextprotocol/sdk` se aplicável, ou conexão direta via SSE/WebSocket
- `invoke()` deve chamar as ferramentas: `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_screenshot`
- `close()` deve desconectar limpo
- Tratar timeouts e erros de conexão graciosamente
- Exportar uma factory function: `createRealBrowserMcpTransport(options?: { serverUrl?: string }): BrowserMcpTransport`

### 3. Atualizar `createDefaultBrowserMcpEngine`

Em `src/job-research-agent/index.ts`:

- Quando `browserMcp.enabled=true`, usar o transport real em vez do stub
- Manter o stub como fallback se a dependência não estiver instalada (try/catch no import dinâmico)
- Se o transport real falhar ao importar, logar warning e usar o stub

### 4. Adicionar dependências necessárias

Via pnpm (ex: `@modelcontextprotocol/sdk`, ou o pacote específico do browsermcp.io)

### 5. Atualizar a config se necessário

Se o transport precisar de parâmetros (porta, URL do servidor SSE), adicionar em `config.browserMcp` (ex: `browserMcp.serverUrl: string`)

## Restrições de segurança (manter do design original)

- NÃO clicar em botões de Apply/Candidatar-se (blacklist já implementada no client)
- NÃO armazenar credenciais
- NÃO enviar dados do repositório para fora
- Respeitar `rateLimitMs` por site (já implementado no client)
- Respeitar `globalMaxPages` (já implementado no client)

## Validação — OBRIGATÓRIO

Após implementar, DEVE executar o pipeline real e validar que funciona end-to-end. Não basta unit test — precisa ver vagas reais sendo coletadas e CSVs gerados.

### Passo 1: Garantir que a suite existente não quebrou

```bash
pnpm test && pnpm typecheck
```

Todos os 296+ testes devem continuar passando.

### Passo 2: Executar o pipeline com Browser MCP no ProgramaThor

Pré-requisito: a extensão Browser MCP deve estar conectada no Chrome com uma aba aberta no ProgramaThor.

```bash
pnpm job-research --browser-mcp-only --browser-mcp-site=programathor
```

### Passo 3: Validar o output do pipeline

O output no terminal deve mostrar:

- `Raw jobs fetched: N` onde N > 0
- `Browser MCP summary (enabled): fetched=N` onde N > 0
- Pelo menos um CSV gerado (ex: `report-pleno.csv`, `report-senior.csv`)

### Passo 4: Validar os CSVs gerados

Verificar em `data/job-research/latest/`:

- Deve existir pelo menos um `report-*.csv` com vagas reais do ProgramaThor
- Abrir o CSV e confirmar:
  - Coluna `source` = `linkedin` ou outra fonte? NÃO — deve ser via `browser_mcp`
  - Coluna `url` aponta para vagas reais no programathor.com (URLs absolutas)
  - Coluna `company` tem nomes de empresas reais
  - Coluna `title` tem títulos de vagas reais
  - Coluna `report_group` está preenchida (junior, pleno, senior, staff, arq, qa, devops)
  - Coluna `score` >= 50 (minReportScore)

### Passo 5: Validar o report.md

Verificar em `data/job-research/latest/report.md`:

- Seção `## Reports by Group (V2)` deve existir
- Linha `Browser MCP: enabled (programathor=N)` deve mostrar N > 0
- Pelo menos um grupo V2 deve ter tabela com vagas

### Passo 6: Se falhar, diagnosticar e corrigir

- Se "connect timed out" → verificar porta/URL do servidor MCP da extensão
- Se "requires_manual_login" → extensão não está na página certa, ou o site pede login
- Se "extraction_zero_results" → seletores do adapter podem estar desatualizados para o layout atual do ProgramaThor; inspecionar o DOM real e atualizar os seletores
- Se "rate_limited_or_captcha" → o site bloqueou; esperar e tentar novamente
- Ajustar e re-testar até funcionar

### Passo 7: Testar com um segundo site (opcional mas recomendado)

Se o ProgramaThor funcionar, testar também com LinkedIn (requer estar logado):

```bash
pnpm job-research --browser-mcp-only --browser-mcp-site=linkedin
```

## Resultado esperado final

Ao rodar `pnpm job-research --browser-mcp-only --browser-mcp-site=programathor`:

1. O pipeline conecta ao Browser MCP via extensão Chrome
2. Navega no ProgramaThor usando o navegador do usuário (sessão já autenticada)
3. Extrai vagas reais (títulos, empresas, URLs, localização)
4. Normaliza, filtra, rankeia e classifica nos grupos V2
5. Gera CSVs em `data/job-research/latest/` com vagas reais coletadas via browser
6. Imprime no terminal: `Browser MCP summary (enabled): fetched=N` com N > 0
7. O `report.md` mostra a seção V2 com vagas do ProgramaThor
8. `pnpm test` continua passando (296+ testes)
