import type { JobScoreBreakdown } from "./job-score.types.js";

export type JobSourceName =
  | "linkedin"
  | "programathor"
  | "greenhouse"
  | "lever"
  | "himalayas"
  | "getonboard"
  | "gupy"
  | "ashby"
  | "remotive"
  | "remoteok"
  | "manual"
  | "browser_mcp";

export type JobSourceType = "direct_company_board" | "aggregator" | "manual";

export type JobSourceFocus = "brazil" | "latam" | "global" | "mixed";

export type JobSourceTier =
  | "manual_curated"
  | "brazil_public_api"
  | "direct_company_board"
  | "global_aggregator";

export type ReportSelectionBucket = "primary" | "international_fallback";

export type RemotePolicy = "remote" | "hybrid" | "onsite" | "unknown";

export type RegionFit =
  | "worldwide"
  | "brazil_or_latam"
  | "partial_latam"
  | "unknown"
  | "incompatible";

export type JobMarket =
  | "brazil"
  | "brazil_friendly"
  | "latam"
  | "international"
  | "unclear";

export type BrazilLocationPriority =
  | "sao_paulo"
  | "rio_de_janeiro"
  | "major_city"
  | "none";

export type VisaSignal =
  | "supports"
  | "not_mentioned"
  | "not_supported"
  | "requires_work_authorization";

export type SeniorityLevel =
  | "architect"
  | "principal"
  | "staff"
  | "lead"
  | "staff_or_principal"
  | "senior"
  | "mid_level"
  | "junior"
  | "unknown";

export type RoleCategory =
  | "software_engineering"
  | "tech_lead"
  | "devops"
  | "software_architecture"
  | "solutions_architecture"
  | "cloud_architecture"
  | "qa"
  | "management";

// Novo agrupamento V2 de relatórios por senioridade/categoria: 8 grupos visíveis
// (junior, pleno, senior, staff, arq, qa, devops, management) + bucket interno "other" para
// casos não classificados que não são exportados como CSV.
export type SeniorityReportGroupV2 =
  | "junior"
  | "pleno"
  | "senior"
  | "staff"
  | "arq"
  | "qa"
  | "devops"
  | "management"
  | "other";

// Ordem canônica dos 8 grupos exportáveis (exclui "other" propositalmente).
export const SENIORITY_REPORT_GROUP_V2_ORDER: readonly SeniorityReportGroupV2[] = [
  "junior",
  "pleno",
  "senior",
  "staff",
  "arq",
  "qa",
  "devops",
  "management",
] as const;

export interface RawJobPosting {
  source: JobSourceName;
  sourceId: string;
  sourceBoard?: string;
  sourceType: JobSourceType;
  sourceFocus: JobSourceFocus;
  sourceTier: JobSourceTier;
  sourceQualityRank?: number;
  companyName: string;
  title: string;
  url: string;
  locationText: string;
  descriptionText: string;
  employmentType?: string;
  publishedAt?: string;
  updatedAt?: string;
  salaryText?: string;
  tags: string[];
  marketHint?: JobMarket;
  remotePolicyHint?: RemotePolicy;
  regionHints: string[];
  restrictionHints: string[];
  curationNotes: string[];
  metadata: Record<string, unknown>;
  raw: unknown;
}

export interface JobOpportunity {
  id: string;
  source: JobSourceName;
  sourceId: string;
  sourceBoard?: string;
  sourceType: JobSourceType;
  sourceFocus: JobSourceFocus;
  sourceTier: JobSourceTier;
  companyName: string;
  normalizedCompanyName: string;
  title: string;
  normalizedTitle: string;
  url: string;
  locationText: string;
  descriptionText: string;
  employmentType?: string;
  publishedAt?: string;
  updatedAt?: string;
  discoveredAt: string;
  salaryText?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  roleMatches: string[];
  remotePolicy: RemotePolicy;
  remoteConfidence: number;
  remoteRegions: string[];
  regionFit: RegionFit;
  jobMarket: JobMarket;
  brazilLocationPriority: BrazilLocationPriority;
  marketSignals: string[];
  visaSignal: VisaSignal;
  restrictionSignals: string[];
  seniority: SeniorityLevel;
  roleCategory: RoleCategory;
  stackSignals: string[];
  sourceQualityRank: number;
  reportBucket?: ReportSelectionBucket;
  isRelevant: boolean;
  rejectionReasons: string[];
  notes: string[];
  score: number;
  scoreBreakdown: JobScoreBreakdown;
  rawJob: RawJobPosting;
}

export interface JobSourceSummary {
  source: JobSourceName;
  label: string;
  focus: JobSourceFocus;
  tier: JobSourceTier;
  fetchedJobs: number;
  error?: string;
}

export interface JobResearchOutputPaths {
  runDirectory: string;
  latestDirectory: string;
  rawJobsPath: string;
  rankedJobsPath: string;
  rejectedJobsPath: string;
  filterFunnelPath: string;
  summaryPath: string;
  markdownReportPath: string;
  csvReportPath: string;
  csvReportBySeniorityPaths: {
    junior: string | null;
    pleno: string | null;
    senior: string | null;
    staff: string | null;
    arq: string | null;
    qa: string | null;
    devops: string | null;
    management?: string | null;
  };
  browserMcpTracePath: string | null;
}

export interface JobFilterFunnelSummary {
  rawJobs: number;
  rankedJobs: number;
  rejectedJobs: number;
  rejectedByReason: Record<string, number>;
  rejectedByReasonCombination: Record<string, number>;
  rankedBySource: Record<string, number>;
  rejectedBySource: Record<string, number>;
  rankedByReportGroup: Record<SeniorityReportGroupV2, number>;
  rejectedByReportGroup: Record<SeniorityReportGroupV2, number>;
}

export interface JobResearchRunResult {
  runId: string;
  generatedAt: string;
  totalRawJobs: number;
  sourceSummaries: JobSourceSummary[];
  selectionSummary: JobSelectionSummary;
  selectedJobs: JobOpportunity[];
  rankedJobs: JobOpportunity[];
  rejectedJobs: JobOpportunity[];
  output: JobResearchOutputPaths;
}

export interface JobSelectionSummary {
  limit: number;
  minScore: number;
  desiredPrimaryJobs: number;
  desiredInternationalJobs: number;
  usedThresholdFallback: boolean;
  selectedPrimaryJobs: number;
  selectedSecondaryJobs: number;
  selectedWorldwideCompatiblePrimaryJobs: number;
  filledFromSecondaryBecausePrimaryShortfall: number;
  marketCounts: Record<JobMarket, number>;
}
