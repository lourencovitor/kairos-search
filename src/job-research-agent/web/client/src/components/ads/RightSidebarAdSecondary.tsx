import { useEffect, useRef } from 'react';

import { Box, Link, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { ADSENSE_CLIENT, ADS_ENABLED, AD_SLOTS } from '../../utils/constants.js';

export function RightSidebarAdSecondary() {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    if (!ADS_ENABLED) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* noop */
    }
  }, []);

  if (ADS_ENABLED) {
    return (
      <Box ref={ref} sx={{ overflow: 'hidden', minHeight: 90 }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={AD_SLOTS.sidebarBot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </Box>
    );
  }

  return (
    <Box
      component="a"
      href="https://vercel.com"
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        overflow: 'hidden',
        textDecoration: 'none',
        borderRadius: 2,
        display: 'block',
        bgcolor: isDark ? '#0a0a0a' : '#fff',
        border: '1px solid',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: isDark ? '0 6px 24px rgba(255,255,255,0.08)' : '0 6px 24px rgba(0,0,0,0.12)',
        },
      }}
    >
      <Box
        sx={{
          px: 2.5,
          pt: 2,
          pb: 1.75,
          borderBottom: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
          }}
        >
          Patrocinado
        </Typography>
        <Typography
          sx={{ fontSize: '0.59rem', color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.3)' }}
        >
          Vercel
        </Typography>
      </Box>
      <Box sx={{ p: 2.25, display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: '10px',
            flexShrink: 0,
            bgcolor: isDark ? '#fff' : '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: '1.4rem',
              lineHeight: 1,
              userSelect: 'none',
              color: isDark ? '#000' : '#fff',
            }}
          >
            ▲
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.83rem',
              fontWeight: 800,
              color: isDark ? '#fff' : '#000',
              lineHeight: 1.35,
              mb: 0.5,
            }}
          >
            Deploy em segundos.
            <br />
            Escale sem limite.
          </Typography>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
              lineHeight: 1.55,
              mb: 1.25,
            }}
          >
            Frontend, serverless e edge — tudo numa plataforma.
          </Typography>
          <Link
            href="https://vercel.com"
            target="_blank"
            rel="noopener noreferrer"
            underline="none"
            sx={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: isDark ? '#fff' : '#000',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}`,
              pb: '1px',
              '&:hover': { borderBottomColor: isDark ? '#fff' : '#000' },
            }}
          >
            Começar grátis →
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
