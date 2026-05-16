import type { JobResearchConfig } from '../config/job-research.config.js';
import type { RawJobPosting, JobSourceName, JobSourceSummary } from '../domain/job.types.js';

export interface JobSourceFetchResult {
  jobs: RawJobPosting[];
  summaries: JobSourceSummary[];
}

export interface JobSource {
  readonly name: JobSourceName;
  fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult>;
}
