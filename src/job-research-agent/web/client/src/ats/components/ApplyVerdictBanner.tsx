import { Box, Divider, Stack, Typography, alpha } from '@mui/material';

import type { ApplyVerdict } from '../api/types.js';

interface VerdictTheme {
  readonly accent: string;
  readonly title: string;
  readonly subtitle: string;
  readonly pill: string;
}

const VERDICT_THEME: Record<ApplyVerdict, VerdictTheme> = {
  apply: {
    accent: '#34d399',
    title: 'Recomendado aplicar',
    subtitle: 'Bom alinhamento com o que o ATS costuma priorizar nesta vaga.',
    pill: 'Aplicar',
  },
  apply_with_risk: {
    accent: '#fbbf24',
    title: 'Aplicar com ressalvas',
    subtitle: 'Vale candidatar, mas ajustes no CV reduzem risco de descarte automático.',
    pill: 'Com ressalvas',
  },
  caution: {
    accent: '#fb923c',
    title: 'Aguardar antes de aplicar',
    subtitle: 'Priorize os ajustes abaixo antes de investir tempo nesta vaga.',
    pill: 'Aguardar',
  },
  do_not_apply: {
    accent: '#f87171',
    title: 'Não recomendado aplicar',
    subtitle: 'O fit estrutural com esta vaga está fraco para passar o filtro do ATS.',
    pill: 'Não aplicar',
  },
};

export function ApplyVerdictPill(props: { readonly verdict: ApplyVerdict }) {
  const t = VERDICT_THEME[props.verdict];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.75,
        borderRadius: 999,
        border: `1px solid ${alpha(t.accent, 0.45)}`,
        bgcolor: alpha(t.accent, 0.1),
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.accent }} />
      <Typography variant="caption" sx={{ fontWeight: 600, color: t.accent }}>
        {t.pill}
      </Typography>
    </Box>
  );
}

export function ApplyVerdictBanner(props: {
  readonly verdict: ApplyVerdict;
  readonly reason: string;
}) {
  const t = VERDICT_THEME[props.verdict];
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${alpha(t.accent, 0.28)}`,
        bgcolor: alpha(t.accent, 0.06),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: t.accent }} />
      <Stack spacing={1.5} sx={{ p: 2.5, pl: 3 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
            Recomendação
          </Typography>
          <ApplyVerdictPill verdict={props.verdict} />
        </Stack>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t.subtitle}
        </Typography>
        <Divider sx={{ borderColor: alpha(t.accent, 0.2) }} />
        <Typography variant="body2">{props.reason}</Typography>
      </Stack>
    </Box>
  );
}
