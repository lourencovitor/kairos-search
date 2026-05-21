/**
 * Remove rótulos técnicos parentetizados que o backend pode anexar aos textos
 * de gaps e sugestões. Mantém o conteúdo legível para o usuário final.
 *
 * Cobre, entre outros:
 *   "Falta Python (missingRequired)"            -> "Falta Python"
 *   "Sem inglês fluente (proficiencyGaps)"      -> "Sem inglês fluente"
 *   "Senioridade abaixo (seniority distance: 2)" -> "Senioridade abaixo"
 *   "Experiência: 2 anos (exp gap: -3)"         -> "Experiência: 2 anos"
 */
export function cleanAnalysisText(text: string): string {
  return (
    text
      // (camelCaseIdentifier) — ex.: (missingRequired), (proficiencyGaps), (matchedEvidence)
      .replace(/\s*\([a-z]+[A-Z][a-zA-Z]*\)/g, '')
      // (palavra(s) distance|gap|delta: N) — ex.: (seniority distance: 2), (exp gap: -3)
      .replace(/\s*\([a-zA-Z]+(?:\s+[a-zA-Z]+)*\s*:\s*-?\d+(?:[.,]\d+)?\)/g, '')
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}
