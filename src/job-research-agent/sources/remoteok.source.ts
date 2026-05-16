import type { JobResearchConfig } from '../config/job-research.config.js';
import type { RawJobPosting } from '../domain/job.types.js';
import { fetchJson } from '../shared/http.util.js';
import { stripHtmlTags, toIsoDate, uniqueStrings } from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

interface RemoteOkListing {
  id?: number;
  slug?: string;
  date?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  apply_url?: string;
  url?: string;
  salary_min?: number;
  salary_max?: number;
}

export class RemoteOkSource implements JobSource {
  readonly name = 'remoteok' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    if (!config.remoteOk.enabled) {
      return {
        jobs: [],
        summaries: [
          {
            source: this.name,
            label: 'RemoteOK',
            focus: 'global',
            tier: 'global_aggregator',
            fetchedJobs: 0,
          },
        ],
      };
    }

    try {
      const response = await fetchJson<RemoteOkListing[]>('https://remoteok.com/api', {
        headers: {
          'user-agent': config.userAgent,
        },
        timeoutMs: config.requestTimeoutMs,
      });

      const jobs = response
        .filter((job) => job.id && job.position && job.company)
        .map<RawJobPosting>((job) => ({
          source: this.name,
          sourceId: String(job.id),
          sourceBoard: 'remoteok',
          sourceType: 'aggregator',
          sourceFocus: 'global',
          sourceTier: 'global_aggregator',
          sourceQualityRank: 6,
          companyName: job.company ?? 'Unknown company',
          title: job.position ?? 'Unknown title',
          url: job.apply_url || job.url || '',
          locationText: job.location ?? '',
          descriptionText: stripHtmlTags(job.description),
          publishedAt: toIsoDate(job.date),
          updatedAt: toIsoDate(job.date),
          salaryText: formatRemoteOkSalary(job.salary_min, job.salary_max),
          tags: uniqueStrings(job.tags ?? []),
          remotePolicyHint: 'remote',
          regionHints: uniqueStrings([job.location]),
          restrictionHints: [],
          curationNotes: [],
          metadata: {
            remoteBySource: true,
          },
          raw: job,
        }))
        .filter((job) => Boolean(job.url));

      return {
        jobs,
        summaries: [
          {
            source: this.name,
            label: 'RemoteOK',
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
            label: 'RemoteOK',
            focus: 'global',
            tier: 'global_aggregator',
            fetchedJobs: 0,
            error: error instanceof Error ? error.message : 'Unknown RemoteOK error',
          },
        ],
      };
    }
  }
}

function formatRemoteOkSalary(min?: number, max?: number): string | undefined {
  if (!min && !max) {
    return undefined;
  }

  if (min && max) {
    return `USD ${min} - ${max}`;
  }

  if (min) {
    return `USD ${min}+`;
  }

  return `USD ${max}`;
}
