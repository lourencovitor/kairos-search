# API REST — Kairos

Base URL em desenvolvimento: `http://localhost:3355`

## Autenticação

Todos os endpoints `/api/*` suportam autenticação por bearer token:

```
Authorization: Bearer <KAIROS_API_TOKEN>
```

Se `KAIROS_API_TOKEN` não estiver configurado, os endpoints são acessíveis sem autenticação. Em deploys públicos, defina o token.

O endpoint `POST /api/upload-latest/:file` usa autenticação separada via header `x-upload-key`.

## Rate limiting

60 requisições por minuto por IP. Resposta em caso de limite excedido: `429 Too Many Requests`.

## Endpoints

### `GET /api/latest`

Retorna o payload do run mais recente, incluindo todas as vagas selecionadas.

**Auth:** Bearer token (se configurado)

**Response 200:**
```json
{
  "jobs": [
    {
      "id": "abc123",
      "title": "Senior Software Engineer",
      "companyName": "Acme Corp",
      "locationText": "Remote, Brazil",
      "url": "https://...",
      "remotePolicy": "remote",
      "jobMarket": "brazil",
      "score": 78,
      "seniority": "senior",
      "roleCategory": "software_engineering",
      "stackSignals": ["TypeScript", "React", "AWS"],
      "postedAt": "2026-05-15T00:00:00.000Z",
      "sourceName": "linkedin",
      "sourceTier": "brazil_public_api"
    }
  ],
  "summary": {
    "totalRawJobs": 847,
    "rankedJobs": 523,
    "selectedJobs": 100,
    "marketDistribution": {
      "brazil": 60,
      "brazil_friendly": 15,
      "latam": 10,
      "international": 12,
      "unclear": 3
    }
  },
  "downloads": [
    { "name": "report.csv", "label": "Todas as vagas (CSV)" },
    { "name": "report-senior.csv", "label": "Senior" }
  ],
  "generatedAt": "2026-05-19T10:00:00.000Z"
}
```

**Response 404:** Nenhum run disponível ainda.

---

### `POST /api/run`

Inicia um novo pipeline de coleta de vagas em background.

**Auth:** Bearer token obrigatório (se `KAIROS_API_TOKEN` configurado)

**Body:** `{}` (vazio) ou sem body

**Response 202:**
```json
{ "message": "Run started" }
```

**Response 409:**
```json
{ "error": "Run already in progress" }
```

Um run em progresso bloqueia novos runs. Aguarde ele terminar antes de disparar outro.

---

### `GET /api/status`

Retorna o status do run em progresso (se houver).

**Auth:** Bearer token (se configurado)

**Response 200 — run em progresso:**
```json
{
  "running": true,
  "startedAt": "2026-05-19T10:00:00.000Z"
}
```

**Response 200 — sem run ativo:**
```json
{ "running": false }
```

---

### `GET /api/download/:file`

Baixa um arquivo específico do run mais recente.

**Auth:** Bearer token (se configurado)

**Parâmetros:**
- `file` — Nome do arquivo. Valores válidos: `report.csv`, `report.md`, `report-junior.csv`, `report-pleno.csv`, `report-senior.csv`, `report-staff.csv`, `report-arq.csv`, `report-qa.csv`, `report-devops.csv`, `report-management.csv`, `summary.json`, `selected-jobs.json`

**Response 200:** Arquivo com Content-Type adequado e `Content-Disposition: attachment`.

**Response 404:** Arquivo não encontrado (run não executado ou arquivo não gerado).

---

### `GET /api/download-all`

Baixa um ZIP com todos os artefatos do run mais recente.

**Auth:** Bearer token (se configurado)

**Response 200:** Arquivo ZIP com Content-Disposition: attachment; filename="kairos-latest.zip".

**Response 404:** Nenhum run disponível.

---

### `POST /api/upload-latest/:file`

Endpoint para upload de dados de um run externo. Usado pelo `refresh.sh` para enviar dados novos ao servidor de produção sem um redeploy completo.

**Auth:** Header `x-upload-key: <KAIROS_UPLOAD_KEY>`

**Parâmetros:**
- `file` — Nome do arquivo a ser salvo em `data/job-research/latest/`

**Body:** Conteúdo do arquivo (text ou JSON)

**Response 200:** Upload confirmado.

**Response 401:** Chave inválida ou ausente.

**Response 503:** `KAIROS_UPLOAD_KEY` não configurado no servidor.

---

## Frontend (SPA)

Qualquer path não coberto pela API retorna `index.html`, permitindo que o React Router (se houver) ou a SPA gerencie a navegação client-side.

## Erros comuns

| Código | Causa |
|---|---|
| 401 | Token ausente ou inválido |
| 404 | Recurso não encontrado (sem run, arquivo inexistente) |
| 409 | Run já em progresso |
| 429 | Rate limit excedido (60 req/min) |
| 503 | Endpoint requer configuração ausente (ex: KAIROS_UPLOAD_KEY) |
