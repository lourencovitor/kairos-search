import TuneIcon from '@mui/icons-material/Tune';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';

import type { ReportGroup } from '../api/types.js';
import { GROUP_COLORS, GROUP_DARK, GROUP_LABELS, GROUP_ORDER } from '../utils/report-group.js';

interface GroupDistributionProps {
  totalJobs: number;
  groupCounts: Map<ReportGroup, number>;
  filteredCount: number;
  group: string;
  onGroupChange: (g: string) => void;
  isDark: boolean;
  filtersOpen: boolean;
  onFiltersToggle: () => void;
  activeFilterCount: number;
}

export function GroupDistribution({
  totalJobs,
  groupCounts,
  filteredCount,
  group,
  onGroupChange,
  isDark,
  filtersOpen,
  onFiltersToggle,
  activeFilterCount,
}: GroupDistributionProps) {
  return (
    <Box>
      {totalJobs > 0 && (
        <Box
          sx={{
            display: 'flex',
            height: 6,
            borderRadius: 999,
            overflow: 'hidden',
            gap: '2px',
            mb: 1.75,
          }}
        >
          {GROUP_ORDER.filter((g) => (groupCounts.get(g) ?? 0) > 0).map((g) => {
            const count = groupCounts.get(g) ?? 0;
            const pct = (count / totalJobs) * 100;
            const isActive = group === g;
            return (
              <Tooltip key={g} title={`${GROUP_LABELS[g]} · ${count} vagas`} placement="top" arrow>
                <Box
                  onClick={() => onGroupChange(group === g ? '' : g)}
                  sx={{
                    height: '100%',
                    width: `${pct}%`,
                    minWidth: 6,
                    bgcolor: GROUP_COLORS[g].accent,
                    borderRadius: '2px',
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
          const count = groupCounts.get(g) ?? 0;
          const c = GROUP_COLORS[g];
          const active = group === g;
          return (
            <Box
              key={g}
              onClick={() => onGroupChange(group === g ? '' : g)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.1,
                py: 0.45,
                borderRadius: '6px',
                cursor: 'pointer',
                userSelect: 'none',
                bgcolor: active ? c.accent : isDark ? GROUP_DARK[g].bg : c.bg,
                border: `1px solid ${active ? c.accent : 'transparent'}`,
                transition: 'all 0.15s ease',
                '&:hover': { bgcolor: c.accent, '& *': { color: '#fff !important' } },
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: active ? '#fff' : isDark ? GROUP_DARK[g].text : c.text,
                  lineHeight: 1,
                }}
              >
                {GROUP_LABELS[g]}
              </Typography>
              <Box
                sx={{
                  px: 0.55,
                  py: '1px',
                  borderRadius: '3px',
                  bgcolor: active ? 'rgba(255,255,255,0.2)' : `${c.accent}1A`,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    color: active ? '#fff' : c.accent,
                    lineHeight: 1.3,
                  }}
                >
                  {count}
                </Typography>
              </Box>
            </Box>
          );
        })}
        <Box sx={{ flexGrow: 1 }} />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, fontSize: '0.72rem' }}
        >
          {filteredCount} {filteredCount === 1 ? 'vaga' : 'vagas'}
        </Typography>
        <Tooltip title="Filtros">
          <IconButton
            size="small"
            onClick={onFiltersToggle}
            sx={{
              display: { lg: 'none' },
              color: filtersOpen || activeFilterCount > 0 ? 'primary.main' : 'text.secondary',
              position: 'relative',
            }}
          >
            <TuneIcon sx={{ fontSize: 18 }} />
            {activeFilterCount > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  border: '1.5px solid',
                  borderColor: 'background.paper',
                }}
              />
            )}
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
