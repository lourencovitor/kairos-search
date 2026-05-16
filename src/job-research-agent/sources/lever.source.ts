import type { JobResearchConfig } from '../config/job-research.config.js';
import type { RawJobPosting } from '../domain/job.types.js';
import { fetchJson } from '../shared/http.util.js';
import { normalizeWhitespace, toIsoDate, uniqueStrings } from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

interface LeverPosting {
  id: string;
  text: string;
  descriptionPlain?: string;
  openingPlain?: string;
  additionalPlain?: string;
  descriptionBodyPlain?: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  salaryDescriptionPlain?: string;
  salaryDescription?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
    allLocations?: string[];
  };
  workplaceType?: string;
  country?: string;
}

export class LeverSource implements JobSource {
  readonly name = 'lever' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    const summaries: JobSourceFetchResult['summaries'] = [];
    const jobs: RawJobPosting[] = [];

    for (const company of config.leverCompanies) {
      const url = `https://api.lever.co/v0/postings/${company.companyHandle}?mode=json`;

      try {
        const response = await fetchJson<LeverPosting[]>(url, {
          headers: {
            'user-agent': config.userAgent,
          },
          timeoutMs: config.requestTimeoutMs,
        });

        const companyJobs = response.map<RawJobPosting>((job) => ({
          source: this.name,
          sourceId: job.id,
          sourceBoard: company.companyHandle,
          sourceType: 'direct_company_board',
          sourceFocus: 'global',
          sourceTier: 'direct_company_board',
          sourceQualityRank: 8,
          companyName: company.companyName,
          title: job.text,
          url: job.hostedUrl,
          locationText:
            normalizeWhitespace(job.categories?.location) ||
            normalizeWhitespace(job.country) ||
            normalizeWhitespace(job.categories?.allLocations?.join(', ')),
          descriptionText: normalizeWhitespace(
            uniqueStrings([
              job.descriptionPlain,
              job.openingPlain,
              job.descriptionBodyPlain,
              job.additionalPlain,
            ]).join(' '),
          ),
          employmentType: job.categories?.commitment,
          publishedAt: toIsoDate(job.createdAt),
          updatedAt: toIsoDate(job.createdAt),
          salaryText:
            normalizeWhitespace(job.salaryDescriptionPlain) ||
            normalizeWhitespace(job.salaryDescription) ||
            formatSalaryRange(job.salaryRange),
          tags: uniqueStrings([
            job.categories?.team,
            job.categories?.location,
            job.workplaceType,
            ...(company.tags ?? []),
          ]),
          regionHints: [],
          restrictionHints: [],
          curationNotes: [],
          metadata: {
            categories: job.categories ?? {},
            workplaceType: job.workplaceType,
            applyUrl: job.applyUrl,
          },
          raw: job,
        }));

        jobs.push(...companyJobs);
        summaries.push({
          source: this.name,
          label: company.companyName,
          focus: 'global',
          tier: 'direct_company_board',
          fetchedJobs: companyJobs.length,
        });
      } catch (error) {
        summaries.push({
          source: this.name,
          label: company.companyName,
          focus: 'global',
          tier: 'direct_company_board',
          fetchedJobs: 0,
          error: error instanceof Error ? error.message : 'Unknown Lever error',
        });
      }
    }

    return {
      jobs,
      summaries,
    };
  }
}

function formatSalaryRange(
  salaryRange: LeverPosting['salaryRange'],
): string | undefined {
  if (!salaryRange || (!salaryRange.min && !salaryRange.max)) {
    return undefined;
  }

  const currency = salaryRange.currency ? `${salaryRange.currency} ` : '';

  if (salaryRange.min && salaryRange.max) {
    return `${currency}${salaryRange.min} - ${salaryRange.max}`;
  }

  if (salaryRange.min) {
    return `${currency}${salaryRange.min}+`;
  }

  return `${currency}${salaryRange.max}`;
}
