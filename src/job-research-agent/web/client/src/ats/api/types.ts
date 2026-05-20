export interface CandidateProfile {
  readonly skills: readonly { readonly name: string }[];
  readonly seniorityHint: string;
  readonly yearsTotalExperience: number;
  readonly languages: readonly { readonly name: string; readonly proficiency: string }[];
  readonly location: {
    readonly country?: string | null;
    readonly isBrazilResident?: boolean | null;
  };
}

export interface MatcherBreakdown {
  readonly name: string;
  readonly weight: number;
  readonly score01: number;
  readonly contribution: number;
  readonly details: Record<string, unknown>;
}

export type ApplyVerdict = 'apply' | 'apply_with_risk' | 'caution' | 'do_not_apply';

export interface AnalysisDto {
  readonly id: string;
  readonly status: 'pending' | 'running' | 'done' | 'failed';
  readonly score: number;
  readonly rulesVersion: string;
  readonly scoreBreakdown: {
    readonly rulesVersion: string;
    readonly matchers: readonly MatcherBreakdown[];
    readonly rawTotal: number;
    readonly clipped: boolean;
    readonly applyVerdict?: ApplyVerdict;
    readonly applyVerdictLabel?: string;
    readonly applyVerdictReason?: string;
  };
  readonly summary: string | null;
  readonly gaps: readonly string[] | null;
  readonly improvementSuggestions: readonly string[] | null;
  readonly error: string | null;
}

export interface AtsJobDto {
  readonly id: string;
  readonly title: string;
  readonly companyName: string;
}
