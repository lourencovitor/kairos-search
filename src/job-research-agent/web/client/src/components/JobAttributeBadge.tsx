import { Box, Typography } from '@mui/material';

interface JobAttributeBadgeProps {
  remotePolicy: string;
  jobMarket: string;
  isDark: boolean;
}

export function JobAttributeBadge({ remotePolicy, jobMarket, isDark }: JobAttributeBadgeProps) {
  let label = '';
  let bg = '';
  let color = '';

  if (remotePolicy === 'remote') {
    label = 'Remoto';
    bg = isDark ? 'rgba(5,150,105,0.2)' : '#D1FAE5';
    color = isDark ? '#34D399' : '#065F46';
  } else if (jobMarket === 'international') {
    label = 'Global';
    bg = isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE';
    color = isDark ? '#60A5FA' : '#1E3A5F';
  } else if (remotePolicy === 'hybrid') {
    label = 'Híbrido';
    bg = isDark ? 'rgba(100,116,139,0.2)' : '#F1F5F9';
    color = isDark ? '#94A3B8' : '#475569';
  } else if (jobMarket === 'brazil_friendly') {
    label = 'BR ok';
    bg = isDark ? 'rgba(139,92,246,0.2)' : '#EDE9FE';
    color = isDark ? '#A78BFA' : '#4C1D95';
  } else if (jobMarket === 'latam') {
    label = 'LATAM';
    bg = isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7';
    color = isDark ? '#FCD34D' : '#92400E';
  } else {
    return null;
  }

  return (
    <Box
      sx={{
        px: '5px',
        py: '1.5px',
        borderRadius: '3px',
        bgcolor: bg,
        textAlign: 'center',
        width: '100%',
      }}
    >
      <Typography
        sx={{
          fontSize: '0.49rem',
          fontWeight: 700,
          color,
          lineHeight: 1.4,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
