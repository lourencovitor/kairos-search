import {
  Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';

declare global {
  interface Window {
    adsbygoogle: object[];
  }
}
import {
  Alert, AppBar, Box, Button, Card, CardContent, CircularProgress, Collapse,
  Container, Divider, FormControl, GlobalStyles, Grid, IconButton,
  InputAdornment, InputLabel, LinearProgress, Link, MenuItem,
  Select, Skeleton, Slider, Stack, TextField, Toolbar, Tooltip, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { SelectChangeEvent } from '@mui/material/Select';
import DarkModeIcon    from '@mui/icons-material/DarkMode';
import DownloadIcon    from '@mui/icons-material/Download';
import LightModeIcon   from '@mui/icons-material/LightMode';
import OpenInNewIcon   from '@mui/icons-material/OpenInNew';
import PlayArrowIcon   from '@mui/icons-material/PlayArrow';
import RefreshIcon     from '@mui/icons-material/Refresh';
import SearchIcon      from '@mui/icons-material/Search';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import TuneIcon        from '@mui/icons-material/Tune';

// ── AdSense config ─────────────────────────────────────────────────────────────
// Preencha no .env.local: VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
const ADSENSE_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? 'ca-pub-XXXXXXXXXXXXXXXX';
const ADS_ENABLED    = import.meta.env.PROD && ADSENSE_CLIENT !== 'ca-pub-XXXXXXXXXXXXXXXX';

const AD_SLOTS = {
  leaderboard:  (import.meta.env.VITE_AD_SLOT_LEADERBOARD  as string | undefined) ?? '0000000001',
  feed:         (import.meta.env.VITE_AD_SLOT_FEED          as string | undefined) ?? '0000000002',
  sidebarTop:   (import.meta.env.VITE_AD_SLOT_SIDEBAR_TOP   as string | undefined) ?? '0000000003',
  sidebarBot:   (import.meta.env.VITE_AD_SLOT_SIDEBAR_BOT   as string | undefined) ?? '0000000004',
} as const;

// ── Types ──────────────────────────────────────────────────────────────────────

type ReportGroup =
  | 'junior' | 'pleno' | 'senior' | 'staff'
  | 'arq' | 'qa' | 'devops' | 'management' | 'other';

interface JobOpportunity {
  id: string;
  companyName: string;
  title: string;
  url: string;
  source: string;
  sourceBoard?: string;
  locationText: string;
  jobMarket: string;
  seniority: string;
  roleCategory: string;
  remotePolicy: string;
  stackSignals: string[];
  score: number;
  salaryText?: string;
  publishedAt?: string;
}

interface LatestPayload {
  summary: { runId?: string; totalRawJobs?: number; rankedJobs?: number; selectedJobs?: number } | null;
  jobs: JobOpportunity[];
  downloads: Array<{ name: string; label: string; size: number }>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const GROUP_COLORS: Record<ReportGroup, { bg: string; text: string; accent: string }> = {
  junior:     { bg: '#FEF3C7', text: '#92400E', accent: '#F59E0B' },
  pleno:      { bg: '#DBEAFE', text: '#1E40AF', accent: '#3B82F6' },
  senior:     { bg: '#EDE9FE', text: '#3730A3', accent: '#6366F1' },
  staff:      { bg: '#F3E8FF', text: '#6B21A8', accent: '#8B5CF6' },
  arq:        { bg: '#CCFBF1', text: '#0F766E', accent: '#14B8A6' },
  qa:         { bg: '#DCFCE7', text: '#14532D', accent: '#22C55E' },
  devops:     { bg: '#E0F2FE', text: '#075985', accent: '#0EA5E9' },
  management: { bg: '#FEE2E2', text: '#991B1B', accent: '#EF4444' },
  other:      { bg: '#F1F5F9', text: '#475569', accent: '#94A3B8' },
};

// Dark-mode friendly bg/text for each group (accent stays the same)
const GROUP_DARK: Record<ReportGroup, { bg: string; text: string }> = {
  junior:     { bg: 'rgba(245,158,11,0.14)',  text: '#FCD34D' },
  pleno:      { bg: 'rgba(59,130,246,0.14)',  text: '#93C5FD' },
  senior:     { bg: 'rgba(99,102,241,0.14)',  text: '#A5B4FC' },
  staff:      { bg: 'rgba(139,92,246,0.14)',  text: '#C4B5FD' },
  arq:        { bg: 'rgba(20,184,166,0.14)',  text: '#5EEAD4' },
  qa:         { bg: 'rgba(34,197,94,0.14)',   text: '#86EFAC' },
  devops:     { bg: 'rgba(14,165,233,0.14)',  text: '#7DD3FC' },
  management: { bg: 'rgba(239,68,68,0.14)',   text: '#FCA5A5' },
  other:      { bg: 'rgba(148,163,184,0.14)', text: '#CBD5E1' },
};

const GROUP_ORDER: ReportGroup[] = ['junior','pleno','senior','staff','arq','qa','devops','management'];

const GROUP_LABELS: Record<ReportGroup, string> = {
  junior: 'Junior', pleno: 'Pleno', senior: 'Senior', staff: 'Staff+',
  arq: 'Arquitetura', qa: 'QA', devops: 'DevOps', management: 'Management', other: 'Outros',
};

const AVATAR_PALETTE = [
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
  { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A' },
  { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
];

const GLOBAL_CSS = {
  '::selection': { background: '#1A2E4A28' },
  '*::-webkit-scrollbar': { width: '5px', height: '5px' },
  '*::-webkit-scrollbar-track': { background: 'transparent' },
  '*::-webkit-scrollbar-thumb': { background: '#CBD5E1', borderRadius: '3px' },
  '*::-webkit-scrollbar-thumb:hover': { background: '#94A3B8' },
  '@keyframes kairosIn': {
    from: { opacity: 0, transform: 'translateY(10px)' },
    to:   { opacity: 1, transform: 'translateY(0)' },
  },
};

const INITIAL_PAYLOAD: LatestPayload = { summary: null, jobs: [], downloads: [] };

// ── App ────────────────────────────────────────────────────────────────────────

export default function App({
  mode,
  onToggleTheme,
}: {
  mode: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const isDark = mode === 'dark';

  const [payload, setPayload]     = useState<LatestPayload>(INITIAL_PAYLOAD);
  const [query, setQuery]         = useState('');
  const [group, setGroup]         = useState('');
  const [market, setMarket]       = useState('');
  const [score, setScore]         = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [status, setStatus]       = useState('Carregando...');
  const [error, setError]         = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const deferredQuery = useDeferredValue(query);

  useEffect(() => { void loadLatest(); }, []);

  // Re-trigger card entrance animation when primary filters change
  useEffect(() => { setListVersion((v) => v + 1); }, [group, market, remoteOnly]);

  async function loadLatest() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/latest');
      const data = (await res.json()) as LatestPayload;
      setPayload({
        summary:   data.summary,
        jobs:      Array.isArray(data.jobs)      ? data.jobs      : [],
        downloads: Array.isArray(data.downloads) ? data.downloads : [],
      });
      setStatus(data.jobs?.length ? 'Atualizado' : 'Sem dados');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }

  async function runResearch() {
    setRunning(true);
    setError(null);
    setStatus('Buscando vagas...');
    try {
      const res  = await fetch('/api/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? 'Falha.');
      setStatus('Concluído');
      await loadLatest();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao processar vagas.');
    } finally {
      setRunning(false);
    }
  }

  const markets = useMemo(
    () => unique(payload.jobs.map((j) => j.jobMarket)),
    [payload.jobs],
  );

  const filteredJobs = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return payload.jobs.filter((job) => {
      const hay = [job.companyName, job.title, job.locationText, ...(job.stackSignals ?? [])]
        .join(' ').toLowerCase();
      return (
        (!q || hay.includes(q)) &&
        (!group  || reportGroup(job) === group) &&
        (!market || job.jobMarket   === market) &&
        job.score >= score &&
        (!remoteOnly || job.remotePolicy === 'remote')
      );
    });
  }, [deferredQuery, group, market, payload.jobs, remoteOnly, score]);

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
  const activeFilterCount = [group !== '', market !== '', remoteOnly, score > 0].filter(Boolean).length;

  const topStats = [
    { label: 'Coletadas',    value: payload.summary?.totalRawJobs ?? 0 },
    { label: 'Ranqueadas',   value: payload.summary?.rankedJobs   ?? totalJobs },
    { label: 'Selecionadas', value: payload.summary?.selectedJobs ?? totalJobs },
    { label: 'Visíveis',     value: filteredJobs.length },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <GlobalStyles styles={GLOBAL_CSS} />

      {/* ── AppBar ──────────────────────────────────────────────────────────── */}
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 1.5, minHeight: '56px !important', px: { xs: 2, md: 3 } }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: '9px',
              background: 'linear-gradient(135deg, #1A2E4A, #2B5072)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <TrackChangesIcon sx={{ color: 'white', fontSize: 17 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'primary.main', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Kairos
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1, fontSize: '0.63rem', display: { xs: 'none', sm: 'block' } }}>
                Oportunidades tech curadas
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          {/* Status */}
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, display: { xs: 'none', md: 'flex' } }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: running ? '#F59E0B' : loading ? '#94A3B8' : '#22C55E' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{status}</Typography>
          </Stack>

          {/* Dark mode toggle */}
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
            variant="outlined" size="small"
            startIcon={<RefreshIcon sx={{ fontSize: '14px !important' }} />}
            onClick={() => void loadLatest()} disabled={loading}
            sx={{
              borderColor: 'divider', color: 'text.secondary', fontSize: '0.78rem',
              minWidth: { xs: 36, sm: 'auto' },
              px: { xs: 1, sm: 1.5 },
              '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.5 } },
              '&:hover': { borderColor: 'primary.light', color: 'primary.main' },
              '&.Mui-disabled': { borderColor: 'divider', color: 'text.disabled' },
            }}
          >
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>Atualizar</Box>
          </Button>
          <Button
            variant="contained" size="small"
            startIcon={running ? <CircularProgress size={13} sx={{ color: 'rgba(255,255,255,0.7)' }} /> : <PlayArrowIcon sx={{ fontSize: '16px !important' }} />}
            disabled={running} onClick={() => void runResearch()}
            sx={{
              fontSize: '0.78rem',
              minWidth: { xs: 36, sm: 'auto' },
              px: { xs: 1, sm: 1.5 },
              '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.5 } },
              background: 'linear-gradient(135deg, #1A2E4A, #2B5072)',
              '&:hover': { background: 'linear-gradient(135deg, #243F65, #356090)' },
              '&.Mui-disabled': {
                background: 'linear-gradient(135deg, #1A2E4A, #2B5072)',
                opacity: 0.55, color: 'rgba(255,255,255,0.75)',
              },
            }}
          >
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>{running ? 'Processando...' : 'Nova busca'}</Box>
          </Button>
        </Toolbar>
      </AppBar>

      {(loading || running) && (
        <LinearProgress
          sx={{
            bgcolor: 'transparent',
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(90deg, #1A2E4A, #3D7EBF, #1A2E4A)',
              backgroundSize: '200% 100%',
              animation: 'linearProgressShimmer 1.8s ease infinite',
            },
            '@keyframes linearProgressShimmer': {
              '0%':   { backgroundPosition: '100% 0' },
              '100%': { backgroundPosition: '-100% 0' },
            },
          }}
        />
      )}

      {/* ── Stats banner ─────────────────────────────────────────────────────── */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0D1B2E 0%, #1A3055 55%, #132540 100%)',
        '&::before': { content: '""', position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '20px 20px' },
        '&::after':  { content: '""', position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent)' },
      }}>
        <Container maxWidth="xl" sx={{ position: 'relative' }}>
          <Grid container>
            {topStats.map((stat, i) => (
              <Grid key={stat.label} size={{ xs: 6, sm: 3 }}>
                <Box sx={{ px: { xs: 2.5, md: 4 }, py: { xs: 2.5, md: 3.25 }, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                  <Typography sx={{ fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', mb: 0.75 }}>
                    {stat.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.4rem' }, lineHeight: 1, letterSpacing: '-0.04em', color: '#fff' }}>
                    {stat.value.toLocaleString('pt-BR')}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── Main layout ──────────────────────────────────────────────────────── */}
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 2.5 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        <LeaderboardAdBanner isDark={isDark} />

        <Grid container spacing={2.5}>

          {/* Left — Patrocinado (ads): oculto em mobile, visível apenas no desktop */}
          <Grid size={{ xs: 12, lg: 3 }} sx={{ order: { xs: 3, lg: 1 }, display: { xs: 'none', lg: 'block' } }}>
            <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: 72 }}>
              <RightSidebarAdPrimary />
              <RightSidebarAdSecondary />
            </Stack>
          </Grid>

          {/* Main */}
          <Grid size={{ xs: 12, lg: 6 }} sx={{ order: { xs: 1, lg: 2 } }}>
            <Stack spacing={2}>

              {/* Distribution */}
              <Card>
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  {totalJobs > 0 && (
                    <Box sx={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: '2px', mb: 1.75 }}>
                      {GROUP_ORDER.filter((g) => (groupCounts.get(g) ?? 0) > 0).map((g) => {
                        const count   = groupCounts.get(g) ?? 0;
                        const pct     = (count / totalJobs) * 100;
                        const isActive = group === g;
                        return (
                          <Tooltip key={g} title={`${GROUP_LABELS[g]} · ${count} vagas`} placement="top" arrow>
                            <Box
                              onClick={() => setGroup(group === g ? '' : g)}
                              sx={{
                                height: '100%', width: `${pct}%`, minWidth: 6,
                                bgcolor: GROUP_COLORS[g].accent, borderRadius: '2px',
                                cursor: 'pointer',
                                opacity: group && !isActive ? 0.15 : 1,
                                transition: 'opacity 0.2s, transform 0.15s',
                                '&:hover': { opacity: 1, transform: 'scaleY(1.7)' },
                              }}
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  )}
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                    {GROUP_ORDER.map((g) => {
                      const count  = groupCounts.get(g) ?? 0;
                      const c      = GROUP_COLORS[g];
                      const active = group === g;
                      return (
                        <Box key={g} onClick={() => setGroup(group === g ? '' : g)} sx={{
                          display: 'inline-flex', alignItems: 'center', gap: 0.5,
                          px: 1.1, py: 0.45, borderRadius: '6px', cursor: 'pointer', userSelect: 'none',
                          bgcolor: active ? c.accent : isDark ? GROUP_DARK[g].bg : c.bg,
                          border: `1px solid ${active ? c.accent : 'transparent'}`,
                          transition: 'all 0.15s ease',
                          '&:hover': { bgcolor: c.accent, '& *': { color: '#fff !important' } },
                        }}>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: active ? '#fff' : isDark ? GROUP_DARK[g].text : c.text, lineHeight: 1 }}>{GROUP_LABELS[g]}</Typography>
                          <Box sx={{ px: 0.55, py: '1px', borderRadius: '3px', bgcolor: active ? 'rgba(255,255,255,0.2)' : `${c.accent}1A` }}>
                            <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: active ? '#fff' : c.accent, lineHeight: 1.3 }}>{count}</Typography>
                          </Box>
                        </Box>
                      );
                    })}
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
                      {filteredJobs.length} {filteredJobs.length === 1 ? 'vaga' : 'vagas'}
                    </Typography>
                    {/* Filtros toggle — mobile only */}
                    <Tooltip title="Filtros">
                      <IconButton
                        size="small"
                        onClick={() => setFiltersOpen((v) => !v)}
                        sx={{
                          display: { lg: 'none' },
                          color: filtersOpen || activeFilterCount > 0 ? 'primary.main' : 'text.secondary',
                          position: 'relative',
                        }}
                      >
                        <TuneIcon sx={{ fontSize: 18 }} />
                        {activeFilterCount > 0 && (
                          <Box sx={{
                            position: 'absolute', top: 2, right: 2,
                            width: 8, height: 8, borderRadius: '50%',
                            bgcolor: 'primary.main', border: '1.5px solid',
                            borderColor: 'background.paper',
                          }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </CardContent>
              </Card>

              {/* Skeleton loading */}
              {showSkeleton && (
                <Stack spacing={2}>
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </Stack>
              )}

              {/* Empty state */}
              {!showSkeleton && filteredJobs.length === 0 && (
                <Card>
                  <CardContent sx={{ py: 10, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>Nenhuma vaga encontrada</Typography>
                    <Typography variant="body2" color="text.secondary">Ajuste os filtros ou inicie uma nova busca.</Typography>
                  </CardContent>
                </Card>
              )}

              {/* Job list with staggered entrance + feed ads every 5 cards */}
              {!showSkeleton && filteredJobs.length > 0 && filteredJobs.slice(0, 250).map((job, idx) => (
                <Fragment key={`${listVersion}-${job.id}`}>
                  {idx > 0 && idx % 5 === 0 && <FeedAdPlaceholder isDark={isDark} />}
                  <Box
                    sx={{
                      opacity: 0,
                      animation: 'kairosIn 0.4s ease forwards',
                      animationDelay: `${Math.min(idx * 22, 400)}ms`,
                    }}
                  >
                    <JobCard job={job} isDark={isDark} />
                  </Box>
                </Fragment>
              ))}
            </Stack>
          </Grid>

          {/* Right — Filtros + Exportar */}
          <Grid size={{ xs: 12, lg: 3 }} sx={{ order: { xs: 2, lg: 3 } }}>
            <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: 72 }}>

              {/* Filtros — toggle no mobile, sempre visível no desktop */}
              <Box>
                <Collapse in={filtersOpen} sx={{ display: { lg: 'none' } }}>
                  <Card sx={{ overflow: 'hidden', mb: 2 }}>
                    <Stack spacing={2} sx={{ p: 2.5 }}>
                      <TextField
                        label="Buscar" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="React, AWS, Stripe..." size="small"
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: 'text.secondary' }} /></InputAdornment> } }}
                      />
                      <FilterSelect label="Mercado" value={market} options={markets.map((m) => [m, marketLabel(m)])} onChange={setMarket} />
                      <Box>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.75 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem' }}>Relevância mínima</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', fontSize: '0.72rem' }}>{score > 0 ? `${score}+` : 'Todas'}</Typography>
                        </Stack>
                        <Slider value={score} onChange={(_, v) => setScore(v as number)} min={0} max={100} size="small" />
                      </Box>
                      <Button
                        size="small" variant={remoteOnly ? 'contained' : 'outlined'}
                        onClick={() => setRemoteOnly((v) => !v)}
                        sx={{ justifyContent: 'flex-start', fontSize: '0.8rem', ...(remoteOnly ? { background: 'linear-gradient(135deg, #1A2E4A, #2B5072)' } : { borderColor: 'divider', color: 'text.secondary' }) }}
                      >
                        {remoteOnly ? '✓ Apenas remoto' : 'Apenas remoto'}
                      </Button>
                    </Stack>
                  </Card>
                </Collapse>

                {/* Desktop — card completo com título */}
                <Card sx={{ overflow: 'hidden', display: { xs: 'none', lg: 'block' } }}>
                  <Box sx={{ px: 2.5, pt: 2, pb: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>Filtros</Typography>
                  </Box>
                  <Stack spacing={2} sx={{ p: 2.5 }}>
                    <TextField
                      label="Buscar" value={query} onChange={(e) => setQuery(e.target.value)}
                      placeholder="React, AWS, Stripe..." size="small"
                      slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: 'text.secondary' }} /></InputAdornment> } }}
                    />
                    <FilterSelect label="Mercado" value={market} options={markets.map((m) => [m, marketLabel(m)])} onChange={setMarket} />
                    <Box>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.75 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem' }}>Relevância mínima</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', fontSize: '0.72rem' }}>{score > 0 ? `${score}+` : 'Todas'}</Typography>
                      </Stack>
                      <Slider value={score} onChange={(_, v) => setScore(v as number)} min={0} max={100} size="small" />
                    </Box>
                    <Button
                      size="small" variant={remoteOnly ? 'contained' : 'outlined'}
                      onClick={() => setRemoteOnly((v) => !v)}
                      sx={{ justifyContent: 'flex-start', fontSize: '0.8rem', ...(remoteOnly ? { background: 'linear-gradient(135deg, #1A2E4A, #2B5072)' } : { borderColor: 'divider', color: 'text.secondary' }) }}
                    >
                      {remoteOnly ? '✓ Apenas remoto' : 'Apenas remoto'}
                    </Button>
                  </Stack>
                </Card>
              </Box>

              <Card sx={{ overflow: 'hidden' }}>
                <Box sx={{ px: 2.5, pt: 2, pb: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>Exportar</Typography>
                </Box>
                <Stack spacing={0.5} sx={{ p: 2 }}>
                  <Button fullWidth variant="contained" startIcon={<DownloadIcon sx={{ fontSize: '15px !important' }} />} href="/api/download-all"
                    sx={{ justifyContent: 'flex-start', py: 0.9, fontSize: '0.8rem', background: 'linear-gradient(135deg, #1A2E4A, #2B5072)', '&:hover': { background: 'linear-gradient(135deg, #243F65, #356090)' } }}>
                    Baixar tudo em ZIP
                  </Button>
                  {payload.downloads.length > 0 && <Divider sx={{ my: 0.5 }} />}
                  {payload.downloads.map((file) => (
                    <Button key={file.name} href={`/api/download/${encodeURIComponent(file.name)}`}
                      endIcon={<DownloadIcon sx={{ fontSize: '12px !important' }} />} size="small"
                      sx={{ justifyContent: 'space-between', color: 'text.secondary', fontWeight: 500, px: 0.5, fontSize: '0.74rem', '&:hover': { color: 'primary.main' } }}>
                      {file.label}
                    </Button>
                  ))}
                </Stack>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void;
}) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={(e: SelectChangeEvent) => onChange(e.target.value)}>
        <MenuItem value="">Todos</MenuItem>
        {options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: '12px', flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="58%" height={24} sx={{ mb: 0.5 }} />
            <Skeleton variant="text" width="38%" height={18} sx={{ mb: 1.25 }} />
            <Stack direction="row" spacing={0.5}>
              {[55, 70, 48, 62, 45].map((w) => (
                <Skeleton key={w} variant="rounded" width={w} height={17} sx={{ borderRadius: '4px' }} />
              ))}
            </Stack>
          </Box>
          <Stack sx={{ alignItems: 'flex-end', gap: 0.75, flexShrink: 0 }}>
            <Skeleton variant="circular" width={58} height={58} />
            <Skeleton variant="rounded" width={74} height={20} sx={{ borderRadius: '5px' }} />
            <Skeleton variant="text" width={60} height={16} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function CompanyAvatar({ name, highlight }: { name: string; highlight?: boolean }) {
  const color    = avatarColor(name);
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
      <Box sx={{
        width: 44, height: 44, borderRadius: '12px',
        bgcolor: color.bg,
        border: `1.5px solid ${highlight ? '#F59E0B' : color.border}`,
        boxShadow: highlight
          ? '0 2px 8px rgba(0,0,0,0.08), 0 0 0 2.5px rgba(245,158,11,0.35)'
          : '0 2px 8px rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography sx={{ fontWeight: 800, fontSize: initials.length > 1 ? '0.83rem' : '1.1rem', lineHeight: 1, color: color.text, userSelect: 'none', letterSpacing: '-0.03em' }}>
          {initials}
        </Typography>
      </Box>
      {highlight && (
        <Box sx={{
          position: 'absolute', top: -3, right: -3,
          width: 12, height: 12, borderRadius: '50%',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          border: '1.5px solid white',
          boxShadow: '0 1px 4px rgba(245,158,11,0.5)',
        }} />
      )}
    </Box>
  );
}

function GroupTag({ children, bg, color }: { children: ReactNode; bg: string; color: string }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', px: '7px', py: '2px', borderRadius: '4px', bgcolor: bg }}>
      <Typography sx={{ fontSize: '0.63rem', fontWeight: 700, color, lineHeight: '16px', whiteSpace: 'nowrap' }}>
        {children}
      </Typography>
    </Box>
  );
}

function scoreColors(score: number): { bg: string; text: string; stroke: string; track: string } {
  if (score >= 75) return { bg: '#D1FAE5', text: '#065F46', stroke: '#10B981', track: '#10B98122' };
  if (score >= 55) return { bg: '#DBEAFE', text: '#1E3A5F', stroke: '#3B82F6', track: '#3B82F622' };
  if (score >= 35) return { bg: '#FEF3C7', text: '#92400E', stroke: '#F59E0B', track: '#F59E0B22' };
  return { bg: '#F1F5F9', text: '#475569', stroke: '#94A3B8', track: '#94A3B822' };
}

function ScoreBadge({ score }: { score: number }) {
  const [live, setLive] = useState(0);

  useEffect(() => {
    setLive(0);
    const id = setTimeout(() => setLive(score), 80);
    return () => clearTimeout(id);
  }, [score]);

  const sc          = scoreColors(score);
  const SIZE        = 58;
  const RADIUS      = 23;
  const STROKE      = 5;
  const circumference = 2 * Math.PI * RADIUS;
  const offset      = circumference - (live / 100) * circumference;

  return (
    <Box sx={{
      position: 'relative', width: SIZE, height: SIZE, flexShrink: 0,
      filter: score >= 80 ? `drop-shadow(0 0 9px ${sc.stroke}70)` : 'none',
    }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        {/* Filled background + tinted track */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill={sc.bg} stroke={sc.track} strokeWidth={STROKE} />
        {/* Animated progress arc */}
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none" stroke={sc.stroke} strokeWidth={STROKE}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontWeight: 900, fontSize: '1rem', lineHeight: 1, color: sc.text }}>
          {score}
        </Typography>
      </Box>
    </Box>
  );
}

function JobCard({ job, isDark }: { job: JobOpportunity; isDark: boolean }) {
  const grp = reportGroup(job);
  const c   = GROUP_COLORS[grp];
  const src = job.sourceBoard ?? job.source;

  const tagBg     = isDark ? '#1E293B' : '#F1F5F9';
  const tagBorder = isDark ? '#334155' : '#E2E8F0';
  const tagText   = isDark ? '#94A3B8' : '#475569';

  const salaryBg     = isDark ? 'rgba(5,150,105,0.18)' : '#D1FAE5';
  const salaryBorder = isDark ? 'rgba(5,150,105,0.4)'  : '#A7F3D0';
  const salaryText   = isDark ? '#34D399'               : '#065F46';

  const metaParts = [
    job.locationText,
    remotePolicyLabel(job.remotePolicy),
    marketLabel(job.jobMarket),
  ].filter(Boolean).join(' · ');

  const rightMeta = [src, job.publishedAt ? relativeDate(job.publishedAt) : undefined]
    .filter(Boolean).join(' · ');

  return (
    <Card sx={{
      borderLeft: `4px solid ${c.accent}`,
      transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      '&:hover': {
        bgcolor: isDark ? `${c.accent}0D` : `${c.accent}07`,
        boxShadow: `0 14px 40px rgba(15,31,46,${isDark ? '0.4' : '0.13'}), 0 3px 10px rgba(15,31,46,${isDark ? '0.3' : '0.07'})`,
        transform: 'translateY(-2px)',
      },
    }}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>

          <CompanyAvatar name={job.companyName} highlight={job.score >= 80} />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Title */}
            <Link href={job.url} target="_blank" rel="noreferrer" underline="none" sx={{ display: 'block', mb: 0.4 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{
                  fontWeight: 700, fontSize: '1rem', lineHeight: 1.3, letterSpacing: '-0.015em',
                  color: 'text.primary', transition: 'color 0.15s',
                  '&:hover': { color: 'primary.main' },
                }}>
                  {job.title}
                </Typography>
                <OpenInNewIcon sx={{ fontSize: 11, color: 'text.secondary', flexShrink: 0, opacity: 0.5 }} />
              </Stack>
            </Link>

            {/* Company · meta */}
            <Typography sx={{ fontSize: '0.84rem', mb: 1.1, lineHeight: 1.4 }}>
              <Box component="span" sx={{ fontWeight: 600, color: 'secondary.main' }}>{job.companyName}</Box>
              {metaParts && (
                <Box component="span" sx={{ color: 'text.secondary' }}>{' · '}{metaParts}</Box>
              )}
            </Typography>

            {/* Group tag + stack */}
            <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <GroupTag bg={isDark ? GROUP_DARK[grp].bg : c.bg} color={isDark ? GROUP_DARK[grp].text : c.text}>{GROUP_LABELS[grp]}</GroupTag>
              {(job.stackSignals ?? []).slice(0, 6).map((s) => (
                <Box key={s} sx={{
                  px: '7px', py: '2px', borderRadius: '4px',
                  bgcolor: tagBg, border: `1px solid ${tagBorder}`,
                  fontSize: '0.63rem', fontWeight: 500, color: tagText, lineHeight: '17px',
                  fontFamily: '"SF Mono","Cascadia Code","Fira Code",monospace',
                }}>
                  {s}
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Right panel */}
          <Stack sx={{ alignItems: 'flex-end', gap: 0.75, flexShrink: 0 }}>
            <ScoreBadge score={job.score} />
            {job.salaryText && (
              <Box sx={{ px: '9px', py: '3px', borderRadius: '5px', bgcolor: salaryBg, border: `1px solid ${salaryBorder}`, maxWidth: 130 }}>
                <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, color: salaryText, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatSalary(job.salaryText)}
                </Typography>
              </Box>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.63rem', whiteSpace: 'nowrap', opacity: 0.75 }}>
              {rightMeta}
            </Typography>
          </Stack>

        </Stack>
      </CardContent>
    </Card>
  );
}

function LeaderboardAdBanner({ isDark }: { isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* noop */ }
  }, []);

  if (ADS_ENABLED) {
    return (
      <Box ref={ref} sx={{ mb: 2.5, borderRadius: 2, overflow: 'hidden', minHeight: 90 }}>
        <ins className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={AD_SLOTS.leaderboard}
          data-ad-format="horizontal"
          data-full-width-responsive="true" />
      </Box>
    );
  }

  return (
    <Card component="a" href="#" sx={{
      display: 'flex', textDecoration: 'none', mb: 2.5, overflow: 'hidden',
      borderLeft: 'none', border: '1px solid', borderColor: 'divider',
      bgcolor: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.9)',
      transition: 'box-shadow 0.2s ease',
      '&:hover': { boxShadow: `0 6px 22px rgba(15,31,46,${isDark ? '0.32' : '0.08'})` },
    }}>
      <Box sx={{
        width: { xs: 72, md: 120 }, flexShrink: 0,
        background: isDark
          ? 'linear-gradient(135deg, rgba(26,46,74,0.5), rgba(61,126,191,0.3))'
          : 'linear-gradient(135deg, rgba(26,46,74,0.05), rgba(61,126,191,0.1))',
        borderRight: '1px dashed', borderColor: 'divider',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', opacity: 0.35 }}>logo</Typography>
      </Box>
      <Box sx={{ flex: 1, px: { xs: 2, md: 3 }, py: 1.75, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'inline-flex', px: '6px', py: '1px', borderRadius: '3px', bgcolor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.13)', border: `1px solid rgba(148,163,184,${isDark ? '0.18' : '0.28'})`, mb: 0.6 }}>
            <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1.5 }}>Patrocinado</Typography>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', md: '0.95rem' }, color: 'text.primary', lineHeight: 1.35, mb: 0.3 }}>
            Anuncie para engenheiros e tech leads em busca ativa
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5, display: { xs: 'none', sm: 'block' } }}>
            Alcance o público certo — desenvolvedores seniores, arquitetos e líderes técnicos.
          </Typography>
        </Box>
        <Button variant="outlined" size="small" component="span" sx={{
          flexShrink: 0, fontSize: '0.73rem',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'divider',
          color: 'text.secondary', whiteSpace: 'nowrap',
          '&:hover': { borderColor: 'primary.light', color: 'primary.main' },
        }}>Anunciar →</Button>
      </Box>
      <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', borderLeft: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: '0.56rem', color: 'text.secondary', opacity: 0.4, writingMode: 'vertical-rl', letterSpacing: '0.08em' }}>ads via Carbon</Typography>
      </Box>
    </Card>
  );
}

function RightSidebarAdPrimary() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* noop */ }
  }, []);

  if (ADS_ENABLED) {
    return (
      <Box ref={ref} sx={{ overflow: 'hidden', minHeight: 250 }}>
        <ins className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={AD_SLOTS.sidebarTop}
          data-ad-format="rectangle"
          data-full-width-responsive="true" />
      </Box>
    );
  }

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1.75, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>Patrocinado</Typography>
        <Typography sx={{ fontSize: '0.59rem', color: 'text.secondary', opacity: 0.45 }}>Google Ads</Typography>
      </Box>
      <Box sx={{ p: 2 }}>
        <Box sx={{
          width: '100%', aspectRatio: '300 / 250', borderRadius: '10px', mb: 1.75,
          background: 'linear-gradient(135deg, rgba(26,46,74,0.05) 0%, rgba(61,126,191,0.09) 100%)',
          border: '1.5px dashed', borderColor: 'divider',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5,
        }}>
          <Typography sx={{ fontSize: '1.05rem', color: 'text.secondary', opacity: 0.2 }}>⬡</Typography>
          <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', opacity: 0.35 }}>300 × 250</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.83rem', fontWeight: 700, lineHeight: 1.45, color: 'text.primary', mb: 0.6 }}>
          Leve seu produto para o próximo nível
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.6, mb: 1.5 }}>
          Anuncie para engenheiros seniores, tech leads e arquitetos em busca ativa.
        </Typography>
        <Button fullWidth variant="outlined" size="small" href="#"
          sx={{ fontSize: '0.75rem', borderColor: 'divider', color: 'text.secondary',
            '&:hover': { borderColor: 'primary.light', color: 'primary.main', bgcolor: 'transparent' } }}>
          Anunciar aqui
        </Button>
      </Box>
    </Card>
  );
}

function RightSidebarAdSecondary() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* noop */ }
  }, []);

  if (ADS_ENABLED) {
    return (
      <Box ref={ref} sx={{ overflow: 'hidden', minHeight: 90 }}>
        <ins className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={AD_SLOTS.sidebarBot}
          data-ad-format="auto"
          data-full-width-responsive="true" />
      </Box>
    );
  }

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1.75, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>Patrocinado</Typography>
        <Typography sx={{ fontSize: '0.59rem', color: 'text.secondary', opacity: 0.45 }}>Google Ads</Typography>
      </Box>
      <Box sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Box sx={{
          width: 52, height: 52, borderRadius: '10px', flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(26,46,74,0.06), rgba(61,126,191,0.1))',
          border: '1.5px dashed', borderColor: 'divider',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', opacity: 0.35 }}>logo</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.4, mb: 0.45 }}>
            Sua ferramenta dev aqui
          </Typography>
          <Typography sx={{ fontSize: '0.69rem', color: 'text.secondary', lineHeight: 1.55, mb: 1 }}>
            Alcance um público técnico altamente qualificado.
          </Typography>
          <Link href="#" underline="none"
            sx={{ fontSize: '0.69rem', fontWeight: 700, color: 'primary.main', '&:hover': { color: 'secondary.main' } }}>
            Saiba mais →
          </Link>
        </Box>
      </Box>
    </Card>
  );
}

function SidebarAdPlaceholder() {
  return (
    <Card sx={{ overflow: 'hidden', opacity: 0.95 }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1.75, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>Patrocinado</Typography>
        <Typography sx={{ fontSize: '0.59rem', color: 'text.secondary', opacity: 0.5 }}>ads via Carbon</Typography>
      </Box>
      <Box sx={{ p: 2 }}>
        <Box sx={{
          width: '100%', aspectRatio: '130 / 100', borderRadius: '8px', mb: 1.5,
          background: 'linear-gradient(135deg, rgba(26,46,74,0.06) 0%, rgba(61,126,191,0.08) 100%)',
          border: '1.5px dashed', borderColor: 'divider',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', opacity: 0.4 }}>130 × 100</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.45, color: 'text.primary', mb: 0.6 }}>
          Seu produto para devs aqui
        </Typography>
        <Typography sx={{ fontSize: '0.71rem', color: 'text.secondary', lineHeight: 1.55, mb: 1.25 }}>
          Alcance engenheiros e tech leads que buscam oportunidades de topo.
        </Typography>
        <Link href="#" underline="none"
          sx={{ fontSize: '0.71rem', fontWeight: 700, color: 'primary.main', '&:hover': { color: 'secondary.main' } }}>
          Saiba mais →
        </Link>
      </Box>
    </Card>
  );
}

function FeedAdPlaceholder({ isDark }: { isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* noop */ }
  }, []);

  if (ADS_ENABLED) {
    return (
      <Box ref={ref} sx={{ overflow: 'hidden', minHeight: 90 }}>
        <ins className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={AD_SLOTS.feed}
          data-ad-layout="in-article"
          data-ad-format="fluid" />
      </Box>
    );
  }

  return (
    <Card component="a" href="#" sx={{
      display: 'block', textDecoration: 'none',
      borderLeft: `4px solid rgba(148,163,184,${isDark ? '0.3' : '0.45'})`,
      bgcolor: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.9)',
      transition: 'all 0.2s ease',
      '&:hover': {
        boxShadow: `0 8px 28px rgba(15,31,46,${isDark ? '0.35' : '0.09'})`,
        transform: 'translateY(-1px)',
      },
    }}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
            background: isDark
              ? 'linear-gradient(135deg, rgba(26,46,74,0.4), rgba(61,126,191,0.25))'
              : 'linear-gradient(135deg, rgba(26,46,74,0.06), rgba(61,126,191,0.1))',
            border: '1.5px dashed',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,31,46,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: '0.54rem', color: 'text.secondary', opacity: 0.4 }}>logo</Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <Box sx={{ px: '6px', py: '1px', borderRadius: '3px', bgcolor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.12)', border: `1px solid rgba(148,163,184,${isDark ? '0.2' : '0.28'})` }}>
                <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, color: 'text.secondary', lineHeight: 1.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Patrocinado</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary', lineHeight: 1.35, mb: 0.35 }}>
              Divulgue sua vaga ou produto para devs
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.5 }}>
              Alcance engenheiros seniores e tech leads em busca ativa — público altamente qualificado.
            </Typography>
          </Box>

          <Stack sx={{ alignItems: 'flex-end', gap: 0.75, flexShrink: 0 }}>
            <Button variant="outlined" size="small" component="span" sx={{
              fontSize: '0.73rem', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'divider',
              color: 'text.secondary', whiteSpace: 'nowrap',
              '&:hover': { borderColor: 'primary.light', color: 'primary.main' },
            }}>
              Anunciar →
            </Button>
            <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', opacity: 0.45 }}>ads via Carbon</Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

function reportGroup(job: Pick<JobOpportunity, 'roleCategory' | 'seniority'>): ReportGroup {
  if (job.roleCategory === 'devops') return 'devops';
  if (['software_architecture','solutions_architecture','cloud_architecture'].includes(job.roleCategory) || job.seniority === 'architect') return 'arq';
  if (job.roleCategory === 'qa') return 'qa';
  if (job.roleCategory === 'management') return 'management';
  if (job.seniority === 'junior') return 'junior';
  if (job.seniority === 'mid_level') return 'pleno';
  if (['senior','lead'].includes(job.seniority)) return 'senior';
  if (['staff','principal','staff_or_principal'].includes(job.seniority)) return 'staff';
  return 'other';
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function marketLabel(market: string): string {
  const m: Record<string,string> = { brazil:'Brasil', brazil_friendly:'Favorável ao Brasil', latam:'LATAM', international:'Internacional', unclear:'Indefinido' };
  return m[market] ?? market;
}

function remotePolicyLabel(policy: string): string {
  const m: Record<string,string> = { remote:'Remoto', hybrid:'Híbrido', onsite:'Presencial', unknown:'Não definido' };
  return m[policy] ?? policy;
}

function formatSalary(text: string): string {
  return text
    .replace(/\bUSD\s*/gi, '$ ')
    .replace(/\bBRL\s*/gi, 'R$ ')
    .replace(/\bEUR\s*/gi, '€ ')
    .replace(/\bGBP\s*/gi, '£ ')
    .replace(/\b(\d{5,})\b/g, (_, n) => { const v = parseInt(n, 10); return v >= 1000 ? `${Math.round(v/1000)}K` : n; })
    .replace(/\s+/g, ' ')
    .trim();
}

function relativeDate(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 7)  return `${d}d`;
  if (d < 14) return '1 sem';
  if (d < 30) return `${Math.floor(d / 7)} sem`;
  if (d < 60) return '1 mês';
  return `${Math.floor(d / 30)} meses`;
}
