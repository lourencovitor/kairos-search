import { useCallback, useEffect, useRef, useState } from 'react';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PinOutlinedIcon from '@mui/icons-material/PinOutlined';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';

import type { JobOpportunity } from '../../api/types.js';
import { GroupTag } from '../../components/GroupTag.js';
import { remotePolicyLabel } from '../../utils/format-helpers.js';
import { GROUP_COLORS, GROUP_DARK, GROUP_LABELS, reportGroup } from '../../utils/report-group.js';
import { AtsApiError, atsApi } from '../api/client.js';
import type { AnalysisDto, ApplyVerdict, CandidateProfile } from '../api/types.js';
import { clearCvProfile, saveCvProfile } from '../profileStorage.js';
import { ApplyVerdictBanner, ApplyVerdictPill } from './ApplyVerdictBanner.js';
import { InlineMarkdown } from './InlineMarkdown.js';
import { ScoreBreakdownView } from './ScoreBreakdownView.js';
import { ScoreGauge } from './ScoreGauge.js';

type Phase = 'loading' | 'auth' | 'cv' | 'analyzing' | 'result' | 'error';

const FLOW_STEPS = [
  { label: 'Preparar', icon: AutoAwesomeIcon },
  { label: 'Entrar', icon: LockOutlinedIcon },
  { label: 'Seu CV', icon: InsertDriveFileOutlinedIcon },
  { label: 'Análise', icon: AnalyticsOutlinedIcon },
] as const;

const DELIVERABLES = [
  {
    icon: AnalyticsOutlinedIcon,
    title: 'Score 0–100',
    text: 'Skills, senioridade, idioma e região por regras fixas.',
  },
  {
    icon: FactCheckOutlinedIcon,
    title: 'Breakdown ATS',
    text: 'O que o sistema "vê" no seu CV e o que falta para esta vaga.',
  },
  {
    icon: TipsAndUpdatesOutlinedIcon,
    title: 'Plano + veredito',
    text: 'Sugestões editáveis e recomendação clara de aplicação.',
  },
] as const;

const ANALYZING_STEPS = [
  'Extraindo skills do CV',
  'Mapeando senioridade e experiência',
  'Cruzando com requisitos da vaga',
  'Calculando score e gerando recomendação',
] as const;

function stripLeadingSuggestionNumber(text: string): string {
  return text.replace(/^\s*\d+[.)]\s+/, '').trim();
}

function stepIndex(phase: Phase): number {
  switch (phase) {
    case 'loading':
      return 0;
    case 'auth':
      return 1;
    case 'cv':
    case 'analyzing':
      return 2;
    case 'result':
      return 3;
    default:
      return 0;
  }
}

function CompanyMonogram({
  name,
  size = 44,
  accent,
  isDark,
}: {
  readonly name: string;
  readonly size?: number;
  readonly accent: string;
  readonly isDark: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '12px',
        flexShrink: 0,
        background: `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.55)})`,
        border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.4)',
        boxShadow: `0 8px 18px ${alpha(accent, 0.32)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontWeight: 800,
        fontSize: `${size * 0.36}px`,
        letterSpacing: '-0.03em',
      }}
    >
      {initials || '?'}
    </Box>
  );
}

function JobContextBanner({
  job,
  isDark,
}: {
  readonly job: JobOpportunity;
  readonly isDark: boolean;
}) {
  const grp = reportGroup(job);
  const c = GROUP_COLORS[grp];
  const tagBg = isDark ? 'rgba(30,41,59,0.7)' : 'rgba(255,255,255,0.75)';
  const tagBorder = isDark ? 'rgba(148,163,184,0.25)' : 'rgba(15,31,46,0.10)';
  const tagText = isDark ? '#CBD5E1' : '#475569';

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 2.5,
        overflow: 'hidden',
        background: isDark
          ? `linear-gradient(135deg, ${alpha(c.accent, 0.22)} 0%, transparent 70%), ${alpha('#0F172A', 0.6)}`
          : `linear-gradient(135deg, ${alpha(c.accent, 0.12)} 0%, ${alpha(c.accent, 0.02)} 100%)`,
        border: '1px solid',
        borderColor: isDark ? alpha(c.accent, 0.35) : alpha(c.accent, 0.22),
        p: 2.25,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 4,
          background: `linear-gradient(180deg, ${c.accent}, ${alpha(c.accent, 0.5)})`,
        }}
      />
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', pl: 1 }}>
        <CompanyMonogram name={job.companyName} accent={c.accent} isDark={isDark} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.25 }}
          >
            <GroupTag
              bg={isDark ? GROUP_DARK[grp].bg : c.bg}
              color={isDark ? GROUP_DARK[grp].text : c.text}
            >
              {GROUP_LABELS[grp]}
            </GroupTag>
            {job.score !== undefined && (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.85,
                  py: 0.15,
                  borderRadius: 99,
                  bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.06)',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  color: 'text.secondary',
                }}
              >
                <WorkspacePremiumOutlinedIcon sx={{ fontSize: 12 }} />
                Match Kairos {job.score}
              </Box>
            )}
          </Stack>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1.1rem',
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              mb: 0.4,
              color: 'text.primary',
            }}
          >
            {job.title}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.84rem',
              color: 'text.secondary',
              mb: 1.25,
              lineHeight: 1.4,
            }}
          >
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {job.companyName}
            </Box>
            {job.locationText ? ` · ${job.locationText}` : ''}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
            {job.remotePolicy && (
              <Box
                sx={{
                  px: '8px',
                  py: '2px',
                  borderRadius: '5px',
                  bgcolor: tagBg,
                  border: `1px solid ${tagBorder}`,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: tagText,
                  backdropFilter: 'blur(4px)',
                }}
              >
                {remotePolicyLabel(job.remotePolicy)}
              </Box>
            )}
            {(job.stackSignals ?? []).slice(0, 5).map((s) => (
              <Box
                key={s}
                sx={{
                  px: '8px',
                  py: '2px',
                  borderRadius: '5px',
                  bgcolor: tagBg,
                  border: `1px solid ${tagBorder}`,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: tagText,
                  fontFamily: '"SF Mono","Cascadia Code",monospace',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {s}
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function FlowStepperStrip({
  active,
  isDark,
}: {
  readonly active: number;
  readonly isDark: boolean;
}) {
  const theme = useTheme();

  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        flexWrap: 'wrap',
        gap: 0.75,
      }}
    >
      {FLOW_STEPS.map((step, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <Box
            key={step.label}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              borderRadius: 99,
              border: '1px solid',
              borderColor: current
                ? alpha(theme.palette.primary.main, 0.45)
                : done
                  ? alpha(theme.palette.success.main, 0.35)
                  : 'divider',
              bgcolor: current
                ? alpha(theme.palette.primary.main, isDark ? 0.2 : 0.08)
                : done
                  ? alpha(theme.palette.success.main, isDark ? 0.12 : 0.06)
                  : isDark
                    ? 'rgba(15,23,42,0.35)'
                    : '#F8FAFC',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                fontWeight: 800,
                color: done || current ? '#fff' : 'text.secondary',
                bgcolor: done
                  ? 'success.main'
                  : current
                    ? 'primary.main'
                    : isDark
                      ? 'rgba(148,163,184,0.25)'
                      : 'rgba(15,31,46,0.12)',
              }}
            >
              {done ? <CheckRoundedIcon sx={{ fontSize: 12 }} /> : i + 1}
            </Box>
            <Typography
              sx={{
                fontSize: '0.72rem',
                fontWeight: current ? 700 : 600,
                color: current ? 'primary.main' : done ? 'success.main' : 'text.secondary',
                whiteSpace: 'nowrap',
              }}
            >
              {step.label}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

function DeliverableGrid({ isDark }: { readonly isDark: boolean }) {
  const theme = useTheme();
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <AutoAwesomeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography
          sx={{
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          O que você vai receber
        </Typography>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'stretch' }}>
        {DELIVERABLES.map((d) => {
          const Icon = d.icon;
          return (
            <Box
              key={d.title}
              sx={{
                flex: 1,
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: isDark ? 'rgba(15,23,42,0.5)' : '#F8FAFC',
                transition: 'all 0.22s ease',
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.4),
                  transform: 'translateY(-2px)',
                  boxShadow: isDark
                    ? '0 8px 24px rgba(0,0,0,0.35)'
                    : '0 8px 24px rgba(15,31,46,0.08)',
                },
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1A2E4A, #3D7EBF)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.25,
                  boxShadow: '0 4px 12px rgba(26,46,74,0.28)',
                }}
              >
                <Icon sx={{ fontSize: 17 }} />
              </Box>
              <Typography
                sx={{
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  letterSpacing: '-0.015em',
                  lineHeight: 1.3,
                  mb: 0.4,
                }}
              >
                {d.title}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.74rem',
                  color: 'text.secondary',
                  lineHeight: 1.5,
                }}
              >
                {d.text}
              </Typography>
            </Box>
          );
        })}
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mt: 1.5,
          p: 1.25,
          borderRadius: 1.5,
          bgcolor: isDark ? 'rgba(16,185,129,0.1)' : '#ECFDF5',
          border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#A7F3D0'}`,
          alignItems: 'center',
        }}
      >
        <ShieldOutlinedIcon sx={{ fontSize: 17, color: 'success.main' }} />
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.5 }}>
          Seu arquivo é processado em memória, sem armazenamento (LGPD).
        </Typography>
      </Stack>
    </Box>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  count,
  accent,
}: {
  readonly icon: React.ElementType;
  readonly title: string;
  readonly subtitle?: string;
  readonly count?: number | string;
  readonly accent?: string;
}) {
  const theme = useTheme();
  const c = accent ?? theme.palette.primary.main;
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '9px',
          bgcolor: alpha(c, 0.12),
          color: c,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 17 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.97rem', letterSpacing: '-0.018em' }}>
            {title}
          </Typography>
          {count !== undefined && (
            <Chip
              size="small"
              label={count}
              sx={{
                height: 19,
                fontSize: '0.65rem',
                fontWeight: 700,
                bgcolor: alpha(c, 0.15),
                color: c,
                '& .MuiChip-label': { px: 0.85 },
              }}
            />
          )}
        </Stack>
        {subtitle && (
          <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', lineHeight: 1.4 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

function SkillChips({
  profile,
  isDark,
}: {
  readonly profile: CandidateProfile;
  readonly isDark: boolean;
}) {
  const tagBg = isDark ? '#1E293B' : '#F1F5F9';
  const tagBorder = isDark ? '#334155' : '#E2E8F0';
  const tagText = isDark ? '#CBD5E1' : '#475569';
  const theme = useTheme();

  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
      <Chip
        size="small"
        label={`${profile.yearsTotalExperience} anos exp.`}
        sx={{
          height: 22,
          fontSize: '0.7rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #1A2E4A, #3D7EBF)',
          color: '#FFFFFF',
          '& .MuiChip-label': { px: 1 },
        }}
      />
      <Chip
        size="small"
        label={profile.seniorityHint}
        sx={{
          height: 22,
          fontSize: '0.7rem',
          fontWeight: 600,
          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
          color: 'primary.main',
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.25),
          '& .MuiChip-label': { px: 1 },
        }}
      />
      {profile.skills.slice(0, 8).map((s) => (
        <Box
          key={s.name}
          sx={{
            px: '8px',
            py: '3px',
            borderRadius: '5px',
            bgcolor: tagBg,
            border: `1px solid ${tagBorder}`,
            fontSize: '0.66rem',
            fontWeight: 600,
            color: tagText,
            fontFamily: '"SF Mono","Cascadia Code",monospace',
            lineHeight: 1.3,
          }}
        >
          {s.name}
        </Box>
      ))}
    </Stack>
  );
}

function DropZone({
  uploading,
  profile,
  isDark,
  onPick,
}: {
  readonly uploading: boolean;
  readonly profile: CandidateProfile | null;
  readonly isDark: boolean;
  readonly onPick: () => void;
}) {
  const theme = useTheme();
  const [hover, setHover] = useState(false);
  const success = !!profile;

  return (
    <Box
      onClick={() => !uploading && onPick()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{
        position: 'relative',
        py: 4,
        px: 2,
        borderRadius: 2.5,
        border: '2px dashed',
        borderColor: success
          ? 'success.main'
          : hover
            ? 'primary.main'
            : isDark
              ? 'rgba(148,163,184,0.35)'
              : 'rgba(15,31,46,0.18)',
        background: success
          ? isDark
            ? 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(16,185,129,0.04))'
            : 'linear-gradient(135deg, #ECFDF5, #FFFFFF)'
          : hover
            ? isDark
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.18)}, ${alpha(theme.palette.primary.main, 0.04)})`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, #FFFFFF)`
            : isDark
              ? 'rgba(15,23,42,0.45)'
              : '#F8FAFC',
        cursor: uploading ? 'wait' : 'pointer',
        textAlign: 'center',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: hover && !uploading ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow:
          hover && !uploading
            ? isDark
              ? '0 12px 32px rgba(0,0,0,0.4)'
              : '0 12px 32px rgba(15,31,46,0.08)'
            : 'none',
      }}
    >
      {uploading ? (
        <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
          <CircularProgress size={32} />
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>Lendo seu CV…</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
            Extraindo skills, senioridade e idiomas
          </Typography>
        </Stack>
      ) : success ? (
        <Stack spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10B981, #34D399)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(16,185,129,0.4)',
            }}
          >
            <CheckRoundedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: 'success.main' }}>
            CV pronto para análise
          </Typography>
          <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>
            Clique para trocar de arquivo
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1A2E4A, #3D7EBF)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(26,46,74,0.32)',
              transition: 'transform 0.25s ease',
              transform: hover ? 'translateY(-2px) scale(1.05)' : 'translateY(0)',
            }}
          >
            <CloudUploadOutlinedIcon sx={{ fontSize: 26 }} />
          </Box>
          <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, letterSpacing: '-0.015em' }}>
            Solte ou clique para enviar seu CV
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Chip
              size="small"
              label="PDF"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 700,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                '& .MuiChip-label': { px: 0.85 },
              }}
            />
            <Chip
              size="small"
              label="DOCX"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 700,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                '& .MuiChip-label': { px: 0.85 },
              }}
            />
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>· até 5 MB</Typography>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

function AnalyzingSkeleton({ isDark }: { readonly isDark: boolean }) {
  const theme = useTheme();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % ANALYZING_STEPS.length), 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <Card
      sx={{
        background: isDark
          ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, transparent 80%)`
          : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, #FFFFFF 80%)`,
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1A2E4A, #3D7EBF)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(26,46,74,0.28)',
              animation: 'kairosPulse 1.4s ease-in-out infinite',
              '@keyframes kairosPulse': {
                '0%, 100%': { transform: 'scale(1)', boxShadow: '0 8px 20px rgba(26,46,74,0.28)' },
                '50%': { transform: 'scale(1.06)', boxShadow: '0 12px 32px rgba(26,46,74,0.4)' },
              },
            }}
          >
            <AnalyticsOutlinedIcon />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.98rem', letterSpacing: '-0.015em' }}>
              Analisando fit com a vaga
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              {ANALYZING_STEPS[tick]}…
            </Typography>
          </Box>
        </Stack>
        <Stack spacing={1.25}>
          {ANALYZING_STEPS.map((label, i) => {
            const done = i < tick;
            const current = i === tick;
            return (
              <Stack key={label} direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: done
                      ? 'linear-gradient(135deg, #10B981, #34D399)'
                      : current
                        ? 'linear-gradient(135deg, #1A2E4A, #3D7EBF)'
                        : isDark
                          ? 'rgba(148,163,184,0.18)'
                          : 'rgba(15,31,46,0.06)',
                    color: done || current ? '#FFFFFF' : 'transparent',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {done ? (
                    <CheckRoundedIcon sx={{ fontSize: 13 }} />
                  ) : current ? (
                    <CircularProgress size={12} sx={{ color: '#FFFFFF' }} thickness={5} />
                  ) : null}
                </Box>
                <Typography
                  sx={{
                    fontSize: '0.82rem',
                    fontWeight: current ? 700 : 500,
                    color: current ? 'primary.main' : done ? 'text.primary' : 'text.secondary',
                    transition: 'color 0.3s ease',
                  }}
                >
                  {label}
                </Typography>
                <Box sx={{ flex: 1 }}>
                  {!done && (
                    <Skeleton
                      variant="rounded"
                      height={6}
                      animation="wave"
                      sx={{
                        borderRadius: 99,
                        bgcolor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,31,46,0.05)',
                      }}
                    />
                  )}
                </Box>
              </Stack>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function AtsAnalysisModal(props: {
  readonly open: boolean;
  readonly job: JobOpportunity | null;
  readonly isDark: boolean;
  readonly onClose: () => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [atsJobId, setAtsJobId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisDto | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resetModalState = useCallback(() => {
    stopPoll();
    setPhase('loading');
    setError(null);
    setAtsJobId(null);
    setEmail('');
    setCode('');
    setCodeSent(false);
    setProfile(null);
    setAnalysis(null);
    setUploading(false);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
    clearCvProfile();
  }, [stopPoll]);

  const handleClose = useCallback(() => {
    resetModalState();
    props.onClose();
  }, [resetModalState, props.onClose]);

  const bootstrap = useCallback(async (job: JobOpportunity) => {
    setPhase('loading');
    setError(null);
    setAnalysis(null);
    setCodeSent(false);
    setProfile(null);
    setEmail('');
    setCode('');
    setCodeSent(false);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
    const sourceId = job.sourceId ?? job.url;
    try {
      const { data: atsJob } = await atsApi.lookupJob(job.source, sourceId);
      setAtsJobId(atsJob.id);
      const loggedIn = await atsApi.checkSession();
      setPhase(loggedIn ? 'cv' : 'auth');
    } catch (err) {
      let msg = 'Não foi possível preparar a análise';
      if (err instanceof AtsApiError) {
        if (err.status === 404) {
          msg =
            'Esta vaga ainda não está no índice ATS. No repo kairos-ats rode: ./scripts/sync-job-research-top5.sh 20 (com API em :4000 e worker-search ativo).';
        } else {
          msg = err.message;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (props.open && props.job) {
      void bootstrap(props.job);
    }
    return () => stopPoll();
  }, [props.open, props.job, bootstrap, stopPoll]);

  useEffect(() => {
    if (!props.open) {
      resetModalState();
    }
  }, [props.open, resetModalState]);

  async function handleRequestCode() {
    setError(null);
    try {
      await atsApi.requestMagicCode(email.trim());
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar código');
    }
  }

  async function handleVerify() {
    setError(null);
    try {
      await atsApi.verifyMagicCode(email.trim(), code.trim());
      setPhase('cv');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido');
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { data } = await atsApi.uploadCv(file);
      setProfile(data.profile);
      saveCvProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar CV');
    } finally {
      setUploading(false);
    }
  }

  async function pollAnalysis(id: string) {
    const { data } = await atsApi.getAnalysis(id);
    setAnalysis(data);
    if (data.status === 'done' || data.status === 'failed') {
      stopPoll();
      setPhase(data.status === 'done' ? 'result' : 'error');
      if (data.status === 'failed') {
        setError(data.error ?? 'Análise falhou');
      }
    }
  }

  async function handleAnalyze() {
    if (!atsJobId || !profile) return;
    setError(null);
    setPhase('analyzing');
    try {
      const { data } = await atsApi.createAnalysis(atsJobId, profile, props.job?.descriptionText);
      setAnalysis(data);
      stopPoll();
      if (data.status === 'done') {
        setPhase('result');
        return;
      }
      pollRef.current = setInterval(() => {
        void pollAnalysis(data.id).catch((err) => {
          setError(err instanceof Error ? err.message : 'Erro ao consultar análise');
          stopPoll();
          setPhase('error');
        });
      }, 2000);
      await pollAnalysis(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar análise');
      setPhase('error');
    }
  }

  const verdict: ApplyVerdict | null = analysis?.scoreBreakdown.applyVerdict ?? null;
  const verdictReason = analysis?.scoreBreakdown.applyVerdictReason ?? '';
  const activeStep = stepIndex(phase);
  const showIntro = phase !== 'result' && phase !== 'analyzing';

  return (
    <Dialog
      open={props.open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            border: `1px solid ${props.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.08)'}`,
            boxShadow: props.isDark
              ? '0 32px 80px rgba(0,0,0,0.55)'
              : '0 32px 80px rgba(15,31,46,0.22)',
          },
        },
      }}
    >
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: props.isDark ? 'rgba(15,23,42,0.35)' : '#FFFFFF',
        }}
      >
        <Box
          sx={{
            height: 3,
            background: 'linear-gradient(90deg, #1A2E4A 0%, #3D7EBF 55%, #34D399 100%)',
          }}
        />
        <Stack spacing={1.5} sx={{ px: { xs: 2.5, sm: 3 }, pt: 2.5, pb: 2 }}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                <AnalyticsOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    lineHeight: 1,
                  }}
                >
                  Kairos ATS
                </Typography>
              </Stack>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1.05rem', sm: '1.2rem' },
                  letterSpacing: '-0.02em',
                  lineHeight: 1.25,
                  color: 'text.primary',
                }}
              >
                Análise ATS para esta vaga
              </Typography>
              {!props.job && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5, lineHeight: 1.45 }}
                >
                  Envie seu CV e veja score, gaps e recomendação de candidatura.
                </Typography>
              )}
            </Box>
            <IconButton
              onClick={handleClose}
              aria-label="Fechar"
              size="small"
              sx={{
                mt: 0.25,
                flexShrink: 0,
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
          <FlowStepperStrip active={activeStep} isDark={props.isDark} />
        </Stack>
      </Box>

      <DialogContent
        sx={{
          px: { xs: 2.5, sm: 4 },
          py: 3,
          bgcolor: props.isDark ? 'rgba(15,23,42,0.4)' : '#FAFBFC',
        }}
      >
        <Stack spacing={2.5}>
          {props.job && <JobContextBanner job={props.job} isDark={props.isDark} />}

          {showIntro && <DeliverableGrid isDark={props.isDark} />}

          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {phase === 'loading' && (
            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <CircularProgress size={22} />
                    <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      Conectando ao índice ATS…
                    </Typography>
                  </Stack>
                  <Skeleton variant="rounded" height={60} animation="wave" />
                  <Skeleton variant="rounded" height={40} animation="wave" />
                  <Skeleton variant="rounded" height={40} animation="wave" />
                </Stack>
              </CardContent>
            </Card>
          )}

          {phase === 'auth' && (
            <Card>
              <CardContent>
                <SectionHeader
                  icon={LockOutlinedIcon}
                  title="Entrar sem senha"
                  subtitle="Código mágico de 6 dígitos direto no seu e-mail."
                />
                <Stack spacing={1.75}>
                  <TextField
                    label="Seu e-mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="voce@empresa.com"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <EmailOutlinedIcon sx={{ mr: 1, opacity: 0.5, fontSize: 19 }} />
                        ),
                      },
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => void handleRequestCode()}
                    disabled={!email.trim()}
                    fullWidth
                    sx={{ py: 1, fontWeight: 700 }}
                  >
                    {codeSent ? 'Reenviar código' : 'Enviar código por e-mail'}
                  </Button>
                  {codeSent && (
                    <Alert severity="success" sx={{ borderRadius: 2, py: 0.5 }}>
                      Código enviado. Pode levar alguns segundos.
                    </Alert>
                  )}
                  <TextField
                    label="Código de 6 dígitos"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    fullWidth
                    size="small"
                    slotProps={{
                      htmlInput: {
                        inputMode: 'numeric',
                        maxLength: 8,
                        style: { letterSpacing: '0.3em', fontFamily: 'monospace', fontWeight: 700 },
                      },
                      input: {
                        startAdornment: (
                          <PinOutlinedIcon sx={{ mr: 1, opacity: 0.5, fontSize: 19 }} />
                        ),
                      },
                    }}
                    placeholder="000000"
                  />
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={() => void handleVerify()}
                    disabled={!email.trim() || code.trim().length < 4}
                    sx={{
                      py: 1.25,
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      background: 'linear-gradient(135deg, #1A2E4A, #3D7EBF)',
                      boxShadow: '0 8px 22px rgba(26,46,74,0.32)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #243F65, #4A8FD0)',
                        boxShadow: '0 10px 28px rgba(26,46,74,0.4)',
                      },
                    }}
                  >
                    Continuar para envio do CV
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {(phase === 'cv' || phase === 'analyzing') && phase === 'cv' && (
            <Stack spacing={2}>
              <Card>
                <CardContent>
                  <SectionHeader
                    icon={InsertDriveFileOutlinedIcon}
                    title="1. Envie seu currículo"
                    subtitle="Extraímos skills, senioridade e idiomas (o mesmo sinal que o ATS usa)."
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(f);
                    }}
                  />
                  <DropZone
                    uploading={uploading}
                    profile={profile}
                    isDark={props.isDark}
                    onPick={() => fileRef.current?.click()}
                  />
                  {profile && (
                    <Box sx={{ mt: 2 }}>
                      <Typography
                        sx={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'text.secondary',
                          mb: 1,
                        }}
                      >
                        Perfil extraído
                      </Typography>
                      <SkillChips profile={profile} isDark={props.isDark} />
                    </Box>
                  )}
                </CardContent>
              </Card>

              <Card
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  border: profile
                    ? `1px solid ${alpha(theme.palette.primary.main, 0.4)}`
                    : undefined,
                  background: profile
                    ? props.isDark
                      ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.14)} 0%, transparent 80%)`
                      : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, #FFFFFF 80%)`
                    : undefined,
                  '&::before': profile
                    ? {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #1A2E4A, #3D7EBF, #34D399)',
                      }
                    : undefined,
                }}
              >
                <CardContent>
                  <SectionHeader
                    icon={AnalyticsOutlinedIcon}
                    title="2. Rodar análise para esta vaga"
                    subtitle="Regras determinísticas, sem inventar skills no texto."
                  />
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={!profile}
                    onClick={() => void handleAnalyze()}
                    startIcon={<AnalyticsOutlinedIcon />}
                    sx={{
                      py: 1.5,
                      fontWeight: 700,
                      fontSize: '0.96rem',
                      letterSpacing: '-0.005em',
                      background: 'linear-gradient(135deg, #1A2E4A 0%, #3D7EBF 100%)',
                      boxShadow:
                        '0 12px 28px rgba(26,46,74,0.32), inset 0 1px 0 rgba(255,255,255,0.12)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #243F65 0%, #4A8FD0 100%)',
                        boxShadow:
                          '0 14px 36px rgba(26,46,74,0.42), inset 0 1px 0 rgba(255,255,255,0.18)',
                        transform: 'translateY(-1px)',
                      },
                      '&.Mui-disabled': {
                        background: alpha(theme.palette.primary.main, 0.25),
                        color: 'rgba(255,255,255,0.85)',
                      },
                      transition: 'all 0.22s ease',
                    }}
                  >
                    Gerar score e recomendação
                  </Button>
                  {!profile && (
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        color: 'text.secondary',
                        textAlign: 'center',
                        mt: 1.25,
                      }}
                    >
                      Envie um CV acima para habilitar a análise
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Stack>
          )}

          {phase === 'analyzing' && <AnalyzingSkeleton isDark={props.isDark} />}

          {phase === 'result' && analysis && (
            <Stack spacing={2.5}>
              {/* Hero score card */}
              <Box
                sx={{
                  position: 'relative',
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: props.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.08)',
                  background: props.isDark
                    ? 'linear-gradient(160deg, #0D1B2E 0%, #15294A 50%, #0F1F2E 100%)'
                    : 'linear-gradient(160deg, #FFFFFF 0%, #F8FAFC 100%)',
                  boxShadow: props.isDark
                    ? '0 20px 50px rgba(0,0,0,0.45)'
                    : '0 20px 50px rgba(15,31,46,0.10)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #1A2E4A, #3D7EBF, #34D399)',
                  },
                  ...(props.isDark
                    ? {
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          backgroundImage:
                            'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
                          backgroundSize: '22px 22px',
                          pointerEvents: 'none',
                        },
                      }
                    : {}),
                }}
              >
                <Box sx={{ position: 'relative', zIndex: 1, p: { xs: 2.5, sm: 3.5 } }}>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap' }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: props.isDark ? 'rgba(255,255,255,0.55)' : 'text.secondary',
                      }}
                    >
                      Resultado da análise
                    </Typography>
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: props.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,31,46,0.25)',
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: props.isDark ? 'rgba(255,255,255,0.5)' : 'text.secondary',
                        fontFamily: 'monospace',
                      }}
                    >
                      Regras {analysis.rulesVersion}
                    </Typography>
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={{ xs: 3, md: 4 }}
                    sx={{ alignItems: { xs: 'center', md: 'center' } }}
                  >
                    <Box sx={{ flexShrink: 0 }}>
                      <ScoreGauge score={analysis.score} size={172} />
                    </Box>
                    <Box sx={{ flex: 1, width: '100%', minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: { xs: '1.3rem', sm: '1.55rem' },
                          letterSpacing: '-0.028em',
                          lineHeight: 1.18,
                          color: props.isDark ? '#FFFFFF' : 'text.primary',
                          mb: 0.75,
                          textAlign: { xs: 'center', md: 'left' },
                        }}
                      >
                        Como o ATS lê o seu CV para esta vaga
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.85rem',
                          color: props.isDark ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                          lineHeight: 1.55,
                          textAlign: { xs: 'center', md: 'left' },
                          mb: 1.75,
                        }}
                      >
                        Nota composta de skills, senioridade, experiência, idioma e região. Use o
                        detalhamento abaixo para priorizar ajustes no CV.
                      </Typography>
                      {verdict && (
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: { xs: 'center', md: 'flex-start' },
                          }}
                        >
                          <ApplyVerdictPill verdict={verdict} />
                        </Box>
                      )}
                    </Box>
                  </Stack>

                  <Box
                    sx={{
                      mt: 3,
                      pt: 3,
                      borderTop: '1px solid',
                      borderColor: props.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.06)',
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: props.isDark ? 'rgba(255,255,255,0.55)' : 'text.secondary',
                        mb: 1.75,
                      }}
                    >
                      Detalhamento por critério
                    </Typography>
                    <Box
                      sx={{
                        '& .MuiTypography-body2': {
                          color: props.isDark ? '#F1F5F9' : 'text.primary',
                        },
                        '& .MuiTypography-caption': {
                          color: props.isDark ? 'rgba(255,255,255,0.65)' : 'text.secondary',
                        },
                      }}
                    >
                      <ScoreBreakdownView matchers={analysis.scoreBreakdown.matchers} />
                    </Box>
                  </Box>
                </Box>
              </Box>

              {verdict && verdictReason && (
                <ApplyVerdictBanner verdict={verdict} reason={verdictReason} />
              )}

              {analysis.summary && (
                <Card sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{
                      height: 3,
                      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.4)})`,
                    }}
                  />
                  <CardContent>
                    <SectionHeader icon={DescriptionOutlinedIcon} title="Por que esse score" />
                    <InlineMarkdown
                      sx={{
                        display: 'block',
                        fontSize: '0.88rem',
                        lineHeight: 1.7,
                        color: 'text.secondary',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {analysis.summary}
                    </InlineMarkdown>
                  </CardContent>
                </Card>
              )}

              {analysis.gaps && analysis.gaps.length > 0 && (
                <Card sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{
                      height: 3,
                      background: `linear-gradient(90deg, ${theme.palette.warning.main}, ${alpha(theme.palette.warning.main, 0.4)})`,
                    }}
                  />
                  <CardContent>
                    <SectionHeader
                      icon={AnalyticsOutlinedIcon}
                      title="Gaps em relação à vaga"
                      subtitle="Pontos onde o seu CV ainda não dá evidência clara."
                      count={analysis.gaps.length}
                      accent={theme.palette.warning.main}
                    />
                    <Stack spacing={1.25}>
                      {analysis.gaps.map((g) => (
                        <Box
                          key={g}
                          sx={{
                            display: 'flex',
                            gap: 1.25,
                            p: 1.25,
                            borderRadius: 1.5,
                            bgcolor: props.isDark
                              ? alpha(theme.palette.warning.main, 0.1)
                              : alpha(theme.palette.warning.main, 0.06),
                            border: '1px solid',
                            borderColor: alpha(theme.palette.warning.main, 0.22),
                          }}
                        >
                          <Box
                            sx={{
                              flexShrink: 0,
                              width: 4,
                              borderRadius: 99,
                              alignSelf: 'stretch',
                              background: `linear-gradient(180deg, ${theme.palette.warning.main}, ${alpha(theme.palette.warning.main, 0.5)})`,
                            }}
                          />
                          <InlineMarkdown
                            sx={{
                              display: 'block',
                              fontSize: '0.85rem',
                              lineHeight: 1.55,
                              color: 'text.primary',
                              flex: 1,
                              pt: 0.15,
                            }}
                          >
                            {g}
                          </InlineMarkdown>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {analysis.improvementSuggestions && analysis.improvementSuggestions.length > 0 && (
                <Card sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{
                      height: 3,
                      background: `linear-gradient(90deg, ${theme.palette.success.main}, ${alpha(theme.palette.success.main, 0.4)})`,
                    }}
                  />
                  <CardContent>
                    <SectionHeader
                      icon={TipsAndUpdatesOutlinedIcon}
                      title="Passo a passo no CV"
                      subtitle="Aplique na ordem para reduzir risco de descarte automático."
                      count={analysis.improvementSuggestions.length}
                      accent={theme.palette.success.main}
                    />
                    <Stack spacing={1.25}>
                      {analysis.improvementSuggestions.map((s, i) => (
                        <Box
                          key={s}
                          sx={{
                            position: 'relative',
                            display: 'flex',
                            gap: 1.5,
                            p: 1.5,
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: props.isDark ? 'rgba(15,23,42,0.4)' : '#FAFBFC',
                            transition: 'all 0.22s ease',
                            '&:hover': {
                              borderColor: alpha(theme.palette.primary.main, 0.35),
                              transform: 'translateX(2px)',
                              boxShadow: props.isDark
                                ? '0 6px 18px rgba(0,0,0,0.3)'
                                : '0 6px 18px rgba(15,31,46,0.06)',
                            },
                          }}
                        >
                          <Box
                            sx={{
                              minWidth: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #1A2E4A, #3D7EBF)',
                              color: '#FFFFFF',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 12px rgba(26,46,74,0.3)',
                              flexShrink: 0,
                            }}
                          >
                            {i + 1}
                          </Box>
                          <InlineMarkdown
                            sx={{
                              display: 'block',
                              fontSize: '0.88rem',
                              lineHeight: 1.6,
                              color: 'text.primary',
                              flex: 1,
                              pt: 0.35,
                            }}
                          >
                            {stripLeadingSuggestionNumber(s)}
                          </InlineMarkdown>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                sx={{ justifyContent: 'space-between', alignItems: 'center', pt: 1 }}
              >
                <Typography
                  sx={{
                    fontSize: '0.74rem',
                    color: 'text.secondary',
                    textAlign: { xs: 'center', sm: 'left' },
                  }}
                >
                  Análise gerada em tempo real. Você pode trocar o CV e refazer quando quiser.
                </Typography>
                <Stack direction="row" spacing={1.25}>
                  <Button
                    variant="outlined"
                    size="medium"
                    startIcon={<RestartAltRoundedIcon />}
                    onClick={() => {
                      setAnalysis(null);
                      setPhase('cv');
                    }}
                    sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                  >
                    Refazer
                  </Button>
                  <Button
                    variant="contained"
                    size="medium"
                    onClick={handleClose}
                    sx={{
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      background: 'linear-gradient(135deg, #1A2E4A, #3D7EBF)',
                      boxShadow: '0 8px 22px rgba(26,46,74,0.32)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #243F65, #4A8FD0)',
                        boxShadow: '0 10px 28px rgba(26,46,74,0.42)',
                      },
                    }}
                  >
                    Fechar
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          )}

          {phase === 'error' && !error && (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              Algo deu errado. Feche e tente novamente.
            </Typography>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
