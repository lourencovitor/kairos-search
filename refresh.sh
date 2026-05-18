#!/usr/bin/env bash
set -euo pipefail

# Load .env.local if present (for KAIROS_URL and KAIROS_UPLOAD_KEY)
if [ -f .env.local ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env.local
  set +o allexport
fi

echo "▶ Rodando job research..."
pnpm job-research

# ── Upload dados para o servidor de produção ──────────────────────────────────
if [ -n "${KAIROS_URL:-}" ] && [ -n "${KAIROS_UPLOAD_KEY:-}" ]; then
  echo ""
  echo "▶ Enviando dados para $KAIROS_URL ..."
  LATEST="data/job-research/latest"
  FAILED=0

  for f in \
    summary.json ranked-jobs.json selected-jobs.json filter-funnel.json \
    report.csv report.md \
    report-junior.csv report-pleno.csv report-mid-level.csv \
    report-senior.csv report-senior-plus.csv report-staff.csv \
    report-arq.csv report-architect.csv report-qa.csv \
    report-devops.csv report-management.csv report-tech-lead.csv
  do
    [ -f "$LATEST/$f" ] || continue
    if curl -sf -X POST \
        -H "Authorization: Bearer $KAIROS_UPLOAD_KEY" \
        -H "Content-Type: application/octet-stream" \
        --data-binary "@$LATEST/$f" \
        "$KAIROS_URL/api/upload-latest/$f" \
        --max-time 60 > /dev/null; then
      echo "  ✓ $f"
    else
      echo "  ✗ $f (falhou)"
      FAILED=$((FAILED + 1))
    fi
  done

  if [ "$FAILED" -gt 0 ]; then
    echo "  ⚠ $FAILED arquivo(s) falharam no upload."
  fi
else
  echo ""
  echo "  (Skipping upload: KAIROS_URL ou KAIROS_UPLOAD_KEY não configurados)"
fi

echo ""
echo "▶ Buildando client..."
pnpm build:client

echo ""
echo "▶ Commitando dados e build..."
git add data/job-research/latest/ dist/
git diff --cached --quiet && { echo "Nada mudou, nada a commitar."; exit 0; }
git commit -m "chore(data): atualizar vagas e build — $(date '+%Y-%m-%d %H:%M')"

echo ""
echo "▶ Fazendo push..."
git push

echo ""
echo "✓ Dados enviados ao servidor e backup no git."
