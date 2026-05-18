export function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function marketLabel(market: string): string {
  const m: Record<string, string> = {
    brazil: 'Brasil',
    brazil_friendly: 'Favorável ao Brasil',
    latam: 'LATAM',
    international: 'Internacional',
    unclear: 'Indefinido',
  };
  return m[market] ?? market;
}

export function remotePolicyLabel(policy: string): string {
  const m: Record<string, string> = {
    remote: 'Remoto',
    hybrid: 'Híbrido',
    onsite: 'Presencial',
    unknown: 'Não definido',
  };
  return m[policy] ?? policy;
}

export function formatSalary(text: string): string {
  return text
    .replace(/\bUSD\s*/gi, '$ ')
    .replace(/\bBRL\s*/gi, 'R$ ')
    .replace(/\bEUR\s*/gi, '€ ')
    .replace(/\bGBP\s*/gi, '£ ')
    .replace(/\b(\d{5,})\b/g, (_, n) => {
      const v = parseInt(n, 10);
      return v >= 1000 ? `${Math.round(v / 1000)}K` : n;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function relativeDate(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 7) return `${d}d`;
  if (d < 14) return '1 sem';
  if (d < 30) return `${Math.floor(d / 7)} sem`;
  if (d < 60) return '1 mês';
  return `${Math.floor(d / 30)} meses`;
}
