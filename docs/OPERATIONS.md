# Operações — Kairos

## Deploy

### Render.com (configuração atual)

O projeto usa Render.com com o arquivo `render.yaml` na raiz:

```yaml
services:
  - type: web
    name: kairos
    runtime: node
    plan: free
    buildCommand: pnpm install --prod
    startCommand: NODE_ENV=production node_modules/.bin/tsx src/job-research-agent/web/server.ts
```

**Deploy automático:** O Render faz deploy automaticamente a cada push na branch `main`.

**Variáveis de ambiente obrigatórias no Render:**
- `NODE_ENV=production`
- `DISABLE_BROWSER=true` (Render não tem Playwright/display)
- `KAIROS_API_TOKEN` — protege os endpoints de disparo e download
- `KAIROS_UPLOAD_KEY` — necessário para o `refresh.sh` funcionar
- `KAIROS_URL` — URL pública do serviço (ex: `https://kairos.onrender.com`)

**Build em produção (`pnpm install --prod`)** instala apenas dependências de runtime. O frontend deve estar pré-buildado e commitado em `dist/` antes do deploy.

### Rebuild do frontend antes do deploy

```bash
pnpm build:client
git add dist/
git commit -m "chore(data): atualizar build"
git push
```

## Atualizar dados sem redeploy (`refresh.sh`)

O script `refresh.sh` roda o pipeline localmente e envia os resultados para o servidor de produção via `POST /api/upload-latest/:file`:

```bash
./refresh.sh
```

**Pré-requisitos:**
- `KAIROS_URL` e `KAIROS_UPLOAD_KEY` configurados no `.env` local
- Run local completo (o script executa `pnpm job-research` internamente)

Isso permite atualizar os dados sem um novo deploy completo — útil para atualizações diárias de vagas.

## Acompanhar logs

### Em desenvolvimento local

Logs aparecem diretamente no terminal onde `pnpm job-web` foi executado.

### Em produção (Render.com)

1. Acesse o dashboard do Render.com
2. Selecione o serviço `kairos`
3. Clique em **Logs**

Logs incluem: inicialização do servidor, cada requisição HTTP, erros de runtime.

## Health check

O Render verifica periodicamente se o serviço está ativo. O endpoint usado é a raiz `/` (retorna o frontend HTML).

Para verificar manualmente:
```bash
curl -s -o /dev/null -w "%{http_code}" https://kairos.onrender.com/
# Deve retornar 200
```

Para verificar se há dados disponíveis:
```bash
curl -H "Authorization: Bearer <token>" https://kairos.onrender.com/api/latest | jq '.summary'
```

## Investigar erros

### "Nenhuma vaga encontrada" na UI

1. Verifique se há um run executado: `GET /api/latest` deve retornar jobs
2. Se `latest/` estiver vazio, execute o pipeline: `POST /api/run` ou `pnpm job-research` localmente + `refresh.sh`
3. Verifique os logs do servidor para erros de fontes

### Fonte retornando 0 vagas

Verifique o `filter-funnel.json` do último run:
```bash
cat data/job-research/latest/filter-funnel.json
```

Causas comuns:
- Fonte temporariamente fora do ar (verifique `status.source`)
- Limite de rate excedido na fonte
- Mudança na estrutura da API da fonte

### Deploy falhou no Render

1. Verifique os logs de build no dashboard
2. Causas comuns: `pnpm install --prod` falhou, variável de ambiente faltando, frontend não buildado

### Upload via `refresh.sh` falhou

```bash
# Teste manual do endpoint
curl -X POST \
  -H "x-upload-key: <KAIROS_UPLOAD_KEY>" \
  --data-binary @data/job-research/latest/selected-jobs.json \
  https://kairos.onrender.com/api/upload-latest/selected-jobs.json
```

Resposta `503` = `KAIROS_UPLOAD_KEY` não configurado no servidor.
Resposta `401` = chave incorreta.

## Backups

O projeto não implementa backup automático. Os dados ficam em `data/job-research/runs/` e `data/job-research/latest/`.

Em produção (Render free tier), o storage é efêmero — os dados são perdidos em cada redeploy. Por isso o `refresh.sh` existe: para re-popular os dados após um deploy.

**Estratégia recomendada para persistência:**
- Commitar os dados do último run antes de fazer push para produção
- Usar o `refresh.sh` regularmente para manter os dados atualizados

## CI/CD

GitHub Actions em `.github/workflows/ci.yml` roda em todo push para `main` e em Pull Requests:

1. Lint (`pnpm lint`)
2. Typecheck (`pnpm typecheck`)
3. Testes (`pnpm test`)
4. Build do frontend (`pnpm build:client`)

Matrix: Node 20 + Node 22 (Ubuntu latest).

O deploy no Render é independente do CI — acontece via webhook do GitHub configurado no dashboard do Render.
