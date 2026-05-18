export const AVATAR_PALETTE = [
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
  { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A' },
  { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
];

export function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}

export function scoreColors(score: number): {
  bg: string;
  text: string;
  stroke: string;
  track: string;
} {
  if (score >= 75) return { bg: '#D1FAE5', text: '#065F46', stroke: '#10B981', track: '#10B98122' };
  if (score >= 55) return { bg: '#DBEAFE', text: '#1E3A5F', stroke: '#3B82F6', track: '#3B82F622' };
  if (score >= 35) return { bg: '#FEF3C7', text: '#92400E', stroke: '#F59E0B', track: '#F59E0B22' };
  return { bg: '#F1F5F9', text: '#475569', stroke: '#94A3B8', track: '#94A3B822' };
}

export function scoreRangeLabel(score: number): string {
  if (score >= 75) return 'Alta aderência';
  if (score >= 55) return 'Boa aderência';
  if (score >= 35) return 'Aderência média';
  return 'Aderência baixa';
}
