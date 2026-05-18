import { useEffect, useRef } from 'react';

import { Box, Button, Typography } from '@mui/material';

import { ADSENSE_CLIENT, ADS_ENABLED, AD_SLOTS } from '../../utils/constants.js';

interface LeaderboardAdBannerProps {
  isDark: boolean;
}

export function LeaderboardAdBanner({ isDark }: LeaderboardAdBannerProps) {
  const ref = useRef<HTMLDivElement>(null);

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
      <Box ref={ref} sx={{ mb: 2.5, borderRadius: 2, overflow: 'hidden', minHeight: 90 }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={AD_SLOTS.leaderboard}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      </Box>
    );
  }

  return (
    <Box
      component="a"
      href="https://www.rocketseat.com.br"
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'flex',
        textDecoration: 'none',
        mb: 2.5,
        overflow: 'hidden',
        borderRadius: 2,
        border: '1px solid',
        borderColor: isDark ? 'rgba(104,56,255,0.25)' : 'rgba(104,56,255,0.18)',
        background: isDark
          ? 'linear-gradient(135deg, #1a0a2e 0%, #2d1458 60%, #1a1a2e 100%)'
          : 'linear-gradient(135deg, #f5f0ff 0%, #fff7f0 100%)',
        transition: 'box-shadow 0.2s ease',
        '&:hover': { boxShadow: '0 6px 24px rgba(104,56,255,0.28)' },
      }}
    >
      <Box
        sx={{
          width: { xs: 80, md: 128 },
          flexShrink: 0,
          background: 'linear-gradient(160deg, #6838FF 0%, #FF5500 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
        }}
      >
        <Typography
          sx={{ fontSize: { xs: '1.8rem', md: '2.2rem' }, lineHeight: 1, userSelect: 'none' }}
        >
          🚀
        </Typography>
        <Typography
          sx={{
            fontSize: '0.6rem',
            fontWeight: 800,
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Rocketseat
        </Typography>
      </Box>
      <Box
        sx={{
          flex: 1,
          px: { xs: 2, md: 3 },
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: 'inline-flex',
              px: '6px',
              py: '1px',
              borderRadius: '3px',
              bgcolor: 'rgba(104,56,255,0.14)',
              border: '1px solid rgba(104,56,255,0.3)',
              mb: 0.6,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.57rem',
                fontWeight: 700,
                color: '#8B5CF6',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                lineHeight: 1.5,
              }}
            >
              Patrocinado
            </Typography>
          </Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: '0.88rem', md: '1rem' },
              color: isDark ? '#fff' : '#1a0a2e',
              lineHeight: 1.3,
              mb: 0.3,
            }}
          >
            Do zero ao primeiro emprego — ou do pleno ao sênior
          </Typography>
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: isDark ? 'rgba(255,255,255,0.62)' : '#4B3D70',
              lineHeight: 1.5,
              display: { xs: 'none', sm: 'block' },
            }}
          >
            Trilhas práticas com projetos reais e a maior comunidade dev do Brasil.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          component="span"
          sx={{
            flexShrink: 0,
            fontSize: '0.73rem',
            fontWeight: 700,
            textTransform: 'none',
            background: 'linear-gradient(135deg, #6838FF, #8B5CF6)',
            whiteSpace: 'nowrap',
            borderRadius: 2,
            display: { xs: 'none', sm: 'flex' },
            boxShadow: '0 2px 12px rgba(104,56,255,0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5428EE, #7C3AED)',
              boxShadow: '0 4px 18px rgba(104,56,255,0.5)',
            },
          }}
        >
          Ver trilhas →
        </Button>
      </Box>
      <Box
        sx={{
          px: 1.5,
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          borderLeft: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(104,56,255,0.15)',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.56rem',
            color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(104,56,255,0.5)',
            writingMode: 'vertical-rl',
            letterSpacing: '0.08em',
          }}
        >
          anúncio
        </Typography>
      </Box>
    </Box>
  );
}
