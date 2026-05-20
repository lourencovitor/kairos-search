import { useEffect, useId, useRef, useState } from 'react';

import { Box, Typography, alpha, useTheme } from '@mui/material';

interface GradientStop {
  readonly offset: string;
  readonly color: string;
}

interface ScorePalette {
  readonly gradient: readonly GradientStop[];
  readonly label: string;
  readonly accent: string;
  readonly glow: string;
}

function palette(score: number): ScorePalette {
  if (score >= 80) {
    return {
      gradient: [
        { offset: '0%', color: '#34D399' },
        { offset: '100%', color: '#10B981' },
      ],
      accent: '#10B981',
      label: 'Excelente fit',
      glow: 'rgba(16,185,129,0.45)',
    };
  }
  if (score >= 60) {
    return {
      gradient: [
        { offset: '0%', color: '#22D3EE' },
        { offset: '100%', color: '#3D7EBF' },
      ],
      accent: '#3D7EBF',
      label: 'Bom fit',
      glow: 'rgba(61,126,191,0.4)',
    };
  }
  if (score >= 40) {
    return {
      gradient: [
        { offset: '0%', color: '#FBBF24' },
        { offset: '100%', color: '#F59E0B' },
      ],
      accent: '#F59E0B',
      label: 'Fit moderado',
      glow: 'rgba(245,158,11,0.4)',
    };
  }
  return {
    gradient: [
      { offset: '0%', color: '#FB7185' },
      { offset: '100%', color: '#EF4444' },
    ],
    accent: '#EF4444',
    label: 'Fit baixo',
    glow: 'rgba(239,68,68,0.4)',
  };
}

function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

export function ScoreGauge({
  score,
  size = 156,
  showLabel = true,
}: {
  readonly score: number;
  readonly size?: number;
  readonly showLabel?: boolean;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const id = useId().replace(/:/g, '');
  const gradientId = `score-grad-${id}`;
  const glowId = `score-glow-${id}`;

  const clipped = Math.max(0, Math.min(100, score));
  const animated = useCountUp(clipped);
  const p = palette(clipped);

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (animated / 100) * circumference;
  const trackColor = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,31,46,0.08)';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          position: 'relative',
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: `drop-shadow(0 12px 28px ${p.glow})`,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {p.gradient.map((g) => (
                <stop key={g.offset} offset={g.offset} stopColor={g.color} />
              ))}
            </linearGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            filter={`url(#${glowId})`}
            style={{ transition: 'stroke-dasharray 0.4s ease-out' }}
          />
        </svg>
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: size - stroke * 2 - 8,
            height: size - stroke * 2 - 8,
            borderRadius: '50%',
            background: isDark
              ? `radial-gradient(circle at 50% 30%, ${alpha(p.accent, 0.18)} 0%, ${theme.palette.background.paper} 70%)`
              : `radial-gradient(circle at 50% 30%, ${alpha(p.accent, 0.08)} 0%, ${theme.palette.background.paper} 70%)`,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,31,46,0.06)',
          }}
        >
          <Typography
            sx={{
              fontSize: `${size * 0.28}px`,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.04em',
              background: `linear-gradient(135deg, ${p.gradient[0].color}, ${p.gradient[1].color})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {animated}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              mt: 0.4,
            }}
          >
            / 100
          </Typography>
        </Box>
      </Box>
      {showLabel && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 0.4,
            borderRadius: 99,
            bgcolor: alpha(p.accent, isDark ? 0.18 : 0.1),
            border: `1px solid ${alpha(p.accent, isDark ? 0.4 : 0.28)}`,
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: p.accent,
              boxShadow: `0 0 0 3px ${alpha(p.accent, 0.25)}`,
            }}
          />
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: p.accent }}>
            {p.label}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
