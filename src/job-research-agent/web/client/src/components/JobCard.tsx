import { memo } from 'react';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, Card, CardContent, Link, Stack, Tooltip, Typography } from '@mui/material';

import type { JobOpportunity } from '../api/types.js';
import { ATS_ANALYSIS_ENABLED } from '../ats/featureFlags.js';
import { scoreColors, scoreRangeLabel } from '../utils/color-theme.js';
import {
  formatSalary,
  marketLabel,
  relativeDate,
  remotePolicyLabel,
} from '../utils/format-helpers.js';
import { GROUP_COLORS, GROUP_DARK, GROUP_LABELS, reportGroup } from '../utils/report-group.js';
import { CompanyAvatar } from './CompanyAvatar.js';
import { GroupTag } from './GroupTag.js';
import { JobAttributeBadge } from './JobAttributeBadge.js';
import { ScoreBadge } from './ScoreBadge.js';

interface JobCardProps {
  job: JobOpportunity;
  isDark: boolean;
  readonly onAnalyze?: (job: JobOpportunity) => void;
}

export const JobCard = memo(function JobCard({ job, isDark, onAnalyze }: JobCardProps) {
  const grp = reportGroup(job);
  const c = GROUP_COLORS[grp];
  const src = job.sourceBoard ?? job.source;

  const tagBg = isDark ? '#1E293B' : '#F1F5F9';
  const tagBorder = isDark ? '#334155' : '#E2E8F0';
  const tagText = isDark ? '#94A3B8' : '#475569';

  const salaryBg = isDark ? 'rgba(5,150,105,0.18)' : '#D1FAE5';
  const salaryBorder = isDark ? 'rgba(5,150,105,0.4)' : '#A7F3D0';
  const salaryText = isDark ? '#34D399' : '#065F46';

  const metaParts = [
    job.locationText,
    remotePolicyLabel(job.remotePolicy),
    marketLabel(job.jobMarket),
  ]
    .filter(Boolean)
    .join(' · ');

  const rightMeta = [src, job.publishedAt ? relativeDate(job.publishedAt) : undefined]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card
      sx={{
        borderLeft: `4px solid ${c.accent}`,
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': {
          bgcolor: isDark ? `${c.accent}0D` : `${c.accent}07`,
          boxShadow: `0 14px 40px rgba(15,31,46,${isDark ? '0.4' : '0.13'}), 0 3px 10px rgba(15,31,46,${isDark ? '0.3' : '0.07'})`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} sx={{ alignItems: 'flex-start' }}>
          <Stack sx={{ alignItems: 'center', gap: 0.6, flexShrink: 0, width: 44 }}>
            <CompanyAvatar name={job.companyName} highlight={job.score >= 80} />
            <JobAttributeBadge
              remotePolicy={job.remotePolicy}
              jobMarket={job.jobMarket}
              isDark={isDark}
            />
          </Stack>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Link
              href={job.url}
              target="_blank"
              rel="noreferrer"
              underline="none"
              sx={{ display: 'block', mb: 0.4 }}
            >
              <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '0.93rem', sm: '1rem' },
                    lineHeight: 1.3,
                    letterSpacing: '-0.015em',
                    color: 'text.primary',
                    transition: 'color 0.15s',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  {job.title}
                </Typography>
                <OpenInNewIcon
                  sx={{
                    fontSize: 11,
                    color: 'text.secondary',
                    flexShrink: 0,
                    opacity: 0.5,
                    display: { xs: 'none', sm: 'block' },
                  }}
                />
              </Stack>
            </Link>

            <Typography sx={{ fontSize: { xs: '0.78rem', sm: '0.84rem' }, mb: 1, lineHeight: 1.4 }}>
              <Box component="span" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                {job.companyName}
              </Box>
              {metaParts && (
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  {' · '}
                  {metaParts}
                </Box>
              )}
            </Typography>

            <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <GroupTag
                bg={isDark ? GROUP_DARK[grp].bg : c.bg}
                color={isDark ? GROUP_DARK[grp].text : c.text}
              >
                {GROUP_LABELS[grp]}
              </GroupTag>
              {(job.stackSignals ?? []).slice(0, 6).map((s) => (
                <Box
                  key={s}
                  sx={{
                    px: '7px',
                    py: '2px',
                    borderRadius: '4px',
                    bgcolor: tagBg,
                    border: `1px solid ${tagBorder}`,
                    fontSize: '0.63rem',
                    fontWeight: 500,
                    color: tagText,
                    lineHeight: '17px',
                    fontFamily: '"SF Mono","Cascadia Code","Fira Code",monospace',
                  }}
                >
                  {s}
                </Box>
              ))}
            </Stack>

            {(job.salaryText || rightMeta) && (
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  mt: 0.9,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  display: { xs: 'flex', sm: 'none' },
                }}
              >
                {job.salaryText && (
                  <Box
                    sx={{
                      px: '7px',
                      py: '2px',
                      borderRadius: '4px',
                      bgcolor: salaryBg,
                      border: `1px solid ${salaryBorder}`,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        color: salaryText,
                        lineHeight: 1.4,
                      }}
                    >
                      {formatSalary(job.salaryText)}
                    </Typography>
                  </Box>
                )}
                <Typography sx={{ fontSize: '0.61rem', color: 'text.secondary', opacity: 0.7 }}>
                  {rightMeta}
                </Typography>
              </Stack>
            )}
          </Box>

          <Stack sx={{ alignItems: 'flex-end', gap: 0.75, flexShrink: 0 }}>
            <Tooltip
              arrow
              placement="left"
              title={
                <Box sx={{ p: 0.25 }}>
                  <Typography
                    sx={{ fontWeight: 700, fontSize: '0.76rem', display: 'block', mb: 0.5 }}
                  >
                    Score de aderência · {job.score}/100
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.71rem',
                      color: scoreColors(job.score).stroke,
                      fontWeight: 600,
                      display: 'block',
                      mb: 0.5,
                    }}
                  >
                    ● {scoreRangeLabel(job.score)}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.67rem',
                      color: 'rgba(255,255,255,0.65)',
                      lineHeight: 1.6,
                      display: 'block',
                    }}
                  >
                    Calculado com base em stack técnica, nível de senioridade, mercado e política de
                    trabalho.
                  </Typography>
                </Box>
              }
            >
              <Box sx={{ cursor: 'help' }}>
                <ScoreBadge score={job.score} />
              </Box>
            </Tooltip>
            {job.salaryText && (
              <Box
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  px: '9px',
                  py: '3px',
                  borderRadius: '5px',
                  bgcolor: salaryBg,
                  border: `1px solid ${salaryBorder}`,
                  maxWidth: 130,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.67rem',
                    fontWeight: 700,
                    color: salaryText,
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {formatSalary(job.salaryText)}
                </Typography>
              </Box>
            )}
            <Typography
              variant="caption"
              sx={{
                display: { xs: 'none', sm: 'block' },
                color: 'text.secondary',
                fontSize: '0.63rem',
                whiteSpace: 'nowrap',
                opacity: 0.75,
              }}
            >
              {rightMeta}
            </Typography>
            {ATS_ANALYSIS_ENABLED && onAnalyze && (
              <Tooltip
                arrow
                placement="left"
                title={
                  <Box sx={{ p: 0.25, maxWidth: 220 }}>
                    <Typography
                      sx={{ fontWeight: 700, fontSize: '0.74rem', display: 'block', mb: 0.5 }}
                    >
                      Análise ATS desta vaga
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.67rem',
                        color: 'rgba(255,255,255,0.7)',
                        lineHeight: 1.55,
                        display: 'block',
                      }}
                    >
                      Score 0–100, breakdown por skill, gaps e plano de ação para seu CV.
                    </Typography>
                  </Box>
                }
              >
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AnalyticsOutlinedIcon sx={{ fontSize: 14 }} />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAnalyze(job);
                  }}
                  sx={{
                    mt: 0.6,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '-0.005em',
                    py: 0.55,
                    px: 1.3,
                    minWidth: 0,
                    color: '#FFFFFF',
                    background: 'linear-gradient(135deg, #1A2E4A 0%, #3D7EBF 100%)',
                    boxShadow: isDark
                      ? '0 4px 14px rgba(61,126,191,0.35), 0 0 0 1px rgba(127,181,232,0.15) inset'
                      : '0 4px 14px rgba(26,46,74,0.28), 0 0 0 1px rgba(255,255,255,0.12) inset',
                    border: 'none',
                    transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #243F65 0%, #4A8FD0 100%)',
                      boxShadow: isDark
                        ? '0 6px 20px rgba(61,126,191,0.5), 0 0 0 1px rgba(127,181,232,0.25) inset'
                        : '0 6px 20px rgba(26,46,74,0.38), 0 0 0 1px rgba(255,255,255,0.18) inset',
                      transform: 'translateY(-1px)',
                    },
                    '& .MuiButton-startIcon': { mr: 0.6 },
                  }}
                >
                  Analisar CV
                </Button>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
});
