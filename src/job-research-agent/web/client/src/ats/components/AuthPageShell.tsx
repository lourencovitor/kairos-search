import type { ReactNode } from 'react';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import {
  Box,
  Paper,
  type PaperProps,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

interface AuthPageShellProps {
  readonly title?: string;
  readonly subtitle: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly paperProps?: PaperProps;
  readonly eyebrow?: string;
}

const VALUE_PROPS = [
  {
    icon: AnalyticsOutlinedIcon,
    title: 'Score ATS determinístico',
    text: 'Mesmas regras de skills, senioridade, idioma e região que sistemas de triagem usam.',
  },
  {
    icon: AutoAwesomeIcon,
    title: 'Recomendação acionável',
    text: 'Vereditos claros, gaps por vaga e sugestões editáveis no CV. Sem achismo.',
  },
  {
    icon: LockOutlinedIcon,
    title: 'Sem senha, sem fricção',
    text: 'Código mágico no e-mail. Seu CV é processado em memória, sem armazenamento.',
  },
] as const;

export function AuthPageShell({
  title = 'Kairos',
  subtitle,
  children,
  footer,
  paperProps,
  eyebrow = 'Plataforma de carreira em tech',
}: AuthPageShellProps) {
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: isDark
            ? 'radial-gradient(ellipse 70% 50% at 15% 0%, rgba(61,126,191,0.22), transparent 60%), radial-gradient(ellipse 50% 40% at 85% 100%, rgba(26,46,74,0.35), transparent 60%)'
            : 'radial-gradient(ellipse 60% 45% at 12% -5%, rgba(26,46,74,0.10), transparent 60%), radial-gradient(ellipse 50% 35% at 90% 100%, rgba(61,126,191,0.08), transparent 60%)',
          pointerEvents: 'none',
        },
      }}
    >
      {isLg && (
        <Box
          sx={{
            width: '46%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            px: { lg: 6, xl: 9 },
            py: { lg: 6, xl: 7 },
            background: isDark
              ? 'linear-gradient(160deg, #0B1628 0%, #15294A 50%, #0D1B2E 100%)'
              : 'linear-gradient(160deg, #0D1B2E 0%, #1A3055 55%, #132540 100%)',
            color: '#FFFFFF',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              opacity: 0.6,
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '-15%',
              right: '-25%',
              width: '70%',
              height: '70%',
              background: 'radial-gradient(circle, rgba(61,126,191,0.28) 0%, transparent 70%)',
              filter: 'blur(40px)',
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 6 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3D7EBF, #1A2E4A)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrackChangesIcon sx={{ color: '#FFFFFF', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: '1.35rem',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    color: '#FFFFFF',
                  }}
                >
                  Kairos
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.66rem',
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.55)',
                    mt: 0.3,
                  }}
                >
                  {eyebrow}
                </Typography>
              </Box>
            </Stack>

            <Typography
              sx={{
                fontSize: { lg: '2.1rem', xl: '2.6rem' },
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: '-0.035em',
                color: '#FFFFFF',
                maxWidth: 460,
                mb: 2,
              }}
            >
              O momento certo de aplicar, com dados em vez de sorte.
            </Typography>
            <Typography
              sx={{
                fontSize: '0.96rem',
                color: 'rgba(255,255,255,0.72)',
                maxWidth: 460,
                lineHeight: 1.6,
                mb: 5,
              }}
            >
              Vagas tech curadas, score de fit contra as regras de ATS e um plano objetivo para cada
              candidatura. Tudo em segundos, em um único lugar.
            </Typography>

            <Stack spacing={2.5}>
              {VALUE_PROPS.map((vp) => {
                const Icon = vp.icon;
                return (
                  <Stack
                    key={vp.title}
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: 'flex-start' }}
                  >
                    <Box
                      sx={{
                        mt: 0.25,
                        width: 38,
                        height: 38,
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      <Icon sx={{ fontSize: 19, color: '#7FB5E8' }} />
                    </Box>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          color: '#FFFFFF',
                          letterSpacing: '-0.015em',
                          lineHeight: 1.3,
                        }}
                      >
                        {vp.title}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.78rem',
                          color: 'rgba(255,255,255,0.62)',
                          lineHeight: 1.55,
                          mt: 0.25,
                          maxWidth: 380,
                        }}
                      >
                        {vp.text}
                      </Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </Box>

          <Box sx={{ position: 'relative', zIndex: 1, mt: 6 }}>
            <Stack direction="row" spacing={3} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Box>
                <Typography
                  sx={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                >
                  100%
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.66rem',
                    color: 'rgba(255,255,255,0.55)',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    mt: 0.5,
                  }}
                >
                  Determinístico
                </Typography>
              </Box>
              <Box sx={{ width: '1px', height: 36, bgcolor: 'rgba(255,255,255,0.12)' }} />
              <Box>
                <Typography
                  sx={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                >
                  LGPD
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.66rem',
                    color: 'rgba(255,255,255,0.55)',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    mt: 0.5,
                  }}
                >
                  Em memória
                </Typography>
              </Box>
              <Box sx={{ width: '1px', height: 36, bgcolor: 'rgba(255,255,255,0.12)' }} />
              <Box>
                <Typography
                  sx={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                >
                  PDF · DOCX
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.66rem',
                    color: 'rgba(255,255,255,0.55)',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    mt: 0.5,
                  }}
                >
                  Suporte CV
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, sm: 4 },
          py: { xs: 4, sm: 6 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Paper
          {...paperProps}
          sx={{
            width: '100%',
            maxWidth: 460,
            p: { xs: 3.5, sm: 5 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.08)',
            boxShadow: isDark
              ? '0 24px 64px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)'
              : '0 24px 64px rgba(15,31,46,0.10), 0 4px 12px rgba(15,31,46,0.04)',
            backdropFilter: 'blur(10px)',
            ...(paperProps?.sx ?? {}),
          }}
        >
          {!isLg && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 3 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1A2E4A, #2B5072)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(26,46,74,0.25)',
                }}
              >
                <TrackChangesIcon sx={{ color: '#FFFFFF', fontSize: 19 }} />
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: '1.15rem',
                    color: 'primary.main',
                    letterSpacing: '-0.025em',
                    lineHeight: 1,
                  }}
                >
                  {title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    mt: 0.3,
                  }}
                >
                  {eyebrow}
                </Typography>
              </Box>
            </Stack>
          )}

          <Typography
            sx={{
              fontSize: { xs: '1.5rem', sm: '1.75rem' },
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'text.primary',
              lineHeight: 1.15,
              mb: 1,
            }}
          >
            {isLg ? title : 'Bem-vindo'}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ mb: 3.5, fontSize: '0.92rem', lineHeight: 1.55 }}
          >
            {subtitle}
          </Typography>

          {children}
          {footer}
        </Paper>
      </Box>
    </Box>
  );
}
