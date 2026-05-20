/**
 * Feature flags do cliente (Vite expõe VITE_* no bundle).
 *
 * Convenção: ativo em dev (import.meta.env.DEV); em produção,
 * só ativa se VITE_FEATURE_* estiver definido como "true".
 */

function isFlagOn(value: string | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === 'true';
}

export const ATS_ANALYSIS_ENABLED: boolean =
  import.meta.env.DEV || isFlagOn(import.meta.env.VITE_FEATURE_ATS_ANALYSIS as string | undefined);
