# Security Policy — Kairos

## Versões suportadas

Apenas a versão mais recente na branch `main` recebe correções de segurança.

## Reportando uma vulnerabilidade

**Não abra uma issue pública** para vulnerabilidades de segurança — isso expõe o problema antes de estar corrigido.

Envie um e-mail para **vitor.brother17@gmail.com** com:

- Descrição da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestão de correção (se tiver)

Você receberá uma resposta em até **72 horas** com a confirmação do recebimento. Após a análise, comunicaremos o prazo estimado para correção antes de qualquer divulgação pública.

## Escopo

Esta política cobre:

- O servidor HTTP e a REST API (`src/job-research-agent/web/`)
- O pipeline de coleta de vagas (`src/job-research-agent/`)
- Dependências diretas do projeto

**Fora do escopo:**

- Vulnerabilidades em serviços externos (Render.com, APIs de vagas, browsermcp.io)
- Issues em versões de Node.js ou pnpm — reporte diretamente para os respectivos projetos

## Boas práticas para quem contribui

- Nunca commite `.env` ou arquivos com credenciais reais
- Não exponha `KAIROS_API_TOKEN` ou `KAIROS_UPLOAD_KEY` em logs ou outputs
- Valide entradas em endpoints que aceitam dados externos (`/api/upload-latest/:file`)
