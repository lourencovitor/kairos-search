import { Box, Typography } from '@mui/material';

function scoreColor(score: number): string {
  if (score >= 75) return '#34d399';
  if (score >= 50) return '#2dd4bf';
  if (score >= 30) return '#fbbf24';
  return '#f87171';
}

export function ScoreGauge({ score, size = 120 }: { score: number; size?: number }) {
  const color = scoreColor(score);
  const pct = Math.min(100, Math.max(0, score));

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `conic-gradient(${color} ${pct}%, rgba(148,163,184,0.15) 0)`,
      }}
    >
      <Box
        sx={{
          width: size - 18,
          height: size - 18,
          borderRadius: '50%',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1, color }}>
          {score}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          / 100
        </Typography>
      </Box>
    </Box>
  );
}
