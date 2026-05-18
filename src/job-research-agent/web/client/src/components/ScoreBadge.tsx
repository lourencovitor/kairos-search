import { useEffect, useState } from 'react';

import { Box, Typography } from '@mui/material';

import { scoreColors, scoreRangeLabel } from '../utils/color-theme.js';

export { scoreColors, scoreRangeLabel };

interface ScoreBadgeProps {
  score: number;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const [live, setLive] = useState(0);

  useEffect(() => {
    setLive(0);
    const id = setTimeout(() => setLive(score), 80);
    return () => clearTimeout(id);
  }, [score]);

  const sc = scoreColors(score);
  const SIZE = 58;
  const RADIUS = 23;
  const STROKE = 5;
  const circumference = 2 * Math.PI * RADIUS;
  const offset = circumference - (live / 100) * circumference;

  return (
    <Box
      sx={{
        position: 'relative',
        width: SIZE,
        height: SIZE,
        flexShrink: 0,
        filter: score >= 80 ? `drop-shadow(0 0 9px ${sc.stroke}70)` : 'none',
      }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: 'rotate(-90deg)', display: 'block' }}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill={sc.bg}
          stroke={sc.track}
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={sc.stroke}
          strokeWidth={STROKE}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 900, fontSize: '0.93rem', lineHeight: 1, color: sc.text }}>
            {score}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.43rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: sc.text,
              opacity: 0.65,
              lineHeight: 1,
              mt: '2px',
            }}
          >
            fit
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
