export interface JobScoreBreakdown {
  titleMatch: number;
  seniorityFit: number;
  marketFit: number;
  locationBoost: number;
  stackMatch: number;
  preferredPlatformBoost: number;
  sourceQuality: number;
  recency: number;
  compensation: number;
  restrictionsPenalty: number;
  clarityPenalty: number;
  stackPenalty: number;
  total: number;
}
