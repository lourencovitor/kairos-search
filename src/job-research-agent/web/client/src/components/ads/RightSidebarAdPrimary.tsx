import { useEffect, useRef } from 'react';

import { Box, Button, Typography } from '@mui/material';

import { ADSENSE_CLIENT, ADS_ENABLED, AD_SLOTS } from '../../utils/constants.js';

export function RightSidebarAdPrimary() {
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
      <Box ref={ref} sx={{ overflow: 'hidden', minHeight: 250 }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={AD_SLOTS.sidebarTop}
          data-ad-format="rectangle"
          data-full-width-responsive="true"
        />
      </Box>
    );
  }

  return (
    <Box
      component="a"
      href="https://github.com/features/copilot"
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        overflow: 'hidden',
        textDecoration: 'none',
        borderRadius: 2,
        display: 'block',
        background: '#0d1117',
        border: '1px solid rgba(48,54,61,0.9)',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 8px 32px rgba(0,0,0,0.5)' },
      }}
    >
      <Box
        sx={{
          px: 2.5,
          pt: 2,
          pb: 1.75,
          borderBottom: '1px solid rgba(48,54,61,0.8)',
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
            color: 'rgba(139,148,158,1)',
          }}
        >
          Patrocinado
        </Typography>
        <Typography sx={{ fontSize: '0.59rem', color: 'rgba(139,148,158,0.55)' }}>
          GitHub
        </Typography>
      </Box>
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: '10px',
              flexShrink: 0,
              background: 'linear-gradient(135deg, #6e40c9 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              sx={{ fontSize: '1.25rem', lineHeight: 1, userSelect: 'none', color: '#fff' }}
            >
              ✦
            </Typography>
          </Box>
          <Box>
            <Typography
              sx={{ fontWeight: 800, fontSize: '0.93rem', color: '#e6edf3', lineHeight: 1.2 }}
            >
              GitHub Copilot
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(139,148,158,1)' }}>
              Your AI pair programmer
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: '0.82rem', color: '#e6edf3', lineHeight: 1.6, mb: 1.75 }}>
          Escreva código mais rápido com sugestões inteligentes de IA no seu editor.
        </Typography>
        {[
          'Autocomplete em tempo real',
          'Chat no VS Code & JetBrains',
          'Revisão e explicação de código',
        ].map((feat) => (
          <Box key={feat} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: '#3fb950',
                lineHeight: 1.55,
                flexShrink: 0,
                mt: '1px',
              }}
            >
              ✓
            </Typography>
            <Typography
              sx={{ fontSize: '0.72rem', color: 'rgba(139,148,158,1)', lineHeight: 1.55 }}
            >
              {feat}
            </Typography>
          </Box>
        ))}
        <Button
          fullWidth
          variant="contained"
          size="small"
          component="span"
          sx={{
            mt: 2.25,
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'none',
            background: 'linear-gradient(135deg, #6e40c9 0%, #a855f7 100%)',
            borderRadius: 2,
            '&:hover': { background: 'linear-gradient(135deg, #5a32a3 0%, #9333ea 100%)' },
          }}
        >
          Experimentar grátis
        </Button>
      </Box>
    </Box>
  );
}
