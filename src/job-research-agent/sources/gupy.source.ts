import type { JobResearchConfig } from '../config/job-research.config.js';
import type { RawJobPosting, RemotePolicy } from '../domain/job.types.js';
import { fetchJson } from '../shared/http.util.js';
import { normalizeWhitespace, stripHtmlTags, toIsoDate } from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

interface GupyJob {
  id?: number;
  name?: string;
  description?: string;
  careerPageName?: string;
  publishedDate?: string;
  applicationDeadline?: string | null;
  isRemoteWork?: boolean;
  workplaceType?: string;
  city?: string;
  state?: string;
  country?: string;
  jobUrl?: string;
  careerPageUrl?: string;
  type?: string;
}

interface GupyPagination {
  offset: number;
  limit: number;
  total: number;
}

interface GupyResponse {
  data?: GupyJob[];
  pagination?: GupyPagination;
}

const GUPY_API_URL = 'https://portal.api.gupy.io/api/v1/jobs';
const PAGE_LIMIT = 20;

export class GupySource implements JobSource {
  readonly name = 'gupy' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    if (!config.gupy.enabled) {
      return {
        jobs: [],
        summaries: [
          {
            source: this.name,
            label: 'Gupy Brasil',
            focus: 'brazil',
            tier: 'brazil_public_api',
            fetchedJobs: 0,
          },
        ],
      };
    }

    try {
      const jobs = await this.fetchAllJobs(config);

      return {
        jobs,
        summaries: [
          {
            source: this.name,
            label: 'Gupy Brasil',
            focus: 'brazil',
            tier: 'brazil_public_api',
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
            label: 'Gupy Brasil',
            focus: 'brazil',
            tier: 'brazil_public_api',
            fetchedJobs: 0,
            error: error instanceof Error ? error.message : 'Unknown Gupy error',
          },
        ],
      };
    }
  }

  private async fetchAllJobs(config: JobResearchConfig): Promise<RawJobPosting[]> {
    const jobs: RawJobPosting[] = [];
    const seenSourceIds = new Set<string>();

    for (const query of config.gupy.searchQueries) {
      for (let page = 0; page < config.gupy.maxPagesPerQuery; page += 1) {
        const response = await this.fetchPage(config, query, page * PAGE_LIMIT);
        const pageJobs = response.data ?? [];

        this.appendJobs(pageJobs, query, jobs, seenSourceIds);

        const total = response.pagination?.total ?? 0;
        const fetched = (page + 1) * PAGE_LIMIT;

        if (fetched >= total) {
          break;
        }
      }
    }

    return jobs;
  }

  private async fetchPage(
    config: JobResearchConfig,
    query: string,
    offset: number,
  ): Promise<GupyResponse> {
    const url = new URL(GUPY_API_URL);
    url.searchParams.set('jobName', query);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    url.searchParams.set('offset', String(offset));

    return fetchJson<GupyResponse>(url.toString(), {
      headers: {
        'user-agent': config.userAgent,
        accept: 'application/json',
      },
      timeoutMs: config.requestTimeoutMs,
    });
  }

  private appendJobs(
    sourceJobs: GupyJob[],
    query: string,
    output: RawJobPosting[],
    seenSourceIds: Set<string>,
  ): void {
    for (const job of sourceJobs) {
      const sourceId = job.id ? String(job.id) : undefined;
      const url = job.jobUrl ?? job.careerPageUrl;

      if (!sourceId || !url || !job.careerPageName || !job.name) {
        continue;
      }

      if (seenSourceIds.has(sourceId)) {
        continue;
      }

      seenSourceIds.add(sourceId);

      output.push({
        source: this.name,
        sourceId,
        sourceBoard: 'gupy:portal',
        sourceType: 'aggregator',
        sourceFocus: 'brazil',
        sourceTier: 'brazil_public_api',
        sourceQualityRank: 12,
        companyName: normalizeWhitespace(job.careerPageName),
        title: normalizeWhitespace(job.name),
        url,
        locationText: buildLocationText(job),
        descriptionText: stripHtmlTags(job.description ?? ''),
        employmentType: undefined,
        publishedAt: job.publishedDate ? toIsoDate(new Date(job.publishedDate).getTime() / 1000) : undefined,
        updatedAt: undefined,
        salaryText: undefined,
        tags: [],
        marketHint: 'brazil',
        remotePolicyHint: inferRemotePolicy(job),
        regionHints: ['Brazil'],
        restrictionHints: [],
        curationNotes: [],
        metadata: {
          searchQuery: query,
          gupyType: job.type,
          isRemoteWork: job.isRemoteWork,
          workplaceType: job.workplaceType,
        },
        raw: job,
      });
    }
  }
}

function buildLocationText(job: GupyJob): string {
  const parts: string[] = [];

  if (job.workplaceType === 'remote' || job.isRemoteWork) {
    parts.push('Remoto');
  } else if (job.workplaceType === 'hybrid') {
    parts.push('Híbrido');
  }

  const city = normalizeWhitespace(job.city ?? '');
  const state = normalizeWhitespace(job.state ?? '');

  if (city) parts.push(city);
  else if (state) parts.push(state);

  if (!parts.some(p => /brasil/i.test(p))) {
    parts.push('Brasil');
  }

  return parts.join(', ');
}

function inferRemotePolicy(job: GupyJob): RemotePolicy {
  switch (job.workplaceType) {
    case 'remote':
      return 'remote';
    case 'hybrid':
      return 'hybrid';
    case 'on-site':
      return 'onsite';
  }

  if (job.isRemoteWork) {
    return 'remote';
  }

  return 'unknown';
}
