import type { JobResearchConfig } from '../config/job-research.config.js';
import type { RawJobPosting } from '../domain/job.types.js';
import { fetchJson } from '../shared/http.util.js';
import { stripHtmlTags, toIsoDate, uniqueStrings } from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

interface GreenhouseDepartment {
  name?: string;
}

interface GreenhouseOffice {
  name?: string;
}

interface GreenhouseJob {
  id: number;
  absolute_url: string;
  title: string;
  company_name?: string;
  content?: string;
  updated_at?: string;
  first_published?: string;
  location?: {
    name?: string;
  };
  departments?: GreenhouseDepartment[];
  offices?: GreenhouseOffice[];
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export class GreenhouseSource implements JobSource {
  readonly name = 'greenhouse' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    const summaries: JobSourceFetchResult['summaries'] = [];
    const jobs: RawJobPosting[] = [];

    for (const board of config.greenhouseBoards) {
      const url = `https://boards-api.greenhouse.io/v1/boards/${board.boardToken}/jobs?content=true`;

      try {
        const response = await fetchJson<GreenhouseResponse>(url, {
          headers: {
            'user-agent': config.userAgent,
          },
          timeoutMs: config.requestTimeoutMs,
        });

        const boardJobs = response.jobs.map<RawJobPosting>((job) => ({
          source: this.name,
          sourceId: String(job.id),
          sourceBoard: board.boardToken,
          sourceType: 'direct_company_board',
          sourceFocus: 'global',
          sourceTier: 'direct_company_board',
          sourceQualityRank: 8,
          companyName: job.company_name || board.companyName,
          title: job.title,
          url: job.absolute_url,
          locationText: job.location?.name ?? '',
          descriptionText: stripHtmlTags(job.content),
          publishedAt: toIsoDate(job.first_published),
          updatedAt: toIsoDate(job.updated_at),
          tags: uniqueStrings([
            ...(job.departments ?? []).map((department) => department.name),
            ...(job.offices ?? []).map((office) => office.name),
            ...(board.tags ?? []),
          ]),
          regionHints: [],
          restrictionHints: [],
          curationNotes: [],
          metadata: {
            departments: job.departments ?? [],
            offices: job.offices ?? [],
          },
          raw: job,
        }));

        jobs.push(...boardJobs);
        summaries.push({
          source: this.name,
          label: board.companyName,
          focus: 'global',
          tier: 'direct_company_board',
          fetchedJobs: boardJobs.length,
        });
      } catch (error) {
        summaries.push({
          source: this.name,
          label: board.companyName,
          focus: 'global',
          tier: 'direct_company_board',
          fetchedJobs: 0,
          error: error instanceof Error ? error.message : 'Unknown Greenhouse error',
        });
      }
    }

    return {
      jobs,
      summaries,
    };
  }
}
