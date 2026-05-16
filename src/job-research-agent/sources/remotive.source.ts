import type { JobResearchConfig } from '../config/job-research.config.js';
import type { RawJobPosting } from '../domain/job.types.js';
import { fetchJson } from '../shared/http.util.js';
import { stripHtmlTags, toIsoDate, uniqueStrings } from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

export class RemotiveSource implements JobSource {
  readonly name = 'remotive' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    if (!config.remotive.enabled) {
      return {
        jobs: [],
        summaries: [
          {
            source: this.name,
            label: 'Remotive',
            focus: 'global',
            tier: 'global_aggregator',
            fetchedJobs: 0,
          },
        ],
      };
    }

    try {
      const response = await fetchJson<RemotiveResponse>('https://remotive.com/api/remote-jobs', {
        headers: {
          'user-agent': config.userAgent,
        },
        timeoutMs: config.requestTimeoutMs,
      });

      const jobs = response.jobs.map<RawJobPosting>((job) => ({
        source: this.name,
        sourceId: String(job.id),
        sourceBoard: 'remotive',
        sourceType: 'aggregator',
        sourceFocus: 'global',
        sourceTier: 'global_aggregator',
        sourceQualityRank: 5,
        companyName: job.company_name,
        title: job.title,
        url: job.url,
        locationText: job.candidate_required_location ?? '',
        descriptionText: stripHtmlTags(job.description),
        employmentType: job.job_type,
        publishedAt: toIsoDate(job.publication_date),
        updatedAt: toIsoDate(job.publication_date),
        salaryText: job.salary,
        tags: uniqueStrings([job.category, ...(job.tags ?? [])]),
        remotePolicyHint: 'remote',
        regionHints: uniqueStrings([job.candidate_required_location]),
        restrictionHints: [],
        curationNotes: [],
        metadata: {
          category: job.category,
          remoteBySource: true,
        },
        raw: job,
      }));

      return {
        jobs,
        summaries: [
          {
            source: this.name,
            label: 'Remotive',
            focus: 'global',
            tier: 'global_aggregator',
            fetchedJobs: jobs.length,
          },
        ],
      };
    } catch (error) {
      return {
        jobs: [],
        summaries: [
          {
            source: this.name,
            label: 'Remotive',
            focus: 'global',
            tier: 'global_aggregator',
            fetchedJobs: 0,
            error: error instanceof Error ? error.message : 'Unknown Remotive error',
          },
        ],
      };
    }
  }
}
