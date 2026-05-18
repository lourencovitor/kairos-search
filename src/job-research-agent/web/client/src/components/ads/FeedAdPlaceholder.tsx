import { useEffect, useRef } from 'react';

import { Box, Button, CardContent, Typography } from '@mui/material';

import { ADSENSE_CLIENT, ADS_ENABLED, AD_SLOTS } from '../../utils/constants.js';

const FEED_ADS = [
  {
    href: 'https://aws.amazon.com/certification/',
    sponsor: 'AWS',
    accentColor: '#FF9900',
    accentBg: 'linear-gradient(135deg, #232F3E 0%, #131921 100%)',
    icon: '☁',
    headline: 'Torne-se um AWS Certified Engineer',
    body: 'Certificações reconhecidas globalmente. Valide suas habilidades em cloud e acelere sua carreira.',
    cta: 'Ver certificações',
  },
  {
    href: 'https://www.alura.com.br',
    sponsor: 'Alura',
    accentColor: '#1DC7EA',
    accentBg: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
    icon: '🎓',
    headline: 'Aprenda com quem está no mercado',
    body: 'Mais de 600 cursos de tecnologia, inglês e gestão. Mentoria ao vivo com especialistas.',
    cta: 'Explorar cursos',
  },
  {
    href: 'https://www.rocketseat.com.br',
    sponsor: 'Rocketseat',
    accentColor: '#6838FF',
    accentBg: 'linear-gradient(135deg, #1a0a2e 0%, #2d1458 100%)',
    icon: '🚀',
    headline: 'Da teoria à prática em semanas',
    body: 'Trilhas de programação com projetos reais, comunidade ativa e suporte de mentores.',
    cta: 'Começar trilha',
  },
] as const;

interface FeedAdPlaceholderProps {
  isDark: boolean;
  adIndex: number;
}

export function FeedAdPlaceholder({ isDark, adIndex }: FeedAdPlaceholderProps) {
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
      <Box ref={ref} sx={{ overflow: 'hidden', minHeight: 90 }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={AD_SLOTS.feed}
          data-ad-layout="in-article"
          data-ad-format="fluid"
        />
      </Box>
    );
  }

  const ad = FEED_ADS[adIndex % FEED_ADS.length];

  return (
    <Box
      component="a"
      href={ad.href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'block',
        textDecoration: 'none',
        borderRadius: 2,
        borderLeft: `4px solid ${ad.accentColor}`,
        background: isDark ? ad.accentBg : undefined,
        bgcolor: isDark ? undefined : 'rgba(248,250,252,0.9)',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: `0 8px 28px rgba(0,0,0,${isDark ? '0.4' : '0.1'})`,
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            gap: { xs: 1.5, sm: 2 },
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              width: { xs: 40, sm: 48 },
              height: { xs: 40, sm: 48 },
              borderRadius: '12px',
              flexShrink: 0,
              bgcolor: isDark ? 'rgba(255,255,255,0.07)' : `${ad.accentColor}18`,
              border: `1.5px solid ${ad.accentColor}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              sx={{ fontSize: { xs: '1.2rem', sm: '1.4rem' }, lineHeight: 1, userSelect: 'none' }}
            >
              {ad.icon}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
              <Box
                sx={{
                  px: '6px',
                  py: '1px',
                  borderRadius: '3px',
                  bgcolor: `${ad.accentColor}18`,
                  border: `1px solid ${ad.accentColor}40`,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.57rem',
                    fontWeight: 700,
                    color: ad.accentColor,
                    lineHeight: 1.5,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Patrocinado
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'text.secondary',
                  fontWeight: 600,
                }}
              >
                {ad.sponsor}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: { xs: '0.88rem', sm: '0.95rem' },
                color: isDark ? '#fff' : 'text.primary',
                lineHeight: 1.35,
                mb: 0.3,
              }}
            >
              {ad.headline}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '0.74rem', sm: '0.78rem' },
                color: isDark ? 'rgba(255,255,255,0.6)' : 'text.secondary',
                lineHeight: 1.5,
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {ad.body}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: ad.accentColor,
                fontWeight: 700,
                mt: 0.5,
                display: { xs: 'block', sm: 'none' },
              }}
            >
              {ad.cta} →
            </Typography>
          </Box>

          <Button
            variant="contained"
            size="small"
            component="span"
            sx={{
              flexShrink: 0,
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              borderRadius: 2,
              display: { xs: 'none', sm: 'flex' },
              bgcolor: ad.accentColor,
              '&:hover': { bgcolor: ad.accentColor, filter: 'brightness(1.15)' },
              boxShadow: `0 2px 10px ${ad.accentColor}50`,
            }}
          >
            {ad.cta} →
          </Button>
        </Box>
      </CardContent>
    </Box>
  );
}
