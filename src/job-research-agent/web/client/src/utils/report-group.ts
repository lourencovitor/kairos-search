import type { JobOpportunity, ReportGroup } from '../api/types.js';

export const GROUP_ORDER: ReportGroup[] = [
  'junior',
  'pleno',
  'senior',
  'staff',
  'arq',
  'qa',
  'devops',
  'management',
];

export const GROUP_LABELS: Record<ReportGroup, string> = {
  junior: 'Junior',
  pleno: 'Pleno',
  senior: 'Senior',
  staff: 'Staff+',
  arq: 'Arquitetura',
  qa: 'QA',
  devops: 'DevOps',
  management: 'Management',
  other: 'Outros',
};

export const GROUP_COLORS: Record<ReportGroup, { bg: string; text: string; accent: string }> = {
  junior: { bg: '#FEF3C7', text: '#92400E', accent: '#F59E0B' },
  pleno: { bg: '#DBEAFE', text: '#1E40AF', accent: '#3B82F6' },
  senior: { bg: '#EDE9FE', text: '#3730A3', accent: '#6366F1' },
  staff: { bg: '#F3E8FF', text: '#6B21A8', accent: '#8B5CF6' },
  arq: { bg: '#CCFBF1', text: '#0F766E', accent: '#14B8A6' },
  qa: { bg: '#DCFCE7', text: '#14532D', accent: '#22C55E' },
  devops: { bg: '#E0F2FE', text: '#075985', accent: '#0EA5E9' },
  management: { bg: '#FEE2E2', text: '#991B1B', accent: '#EF4444' },
  other: { bg: '#F1F5F9', text: '#475569', accent: '#94A3B8' },
};

export const GROUP_DARK: Record<ReportGroup, { bg: string; text: string }> = {
  junior: { bg: 'rgba(245,158,11,0.14)', text: '#FCD34D' },
  pleno: { bg: 'rgba(59,130,246,0.14)', text: '#93C5FD' },
  senior: { bg: 'rgba(99,102,241,0.14)', text: '#A5B4FC' },
  staff: { bg: 'rgba(139,92,246,0.14)', text: '#C4B5FD' },
  arq: { bg: 'rgba(20,184,166,0.14)', text: '#5EEAD4' },
  qa: { bg: 'rgba(34,197,94,0.14)', text: '#86EFAC' },
  devops: { bg: 'rgba(14,165,233,0.14)', text: '#7DD3FC' },
  management: { bg: 'rgba(239,68,68,0.14)', text: '#FCA5A5' },
  other: { bg: 'rgba(148,163,184,0.14)', text: '#CBD5E1' },
};

export function reportGroup(job: Pick<JobOpportunity, 'roleCategory' | 'seniority'>): ReportGroup {
  if (job.roleCategory === 'devops') return 'devops';
  if (
    ['software_architecture', 'solutions_architecture', 'cloud_architecture'].includes(
      job.roleCategory,
    ) ||
    job.seniority === 'architect'
  )
    return 'arq';
  if (job.roleCategory === 'qa') return 'qa';
  if (job.roleCategory === 'management') return 'management';
  if (job.seniority === 'junior') return 'junior';
  if (job.seniority === 'mid_level') return 'pleno';
  if (['senior', 'lead'].includes(job.seniority)) return 'senior';
  if (['staff', 'principal', 'staff_or_principal'].includes(job.seniority)) return 'staff';
  return 'other';
}
