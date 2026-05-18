import { Box, Typography } from '@mui/material';

import { avatarColor } from '../utils/color-theme.js';

interface CompanyAvatarProps {
  name: string;
  highlight?: boolean;
}

export function CompanyAvatar({ name, highlight }: CompanyAvatarProps) {
  const color = avatarColor(name);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '12px',
          bgcolor: color.bg,
          border: `1.5px solid ${highlight ? '#F59E0B' : color.border}`,
          boxShadow: highlight
            ? '0 2px 8px rgba(0,0,0,0.08), 0 0 0 2.5px rgba(245,158,11,0.35)'
            : '0 2px 8px rgba(0,0,0,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: initials.length > 1 ? '0.83rem' : '1.1rem',
            lineHeight: 1,
            color: color.text,
            userSelect: 'none',
            letterSpacing: '-0.03em',
          }}
        >
          {initials}
        </Typography>
      </Box>
      {highlight && (
        <Box
          sx={{
            position: 'absolute',
            top: -3,
            right: -3,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            border: '1.5px solid white',
            boxShadow: '0 1px 4px rgba(245,158,11,0.5)',
          }}
        />
      )}
    </Box>
  );
}
