import { useEffect, useState } from 'react';

import BusinessIcon from '@mui/icons-material/Business';
import CloseIcon from '@mui/icons-material/Close';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import {
  Box,
  Button,
  Collapse,
  Divider,
  InputAdornment,
  Slider,
  Stack,
  type SvgIconTypeMap,
  TextField,
  Typography,
} from '@mui/material';
import { type OverridableComponent } from '@mui/material/OverridableComponent';

import { remotePolicyLabel } from '../utils/format-helpers.js';

type MuiIcon = OverridableComponent<SvgIconTypeMap<object, 'svg'>> & { muiName: string };

const REMOTE_POLICIES = ['remote', 'hybrid', 'onsite'] as const;
const POLICY_CONFIG: Record<string, { Icon: MuiIcon; fill: string }> = {
  remote: { Icon: HomeIcon, fill: '#16A34A' },
  hybrid: { Icon: SyncAltIcon, fill: '#D97706' },
  onsite: { Icon: BusinessIcon, fill: '#475569' },
};

const MARKET_CONFIG: Record<string, { label: string; fill: string }> = {
  brazil: { label: 'Brasil', fill: '#16A34A' },
  latam: { label: 'LATAM', fill: '#7C3AED' },
  international: { label: 'Internacional', fill: '#0284C7' },
  unclear: { label: 'Indefinido', fill: '#64748B' },
};

// Only meaningful thresholds: 55+ (boa aderência) and 75+ (alta aderência)
const SCORE_PRESETS: Array<{ value: number; fill: string; label: string; hint: string }> = [
  { value: 55, fill: '#3B82F6', label: '55+', hint: 'Boa aderência' },
  { value: 75, fill: '#10B981', label: '75+', hint: 'Alta aderência' },
];

interface FiltersPanelProps {
  query: string;
  onQueryChange: (v: string) => void;
  markets: string[];
  marketFilter: string[];
  onMarketToggle: (m: string) => void;
  score: number;
  onScoreChange: (v: number) => void;
  remotePolicies: string[];
  onRemotePolicyToggle: (p: string) => void;
  isDark: boolean;
  onClearAll: () => void;
}

function SectionLabel({
  children,
  active,
  right,
}: {
  children: React.ReactNode;
  active?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', mb: 1, minWidth: 0 }}>
      <Typography
        noWrap
        sx={{
          fontSize: '0.58rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: active ? 'primary.main' : 'text.disabled',
          transition: 'color 0.15s',
          flexShrink: 1,
          minWidth: 0,
        }}
      >
        {children}
      </Typography>
      {active && (
        <Box
          sx={{
            ml: 0.75,
            width: 5,
            height: 5,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            flexShrink: 0,
          }}
        />
      )}
      {right && <Box sx={{ ml: 'auto', pl: 1, flexShrink: 0 }}>{right}</Box>}
    </Stack>
  );
}

export function FiltersPanel({
  query,
  onQueryChange,
  markets,
  marketFilter,
  onMarketToggle,
  score,
  onScoreChange,
  remotePolicies,
  onRemotePolicyToggle,
  isDark,
  onClearAll,
}: FiltersPanelProps) {
  const [localQuery, setLocalQuery] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => onQueryChange(localQuery), 200);
    return () => clearTimeout(t);
  }, [localQuery, onQueryChange]);

  useEffect(() => {
    if (query === '') setLocalQuery('');
  }, [query]);

  const hasActive =
    !!localQuery || marketFilter.length > 0 || score > 0 || remotePolicies.length > 0;

  const colorChipSx = (active: boolean, fill: string, anyActive: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    px: 1.1,
    py: 0.5,
    borderRadius: '7px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    fontSize: '0.72rem',
    fontWeight: active ? 700 : 500,
    lineHeight: 1,
    bgcolor: active ? fill : 'transparent',
    color: active ? '#fff' : fill,
    border: '1.5px solid',
    borderColor: active ? fill : `${fill}55`,
    transition: 'background 0.15s ease, opacity 0.15s ease, color 0.15s ease',
    opacity: !active && anyActive ? 0.4 : 1,
    '&:hover': { bgcolor: active ? fill : `${fill}22`, opacity: 1 },
  });

  const sectionSx = { py: 1.75 };

  return (
    <Stack divider={<Divider />} spacing={0}>
      {/* Buscar */}
      <Box sx={sectionSx}>
        <SectionLabel active={!!localQuery}>Buscar</SectionLabel>
        <TextField
          fullWidth
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Stack, empresa, cidade..."
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    sx={{ fontSize: 14, color: localQuery ? 'primary.main' : 'text.disabled' }}
                  />
                </InputAdornment>
              ),
              endAdornment: localQuery ? (
                <InputAdornment position="end">
                  <CloseIcon
                    sx={{
                      fontSize: 14,
                      color: 'text.disabled',
                      cursor: 'pointer',
                      '&:hover': { color: 'text.primary' },
                    }}
                    onClick={() => setLocalQuery('')}
                  />
                </InputAdornment>
              ) : undefined,
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              fontSize: '0.82rem',
              '& fieldset': { borderColor: localQuery ? 'primary.main' : 'divider' },
              '&:hover fieldset': { borderColor: 'primary.light' },
            },
          }}
        />
      </Box>

      {/* Mercado — chips multi-select */}
      <Box sx={sectionSx}>
        <SectionLabel active={marketFilter.length > 0}>Mercado</SectionLabel>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.6 }}>
          {markets
            .filter((m) => m in MARKET_CONFIG)
            .map((m) => {
              const { label, fill } = MARKET_CONFIG[m];
              const active = marketFilter.includes(m);
              return (
                <Box
                  key={m}
                  onClick={() => onMarketToggle(m)}
                  sx={colorChipSx(active, fill, marketFilter.length > 0)}
                >
                  {label}
                </Box>
              );
            })}
        </Stack>
      </Box>

      {/* Modalidade — segmented control */}
      <Box sx={sectionSx}>
        <SectionLabel active={remotePolicies.length > 0}>Modalidade</SectionLabel>
        <Box
          sx={{
            display: 'flex',
            borderRadius: '10px',
            p: '3px',
            gap: '2px',
            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: '1px solid',
            borderColor:
              remotePolicies.length > 0
                ? 'primary.main'
                : isDark
                  ? 'rgba(255,255,255,0.07)'
                  : 'divider',
            transition: 'border-color 0.15s',
          }}
        >
          {REMOTE_POLICIES.map((p) => {
            const { Icon, fill } = POLICY_CONFIG[p];
            const active = remotePolicies.includes(p);
            return (
              <Box
                key={p}
                onClick={() => onRemotePolicyToggle(p)}
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  px: { xs: 0.5, sm: 1 },
                  py: 0.85,
                  borderRadius: '7px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  minWidth: 0,
                  overflow: 'hidden',
                  bgcolor: active ? fill : 'transparent',
                  transition: 'background 0.15s ease, opacity 0.15s ease',
                  opacity: !active && remotePolicies.length > 0 ? 0.4 : 1,
                  '&:hover': { bgcolor: active ? fill : `${fill}22`, opacity: 1 },
                }}
              >
                <Icon
                  sx={{
                    fontSize: '0.85rem',
                    color: active ? '#fff' : fill,
                    transition: 'color 0.15s',
                    flexShrink: 0,
                  }}
                />
                <Typography
                  noWrap
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: active ? 700 : 500,
                    color: active ? '#fff' : fill,
                    lineHeight: 1,
                    transition: 'color 0.15s',
                    minWidth: 0,
                  }}
                >
                  {remotePolicyLabel(p)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Relevância — presets + slider */}
      <Box sx={sectionSx}>
        <SectionLabel
          active={score > 0}
          right={
            <Typography
              sx={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: score > 0 ? 'primary.main' : 'text.disabled',
                transition: 'color 0.15s',
              }}
            >
              {score > 0 ? `${score}+` : 'Todas'}
            </Typography>
          }
        >
          Relevância mínima
        </SectionLabel>

        {/* Quick presets */}
        <Stack direction="row" sx={{ gap: 0.6, mb: 1.5 }}>
          {SCORE_PRESETS.map(({ value, fill, label, hint }) => {
            const active = score === value;
            return (
              <Box
                key={value}
                onClick={() => onScoreChange(active ? 0 : value)}
                sx={{
                  ...colorChipSx(active, fill, score > 0 && !active),
                  flex: 1,
                  flexDirection: 'column',
                  gap: 0.3,
                  py: 0.7,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: active ? 800 : 600,
                    lineHeight: 1,
                    color: 'inherit',
                  }}
                >
                  {label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.58rem',
                    fontWeight: 500,
                    lineHeight: 1,
                    color: 'inherit',
                    opacity: 0.8,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hint}
                </Typography>
              </Box>
            );
          })}
        </Stack>

        <Slider
          value={score}
          onChange={(_, v) => onScoreChange(v as number)}
          min={0}
          max={100}
          size="small"
          sx={{
            mx: 0.5,
            width: 'calc(100% - 8px)',
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              '&:hover': { boxShadow: '0 0 0 6px rgba(26,46,74,0.16)' },
            },
          }}
        />
      </Box>

      {/* Limpar filtros */}
      <Collapse in={hasActive}>
        <Box sx={{ pt: 1.5, pb: 0.25 }}>
          <Button
            fullWidth
            size="small"
            onClick={onClearAll}
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'text.secondary',
              borderRadius: '8px',
              py: 0.7,
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'error.light',
                color: 'error.main',
                bgcolor: 'transparent',
              },
              transition: 'all 0.15s',
            }}
          >
            Limpar filtros
          </Button>
        </Box>
      </Collapse>
    </Stack>
  );
}
