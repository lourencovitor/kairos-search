import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';

import DarkModeIcon from '@mui/icons-material/DarkMode';
import DownloadIcon from '@mui/icons-material/Download';
import LightModeIcon from '@mui/icons-material/LightMode';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Container,
  Divider,
  GlobalStyles,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';

import type { JobOpportunity, ReportGroup } from '../api/types.js';
import { useAuth } from '../ats/auth/AuthContext.js';
import { AtsAnalysisModal } from '../ats/components/AtsAnalysisModal.js';
import { ProfileMenu } from '../ats/components/ProfileMenu.js';
import { AUTH_ENABLED } from '../ats/featureFlags.js';
import { FiltersPanel } from '../components/FiltersPanel.js';
import { GroupDistribution } from '../components/GroupDistribution.js';
import { JobCard } from '../components/JobCard.js';
import { ScrollToTopButton } from '../components/ScrollToTopButton.js';
import { SkeletonCard } from '../components/SkeletonCard.js';
import { FeedAdPlaceholder } from '../components/ads/FeedAdPlaceholder.js';
import { LeaderboardAdBanner } from '../components/ads/LeaderboardAdBanner.js';
import { RightSidebarAdPrimary } from '../components/ads/RightSidebarAdPrimary.js';
import { RightSidebarAdSecondary } from '../components/ads/RightSidebarAdSecondary.js';
import { useFilteredJobs } from '../hooks/useFilteredJobs.js';
import { useLatestPayload } from '../hooks/useLatestPayload.js';
import { GLOBAL_CSS } from '../utils/constants.js';
import { reportGroup } from '../utils/report-group.js';

export function JobsPage({
  mode,
  onToggleTheme,
}: {
  mode: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const isDark = mode === 'dark';
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const { payload, loading, status, error, loadLatest } = useLatestPayload();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const [marketFilter, setMarketFilter] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [remotePolicies, setRemotePolicies] = useState<string[]>([]);
  const [atsJob, setAtsJob] = useState<JobOpportunity | null>(null);
  const [atsModalOpen, setAtsModalOpen] = useState(false);

  const toggleGroup = (g: string) =>
    startTransition(() =>
      setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])),
    );

  const toggleMarket = (m: string) =>
    startTransition(() =>
      setMarketFilter((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])),
    );

  const toggleRemotePolicy = (p: string) =>
    startTransition(() =>
      setRemotePolicies((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])),
    );

  const handleScoreChange = (v: number) => startTransition(() => setScore(v));

  const clearAllFilters = () =>
    startTransition(() => {
      setQuery('');
      setGroups([]);
      setMarketFilter([]);
      setScore(0);
      setRemotePolicies([]);
    });

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);

  useEffect(() => {
    setErrorDismissed(false);
  }, [error]);

  const { filteredJobs, markets } = useFilteredJobs(payload.jobs, {
    query,
    groups,
    marketFilter,
    score,
    remotePolicies,
  });

  const groupCounts = useMemo(() => {
    const counts = new Map<ReportGroup, number>();
    for (const job of payload.jobs) {
      const k = reportGroup(job);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [payload.jobs]);

  const totalJobs = payload.jobs.length;
  const showSkeleton = loading && totalJobs === 0;
  const activeFilterCount = [
    groups.length > 0,
    marketFilter.length > 0,
    remotePolicies.length > 0,
    score > 0,
  ].filter(Boolean).length;

  const topStats = [
    { label: 'Coletadas', value: payload.summary?.totalRawJobs ?? 0 },
    { label: 'Ranqueadas', value: payload.summary?.rankedJobs ?? totalJobs },
    { label: 'Selecionadas', value: payload.summary?.selectedJobs ?? totalJobs },
    { label: 'Visíveis', value: filteredJobs.length },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <GlobalStyles styles={GLOBAL_CSS} />

      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 1.5, minHeight: '56px !important', px: { xs: 2, md: 3 } }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #1A2E4A, #2B5072)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TrackChangesIcon sx={{ color: 'white', fontSize: 17 }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  color: 'primary.main',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}
              >
                Kairos
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  lineHeight: 1,
                  fontSize: '0.63rem',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                Oportunidades tech curadas
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <Stack
            direction="row"
            sx={{ alignItems: 'center', gap: 0.75, display: { xs: 'none', md: 'flex' } }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: loading ? '#94A3B8' : '#22C55E',
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {status}
            </Typography>
          </Stack>

          <Tooltip title={isDark ? 'Modo claro' : 'Modo escuro'}>
            <IconButton
              size="small"
              onClick={onToggleTheme}
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon sx={{ fontSize: '14px !important' }} />}
            onClick={() => void loadLatest()}
            disabled={loading}
            sx={{
              borderColor: 'divider',
              color: 'text.secondary',
              fontSize: '0.78rem',
              minWidth: { xs: 36, sm: 'auto' },
              px: { xs: 1, sm: 1.5 },
              '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.5 } },
              '&:hover': { borderColor: 'primary.light', color: 'primary.main' },
              '&.Mui-disabled': { borderColor: 'divider', color: 'text.disabled' },
            }}
          >
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>Atualizar</Box>
          </Button>

          {AUTH_ENABLED && (
            <ProfileMenu
              user={user}
              isDark={isDark}
              onLogout={() => {
                void logout().then(() => navigate('/login'));
              }}
            />
          )}
        </Toolbar>
      </AppBar>

      {(loading || isPending) && (
        <LinearProgress
          sx={{
            bgcolor: 'transparent',
            '& .MuiLinearProgress-bar': {
              background: isPending
                ? 'linear-gradient(90deg, #2B5072, #3D7EBF, #2B5072)'
                : 'linear-gradient(90deg, #1A2E4A, #3D7EBF, #1A2E4A)',
              backgroundSize: '200% 100%',
              animation: 'linearProgressShimmer 1.8s ease infinite',
            },
            '@keyframes linearProgressShimmer': {
              '0%': { backgroundPosition: '100% 0' },
              '100%': { backgroundPosition: '-100% 0' },
            },
          }}
        />
      )}

      {/* Stats banner */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(160deg, #0D1B2E 0%, #1A3055 55%, #132540 100%)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)',
          },
        }}
      >
        <Container maxWidth="xl" sx={{ position: 'relative' }}>
          <Grid container>
            {topStats.map((stat, i) => (
              <Grid key={stat.label} size={{ xs: 6, sm: 3 }}>
                <Box
                  sx={{
                    px: { xs: 2, sm: 2.5, md: 4 },
                    py: { xs: 2.25, md: 3.25 },
                    borderLeft: {
                      xs: i % 2 !== 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                      sm: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                    },
                    borderTop: {
                      xs: i >= 2 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                      sm: 'none',
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.56rem',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.32)',
                      mb: 0.75,
                    }}
                  >
                    {stat.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: { xs: '1.9rem', md: '2.4rem' },
                      lineHeight: 1,
                      letterSpacing: '-0.04em',
                      color: '#fff',
                    }}
                  >
                    {stat.value.toLocaleString('pt-BR')}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Main layout */}
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 2.5 } }}>
        {error && !errorDismissed && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorDismissed(true)}>
            {error}
          </Alert>
        )}

        <LeaderboardAdBanner isDark={isDark} />

        <Grid container spacing={2.5}>
          {/* Left sidebar — ads (desktop only) */}
          <Grid
            size={{ xs: 12, lg: 3 }}
            sx={{ order: { xs: 3, lg: 1 }, display: { xs: 'none', lg: 'block' } }}
          >
            <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: 72 }}>
              <RightSidebarAdPrimary />
              <RightSidebarAdSecondary />
            </Stack>
          </Grid>

          {/* Main feed */}
          <Grid size={{ xs: 12, lg: 6 }} sx={{ order: { xs: 1, lg: 2 } }}>
            <Stack spacing={2}>
              <Card>
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  <GroupDistribution
                    totalJobs={totalJobs}
                    groupCounts={groupCounts}
                    filteredCount={filteredJobs.length}
                    groups={groups}
                    onGroupToggle={toggleGroup}
                    isDark={isDark}
                    filtersOpen={filtersOpen}
                    onFiltersToggle={() => setFiltersOpen((v) => !v)}
                    activeFilterCount={activeFilterCount}
                  />
                </CardContent>
              </Card>

              <Collapse in={filtersOpen} sx={{ display: { lg: 'none' } }}>
                <Card sx={{ overflow: 'hidden' }}>
                  <Box sx={{ p: 2.5 }}>
                    <FiltersPanel
                      query={query}
                      onQueryChange={setQuery}
                      markets={markets}
                      marketFilter={marketFilter}
                      onMarketToggle={toggleMarket}
                      score={score}
                      onScoreChange={handleScoreChange}
                      remotePolicies={remotePolicies}
                      onRemotePolicyToggle={toggleRemotePolicy}
                      isDark={isDark}
                      onClearAll={clearAllFilters}
                    />
                  </Box>
                </Card>
              </Collapse>

              {showSkeleton && (
                <Stack spacing={2}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </Stack>
              )}

              {!showSkeleton && filteredJobs.length === 0 && (
                <Card>
                  <CardContent sx={{ py: 10, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Nenhuma vaga encontrada
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ajuste os filtros ou inicie uma nova busca.
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {!showSkeleton && filteredJobs.length > 0 && (
                <Box
                  sx={{
                    opacity: isPending ? 0.4 : 1,
                    transition: 'opacity 0.2s ease',
                    pointerEvents: isPending ? 'none' : 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {filteredJobs.slice(0, 250).map((job, idx) => (
                    <Fragment key={job.id}>
                      {idx > 0 && idx % 5 === 0 && (
                        <FeedAdPlaceholder isDark={isDark} adIndex={idx} />
                      )}
                      <Box
                        sx={
                          idx < 10
                            ? {
                                opacity: 0,
                                animation: 'kairosIn 0.3s ease forwards',
                                animationDelay: `${idx * 30}ms`,
                              }
                            : undefined
                        }
                      >
                        <JobCard
                          job={job}
                          isDark={isDark}
                          onAnalyze={(j) => {
                            setAtsJob(j);
                            setAtsModalOpen(true);
                          }}
                        />
                      </Box>
                    </Fragment>
                  ))}
                </Box>
              )}
            </Stack>
          </Grid>

          {/* Right sidebar — filters + export */}
          <Grid size={{ xs: 12, lg: 3 }} sx={{ order: { xs: 2, lg: 3 } }}>
            <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: 72 }}>
              <Box>
                <Card sx={{ overflow: 'hidden', display: { xs: 'none', lg: 'block' } }}>
                  <Box
                    sx={{
                      px: 2.5,
                      pt: 2,
                      pb: 1.75,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                      }}
                    >
                      Filtros
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <FiltersPanel
                      query={query}
                      onQueryChange={setQuery}
                      markets={markets}
                      marketFilter={marketFilter}
                      onMarketToggle={toggleMarket}
                      score={score}
                      onScoreChange={handleScoreChange}
                      remotePolicies={remotePolicies}
                      onRemotePolicyToggle={toggleRemotePolicy}
                      isDark={isDark}
                      onClearAll={clearAllFilters}
                    />
                  </Box>
                </Card>
              </Box>

              <Card sx={{ overflow: 'hidden' }}>
                <Box
                  sx={{
                    px: 2.5,
                    pt: 2,
                    pb: 1.75,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                    }}
                  >
                    Exportar
                  </Typography>
                </Box>
                <Stack spacing={0.5} sx={{ p: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<DownloadIcon sx={{ fontSize: '15px !important' }} />}
                    href="/api/download-all"
                    sx={{
                      justifyContent: 'flex-start',
                      py: 0.9,
                      fontSize: '0.8rem',
                      background: 'linear-gradient(135deg, #1A2E4A, #2B5072)',
                      '&:hover': { background: 'linear-gradient(135deg, #243F65, #356090)' },
                    }}
                  >
                    Baixar tudo em ZIP
                  </Button>
                  {payload.downloads.length > 0 && <Divider sx={{ my: 0.5 }} />}
                  {payload.downloads.map((file) => (
                    <Button
                      key={file.name}
                      href={`/api/download/${encodeURIComponent(file.name)}`}
                      endIcon={<DownloadIcon sx={{ fontSize: '12px !important' }} />}
                      size="small"
                      sx={{
                        justifyContent: 'space-between',
                        color: 'text.secondary',
                        fontWeight: 500,
                        px: 0.5,
                        fontSize: '0.74rem',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      {file.label}
                    </Button>
                  ))}
                </Stack>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <AtsAnalysisModal
        open={atsModalOpen}
        job={atsJob}
        isDark={isDark}
        onClose={() => {
          setAtsModalOpen(false);
          setAtsJob(null);
        }}
      />

      <ScrollToTopButton />
    </Box>
  );
}
