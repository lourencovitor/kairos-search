import type { ReactNode } from 'react';

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Box,
  Chip,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';

import type { MatcherBreakdown } from '../api/types.js';
import { MATCHER_LABELS, SENIORITY_LABELS } from '../labels.js';

function pluralizeAnos(n: number): string {
  return n === 1 ? '1 ano' : `${n} anos`;
}

function MatchChip({
  label,
  matched,
  evidence,
}: {
  readonly label: string;
  readonly matched: boolean;
  readonly evidence?: string;
}) {
  const theme = useTheme();
  const chip = (
    <Chip
      size="small"
      label={label}
      icon={
        matched ? (
          <CheckRoundedIcon sx={{ fontSize: 13 }} />
        ) : (
          <CloseRoundedIcon sx={{ fontSize: 13 }} />
        )
      }
      sx={{
        height: 22,
        fontSize: '0.7rem',
        fontWeight: 600,
        bgcolor: matched
          ? alpha(theme.palette.success.main, 0.12)
          : alpha(theme.palette.text.secondary, 0.08),
        color: matched ? theme.palette.success.dark : theme.palette.text.secondary,
        border: '1px solid',
        borderColor: matched
          ? alpha(theme.palette.success.main, 0.32)
          : alpha(theme.palette.text.secondary, 0.18),
        '& .MuiChip-icon': {
          color: matched ? theme.palette.success.main : theme.palette.text.secondary,
          ml: '6px',
          mr: '-2px',
        },
        '& .MuiChip-label': { px: 0.85 },
      }}
    />
  );

  if (!matched || !evidence) return chip;

  return (
    <Tooltip
      arrow
      placement="top"
      title={
        <Box sx={{ p: 0.25, maxWidth: 320 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 0.4 }}>
            Trecho do seu CV
          </Typography>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.78)',
              fontStyle: 'italic',
              lineHeight: 1.5,
            }}
          >
            “…{evidence}…”
          </Typography>
        </Box>
      }
    >
      <Box sx={{ display: 'inline-flex', cursor: 'help' }}>{chip}</Box>
    </Tooltip>
  );
}

function ChipRow({
  caption,
  captionColor,
  children,
}: {
  readonly caption: string;
  readonly captionColor: string;
  readonly children: ReactNode;
}) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: '0.62rem',
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: captionColor,
          mb: 0.65,
        }}
      >
        {caption}
      </Typography>
      <Stack direction="row" spacing={0.6} sx={{ flexWrap: 'wrap' }} useFlexGap>
        {children}
      </Stack>
    </Box>
  );
}

function MatcherDetail({ m }: { readonly m: MatcherBreakdown }) {
  const theme = useTheme();
  const d = m.details;

  switch (m.name) {
    case 'skill': {
      const matched = (d['matchedRequired'] as string[] | undefined) ?? [];
      const missing = (d['missingRequired'] as string[] | undefined) ?? [];
      const evidence = (d['matchedEvidence'] as Record<string, string> | undefined) ?? {};
      if (matched.length === 0 && missing.length === 0) return null;
      return (
        <Stack spacing={1.25} sx={{ mt: 1.25 }}>
          {matched.length > 0 && (
            <ChipRow caption="Detectados no CV" captionColor={theme.palette.success.main}>
              {matched.map((name) => (
                <MatchChip key={name} label={name} matched evidence={evidence[name]} />
              ))}
            </ChipRow>
          )}
          {missing.length > 0 && (
            <ChipRow caption="Sem evidência clara" captionColor={theme.palette.text.secondary}>
              {missing.map((name) => (
                <MatchChip key={name} label={name} matched={false} />
              ))}
            </ChipRow>
          )}
        </Stack>
      );
    }

    case 'seniority': {
      const cand = String(d['candidate'] ?? 'unknown');
      const job = String(d['job'] ?? 'unknown');
      const distance = Number(d['distance'] ?? 0);
      const distanceLabel =
        distance === 0
          ? 'mesmo nível'
          : distance === 1
            ? '1 degrau de diferença'
            : `${distance} degraus de diferença`;
      return (
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'text.secondary',
            mt: 0.85,
            lineHeight: 1.55,
          }}
        >
          Seu CV:{' '}
          <Box component="strong" sx={{ color: 'text.primary' }}>
            {SENIORITY_LABELS[cand] ?? cand}
          </Box>
          {' · '}Vaga:{' '}
          <Box component="strong" sx={{ color: 'text.primary' }}>
            {SENIORITY_LABELS[job] ?? job}
          </Box>
          {' · '}
          {distanceLabel}.
        </Typography>
      );
    }

    case 'experience': {
      const years = Number(d['candidateYears'] ?? 0);
      const req = d['yearsRequiredMin'];
      if (req === null || req === undefined) {
        return (
          <Typography
            sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.85, lineHeight: 1.55 }}
          >
            {pluralizeAnos(years)} de experiência detectados no CV.
          </Typography>
        );
      }
      const gap = Number(d['gap'] ?? 0);
      const surplus = gap >= 0;
      return (
        <Typography
          sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.85, lineHeight: 1.55 }}
        >
          {pluralizeAnos(years)} no CV{' · '}mínimo pedido ~{String(req)}
          {' · '}
          <Box component="strong" sx={{ color: surplus ? 'success.main' : 'warning.main' }}>
            {surplus
              ? `${pluralizeAnos(gap)} acima do mínimo`
              : `${pluralizeAnos(Math.abs(gap))} abaixo do mínimo`}
          </Box>
          .
        </Typography>
      );
    }

    case 'language': {
      const gaps = (d['proficiencyGaps'] as string[] | undefined) ?? [];
      const matched = (d['matched'] as string[] | undefined) ?? [];
      const items: string[] = [];
      if (matched.length > 0) items.push(`Idiomas atendidos: ${matched.join(', ')}.`);
      gaps.forEach((g) => items.push(g));
      if (items.length === 0) return null;
      return (
        <Stack spacing={0.4} sx={{ mt: 0.85 }}>
          {items.map((line, i) => (
            <Typography
              key={i}
              sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.55 }}
            >
              {line}
            </Typography>
          ))}
        </Stack>
      );
    }

    case 'location': {
      const policy = String(d['jobPolicy'] ?? '');
      if (!policy) return null;
      return (
        <Typography
          sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.85, lineHeight: 1.55 }}
        >
          Política de trabalho da vaga:{' '}
          <Box component="strong" sx={{ color: 'text.primary' }}>
            {policy}
          </Box>
          .
        </Typography>
      );
    }

    case 'region': {
      const region = String(d['jobRegion'] ?? '');
      const compatible = d['brazilCompatible'];
      const fragments: ReactNode[] = [];
      if (region) {
        fragments.push(
          <Box component="span" key="region">
            Região da vaga:{' '}
            <Box component="strong" sx={{ color: 'text.primary' }}>
              {region}
            </Box>
            .
          </Box>,
        );
      }
      if (compatible === true) {
        fragments.push(
          <Box component="span" key="brazil-ok">
            {fragments.length > 0 ? ' ' : ''}Brasil identificado no CV.
          </Box>,
        );
      } else if (compatible === false) {
        fragments.push(
          <Box component="span" key="brazil-missing">
            {fragments.length > 0 ? ' ' : ''}Sem menção clara a Brasil no CV.
          </Box>,
        );
      }
      if (fragments.length === 0) return null;
      return (
        <Typography
          sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.85, lineHeight: 1.55 }}
        >
          {fragments}
        </Typography>
      );
    }

    default:
      return null;
  }
}

function trackColorForScore(pct: number, theme: Theme): string {
  if (pct >= 75) return theme.palette.success.main;
  if (pct >= 40) return theme.palette.warning.main;
  return theme.palette.error.main;
}

export function ScoreBreakdownView({ matchers }: { matchers: readonly MatcherBreakdown[] }) {
  const theme = useTheme();
  return (
    <Stack spacing={2.5}>
      {matchers.map((m) => {
        const pct = Math.round(m.score01 * 100);
        const barColor = trackColorForScore(pct, theme);
        return (
          <Box key={m.name}>
            <Stack
              direction="row"
              sx={{ mb: 0.6, justifyContent: 'space-between', alignItems: 'baseline' }}
            >
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  letterSpacing: '-0.005em',
                  color: 'text.primary',
                }}
              >
                {MATCHER_LABELS[m.name] ?? m.name}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <Box component="strong" sx={{ color: 'text.primary', fontWeight: 700 }}>
                  +{m.contribution}
                </Box>
                {` / ${m.weight} pts`}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(barColor, 0.12),
                '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 3 },
              }}
            />
            <MatcherDetail m={m} />
          </Box>
        );
      })}
    </Stack>
  );
}
