import { Box, LinearProgress, Stack, Typography } from '@mui/material';

import type { MatcherBreakdown } from '../api/types.js';
import { MATCHER_LABELS, SENIORITY_LABELS } from '../labels.js';
import { InlineMarkdown } from './InlineMarkdown.js';

function formatMatcherDetails(m: MatcherBreakdown): string[] {
  const d = m.details;
  const lines: string[] = [];

  switch (m.name) {
    case 'skill': {
      const matched = (d['matchedRequired'] as string[] | undefined) ?? [];
      const missing = (d['missingRequired'] as string[] | undefined) ?? [];
      const evidence = (d['matchedEvidence'] as Record<string, string> | undefined) ?? {};
      if (matched.length > 0) {
        lines.push(`Match no CV: ${matched.join(', ')}.`);
        for (const name of matched.slice(0, 4)) {
          if (evidence[name]) {
            lines.push(`• ${name}: “…${evidence[name]}…”`);
          }
        }
      }
      if (missing.length > 0) {
        lines.push(`Sem evidência no CV: ${missing.join(', ')}.`);
      }
      break;
    }
    case 'seniority': {
      const cand = String(d['candidate'] ?? 'unknown');
      const job = String(d['job'] ?? 'unknown');
      lines.push(
        `CV: ${SENIORITY_LABELS[cand] ?? cand}. Vaga: ${SENIORITY_LABELS[job] ?? job}. Distância: ${Number(d['distance'] ?? 0)} degrau(s).`,
      );
      break;
    }
    case 'experience': {
      const years = Number(d['candidateYears'] ?? 0);
      const req = d['yearsRequiredMin'];
      if (req === null || req === undefined) {
        lines.push(`${years} anos detectados.`);
      } else {
        const gap = Number(d['gap'] ?? 0);
        lines.push(
          `${years} anos no CV · mínimo ~${req} · ${gap >= 0 ? `+${gap}` : gap} anos vs exigido.`,
        );
      }
      break;
    }
    case 'language': {
      const gaps = (d['proficiencyGaps'] as string[] | undefined) ?? [];
      const matched = (d['matched'] as string[] | undefined) ?? [];
      if (matched.length > 0) lines.push(`Atende: ${matched.join(', ')}.`);
      for (const g of gaps) lines.push(g);
      break;
    }
    case 'location': {
      const policy = String(d['jobPolicy'] ?? '');
      if (policy) lines.push(`Política da vaga: ${policy}.`);
      break;
    }
    case 'region': {
      const region = String(d['jobRegion'] ?? '');
      if (region) lines.push(`Região da vaga: ${region}.`);
      if (d['brazilCompatible'] === true) lines.push('Brasil confirmado no CV.');
      else if (d['brazilCompatible'] === false) lines.push('Sem menção clara a Brasil no CV.');
      break;
    }
    default:
      break;
  }

  return lines;
}

export function ScoreBreakdownView({ matchers }: { matchers: readonly MatcherBreakdown[] }) {
  return (
    <Stack spacing={2}>
      {matchers.map((m) => {
        const detailLines = formatMatcherDetails(m);
        return (
          <Box key={m.name}>
            <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {MATCHER_LABELS[m.name] ?? m.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                +{m.contribution}/{m.weight} ({Math.round(m.score01 * 100)}%)
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={m.score01 * 100}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'rgba(148,163,184,0.12)',
              }}
            />
            {detailLines.map((line) => (
              <InlineMarkdown
                key={line}
                sx={{
                  display: 'block',
                  fontSize: '0.75rem',
                  lineHeight: 1.55,
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                {line}
              </InlineMarkdown>
            ))}
          </Box>
        );
      })}
    </Stack>
  );
}
