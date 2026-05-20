export type ReportGroup =
  | 'junior'
  | 'pleno'
  | 'senior'
  | 'staff'
  | 'arq'
  | 'qa'
  | 'devops'
  | 'management'
  | 'other';

export interface JobOpportunity {
  id: string;
  sourceId?: string;
  companyName: string;
  title: string;
  url: string;
  source: string;
  sourceBoard?: string;
  locationText: string;
  jobMarket: string;
  seniority: string;
  roleCategory: string;
  remotePolicy: string;
  stackSignals: string[];
  score: number;
  salaryText?: string;
  publishedAt?: string;
}

export interface LatestPayload {
  summary: {
    runId?: string;
    totalRawJobs?: number;
    rankedJobs?: number;
    selectedJobs?: number;
  } | null;
  jobs: JobOpportunity[];
  downloads: Array<{ name: string; label: string; size: number }>;
}

export const INITIAL_PAYLOAD: LatestPayload = { summary: null, jobs: [], downloads: [] };
