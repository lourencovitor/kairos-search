#!/usr/bin/env bash
set -euo pipefail

echo "▶ Rodando job research..."
pnpm job-research

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
echo "✓ Render vai atualizar automaticamente."
