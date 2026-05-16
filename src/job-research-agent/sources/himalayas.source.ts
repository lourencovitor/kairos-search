import type { JobResearchConfig } from '../config/job-research.config.js';
import type { JobMarket, RawJobPosting } from '../domain/job.types.js';
import { fetchJson } from '../shared/http.util.js';
import { normalizeWhitespace, stripHtmlTags, toIsoDate, uniqueStrings } from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

interface HimalayasJob {
  title?: string;
  excerpt?: string;
  companyName?: string;
  companySlug?: string;
  employmentType?: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
  seniority?: string[];
  locationRestrictions?: string[];
  timezoneRestrictions?: number[];
  categories?: string[];
  parentCategories?: string[];
  description?: string;
  pubDate?: number;
  expiryDate?: number;
  applicationLink?: string;
  guid?: string;
}

interface HimalayasResponse {
  limit?: number;
  totalCount?: number;
  jobs: HimalayasJob[];
}

export class HimalayasSource implements JobSource {
  readonly name = 'himalayas' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    if (!config.himalayas.enabled) {
      return {
        jobs: [],
        summaries: [
          {
            source: this.name,
            label: 'Himalayas Brazil search',
            focus: 'brazil',
            tier: 'brazil_public_api',
            fetchedJobs: 0,
          },
        ],
      };
    }

    try {
      const jobs = await this.fetchSearchJobs(config);

      return {
        jobs,
        summaries: [
          {
            source: this.name,
            label: 'Himalayas Brazil search',
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
            label: 'Himalayas Brazil search',
            focus: 'brazil',
            tier: 'brazil_public_api',
            fetchedJobs: 0,
            error: error instanceof Error ? error.message : 'Unknown Himalayas error',
          },
        ],
      };
    }
  }

  private async fetchSearchJobs(config: JobResearchConfig): Promise<RawJobPosting[]> {
    const jobs: RawJobPosting[] = [];
    const seenSourceIds = new Set<string>();

    for (const query of config.himalayas.searchQueries) {
      const firstPage = await this.fetchPage(config, query, 1);
      this.appendJobs(firstPage.jobs, query, config, jobs, seenSourceIds);

      const pageSize = firstPage.limit ?? firstPage.jobs.length;
      const totalPages =
        pageSize > 0 && firstPage.totalCount
          ? Math.ceil(firstPage.totalCount / pageSize)
          : 1;
      const maxPages = Math.min(config.himalayas.maxPagesPerQuery, totalPages);

      for (let page = 2; page <= maxPages; page += 1) {
        const response = await this.fetchPage(config, query, page);
        this.appendJobs(response.jobs, query, config, jobs, seenSourceIds);
      }
    }

    return jobs;
  }

  private async fetchPage(
    config: JobResearchConfig,
    query: string,
    page: number,
  ): Promise<HimalayasResponse> {
    const url = new URL('https://himalayas.app/jobs/api/search');
    url.searchParams.set('q', query);
    url.searchParams.set('country', config.himalayas.country);
    url.searchParams.set('page', String(page));

    return fetchJson<HimalayasResponse>(url.toString(), {
      headers: {
        'user-agent': config.userAgent,
      },
      timeoutMs: config.requestTimeoutMs,
    });
  }

  private appendJobs(
    sourceJobs: HimalayasJob[],
    query: string,
    config: JobResearchConfig,
    output: RawJobPosting[],
    seenSourceIds: Set<string>,
  ): void {
    for (const job of sourceJobs) {
      const sourceId = job.guid ?? job.applicationLink;
      const url = job.applicationLink ?? job.guid ?? '';

      if (!sourceId || !url || !job.companyName || !job.title) {
        continue;
      }

      if (seenSourceIds.has(sourceId)) {
        continue;
      }

      seenSourceIds.add(sourceId);

      const locationRestrictions = uniqueStrings(job.locationRestrictions ?? []);
      const marketHint = inferBrazilSearchMarketHint(locationRestrictions);

      output.push({
        source: this.name,
        sourceId,
        sourceBoard: `himalayas:${config.himalayas.country}`,
        sourceType: 'aggregator',
        sourceFocus: 'brazil',
        sourceTier: 'brazil_public_api',
        sourceQualityRank: 9,
        companyName: job.companyName,
        title: normalizeWhitespace(job.title),
        url,
        locationText: buildHimalayasLocationText(locationRestrictions),
        descriptionText: stripHtmlTags([job.excerpt, job.description].filter(Boolean).join('\n\n')),
        employmentType: normalizeWhitespace(job.employmentType),
        publishedAt: toIsoDate(job.pubDate),
        updatedAt: toIsoDate(job.pubDate),
        salaryText: formatSalaryRange(job.currency, job.minSalary, job.maxSalary),
        tags: uniqueStrings([
          ...(job.categories ?? []),
          ...(job.parentCategories ?? []),
          ...(job.seniority ?? []),
        ]),
        marketHint,
        remotePolicyHint: 'remote',
        regionHints: locationRestrictions,
        restrictionHints: [],
        curationNotes: [],
        metadata: {
          companySlug: job.companySlug,
          timezoneRestrictions: job.timezoneRestrictions ?? [],
          searchQuery: query,
          sourceCountry: config.himalayas.country,
          remoteBySource: true,
        },
        raw: job,
      });
    }
  }
}

function buildHimalayasLocationText(locationRestrictions: string[]): string {
  if (locationRestrictions.length === 0) {
    return 'Remote';
  }

  return `Remote / ${locationRestrictions.join(', ')}`;
}

function inferBrazilSearchMarketHint(locationRestrictions: string[]): JobMarket {
  const joinedRestrictions = locationRestrictions.join(', ');
  const hasExplicitBrazil = /\bbrazil\b|\bbrasil\b/i.test(joinedRestrictions);

  if (hasExplicitBrazil && locationRestrictions.length === 1) {
    return 'brazil';
  }

  if (/\blatam\b|\blatin america\b|\bsouth america\b|\bcentral america\b/i.test(joinedRestrictions)) {
    return 'latam';
  }

  if (hasExplicitBrazil) {
    return 'brazil_friendly';
  }

  return 'brazil_friendly';
}

function formatSalaryRange(
  currency: string | undefined,
  minSalary: number | undefined,
  maxSalary: number | undefined,
): string | undefined {
  if (!minSalary && !maxSalary) {
    return undefined;
  }

  const currencyPrefix = normalizeWhitespace(currency) ? `${normalizeWhitespace(currency)} ` : '';

  if (minSalary && maxSalary) {
    return `${currencyPrefix}${minSalary} - ${maxSalary}`;
  }

  if (minSalary) {
    return `${currencyPrefix}${minSalary}+`;
  }

  return `${currencyPrefix}${maxSalary}`;
}
