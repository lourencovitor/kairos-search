import type { JobResearchConfig } from '../config/job-research.config.js';
import type { JobMarket, RawJobPosting } from '../domain/job.types.js';
import { fetchJson } from '../shared/http.util.js';
import { detectBrazilLocation } from '../shared/location.util.js';
import { normalizeWhitespace, stripHtmlTags, toIsoDate, uniqueStrings } from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

interface ExpandedNameAttributes {
  name?: string;
}

interface ExpandedNameResource {
  id?: string | number;
  type?: string;
  attributes?: ExpandedNameAttributes;
}

interface ExpandedCollection {
  data?: ExpandedNameResource[];
}

interface ExpandedSingle {
  data?: ExpandedNameResource;
}

interface GetOnBoardJobAttributes {
  title?: string;
  description?: string;
  projects?: string;
  functions?: string;
  benefits?: string;
  desirable?: string;
  remote?: boolean;
  remote_modality?: string;
  countries?: string[];
  category_name?: string;
  min_salary?: number;
  max_salary?: number;
  published_at?: number;
  location_regions?: ExpandedCollection;
  location_tenants?: ExpandedCollection;
  location_cities?: ExpandedCollection;
  tags?: ExpandedCollection;
  company?: ExpandedSingle;
}

interface GetOnBoardJob {
  id: string;
  attributes: GetOnBoardJobAttributes;
  links?: {
    public_url?: string;
  };
}

interface GetOnBoardResponse {
  data: GetOnBoardJob[];
  meta?: {
    total_pages?: number;
  };
}

export class GetOnBoardSource implements JobSource {
  readonly name = 'getonboard' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    if (!config.getOnBoard.enabled) {
      return {
        jobs: [],
        summaries: [
          {
            source: this.name,
            label: 'Get on Board Brazil search',
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
            label: 'Get on Board Brazil search',
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
            label: 'Get on Board Brazil search',
            focus: 'brazil',
            tier: 'brazil_public_api',
            fetchedJobs: 0,
            error: error instanceof Error ? error.message : 'Unknown Get on Board error',
          },
        ],
      };
    }
  }

  private async fetchSearchJobs(config: JobResearchConfig): Promise<RawJobPosting[]> {
    const jobs: RawJobPosting[] = [];
    const seenSourceIds = new Set<string>();

    for (const query of config.getOnBoard.searchQueries) {
      const firstPage = await this.fetchPage(config, query, 1);
      this.appendJobs(firstPage.data, query, config, jobs, seenSourceIds);

      const totalPages = Math.min(
        config.getOnBoard.maxPagesPerQuery,
        firstPage.meta?.total_pages ?? 1,
      );

      for (let page = 2; page <= totalPages; page += 1) {
        const response = await this.fetchPage(config, query, page);
        this.appendJobs(response.data, query, config, jobs, seenSourceIds);
      }
    }

    return jobs;
  }

  private async fetchPage(
    config: JobResearchConfig,
    query: string,
    page: number,
  ): Promise<GetOnBoardResponse> {
    const url = new URL('https://www.getonbrd.com/api/v0/search/jobs');
    url.searchParams.set('query', query);
    url.searchParams.set('lang', config.getOnBoard.lang);
    url.searchParams.set('country_code', config.getOnBoard.countryCode);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(config.getOnBoard.perPage));

    for (const expansion of ['company', 'location_regions', 'location_tenants', 'location_cities', 'tags']) {
      url.searchParams.append('expand[]', expansion);
    }

    return fetchJson<GetOnBoardResponse>(url.toString(), {
      headers: {
        'user-agent': config.userAgent,
      },
      timeoutMs: config.requestTimeoutMs,
    });
  }

  private appendJobs(
    sourceJobs: GetOnBoardJob[],
    query: string,
    config: JobResearchConfig,
    output: RawJobPosting[],
    seenSourceIds: Set<string>,
  ): void {
    for (const job of sourceJobs) {
      const sourceId = job.id;
      const attributes = job.attributes;
      const url = job.links?.public_url ?? '';

      if (!sourceId || !url || !attributes.title) {
        continue;
      }

      if (seenSourceIds.has(sourceId)) {
        continue;
      }

      seenSourceIds.add(sourceId);

      const locationRegions = extractExpandedNames(attributes.location_regions);
      const locationCountries = uniqueStrings([
        ...((attributes.countries ?? []).filter((country) => country !== 'Remote')),
        ...extractExpandedNames(attributes.location_tenants),
      ]);
      const locationCities = extractExpandedNames(attributes.location_cities);
      const locationNames = uniqueStrings([
        ...locationCities,
        ...locationCountries,
        ...locationRegions,
      ]);
      const companyName =
        normalizeWhitespace(attributes.company?.data?.attributes?.name) ||
        inferCompanyNameFromJobId(sourceId);
      const locationText = buildGetOnBoardLocationText({
        remote: attributes.remote === true,
        remoteModality: attributes.remote_modality,
        cities: locationCities,
        countries: locationCountries,
        regions: locationRegions,
      });
      const marketHint = inferGetOnBoardMarketHint(
        attributes.remote === true,
        locationNames,
      );

      output.push({
        source: this.name,
        sourceId,
        sourceBoard: `getonboard:${config.getOnBoard.countryCode}`,
        sourceType: 'aggregator',
        sourceFocus: 'brazil',
        sourceTier: 'brazil_public_api',
        sourceQualityRank: 9,
        companyName,
        title: normalizeWhitespace(attributes.title),
        url,
        locationText,
        descriptionText: stripHtmlTags(
          [
            attributes.description,
            attributes.projects,
            attributes.functions,
            attributes.benefits,
            attributes.desirable,
          ]
            .filter(Boolean)
            .join('\n\n'),
        ),
        publishedAt: toIsoDate(attributes.published_at),
        updatedAt: toIsoDate(attributes.published_at),
        salaryText: formatSalaryRange(attributes.min_salary, attributes.max_salary),
        tags: uniqueStrings([
          attributes.category_name,
          ...extractExpandedNames(attributes.tags),
        ]),
        marketHint,
        remotePolicyHint: attributes.remote ? 'remote' : undefined,
        regionHints: locationNames,
        restrictionHints: [],
        curationNotes: [],
        metadata: {
          categoryName: attributes.category_name,
          remoteModality: attributes.remote_modality,
          searchQuery: query,
          sourceCountryCode: config.getOnBoard.countryCode,
          remoteBySource: attributes.remote === true,
        },
        raw: job,
      });
    }
  }
}

function extractExpandedNames(collection: ExpandedCollection | undefined): string[] {
  return uniqueStrings(
    (collection?.data ?? []).map((entry) => entry.attributes?.name),
  );
}

function buildGetOnBoardLocationText(input: {
  remote: boolean;
  remoteModality?: string;
  cities: string[];
  countries: string[];
  regions: string[];
}): string {
  const remoteLabel = input.remote ? 'Remote' : mapRemoteModality(input.remoteModality);
  const geoLabel = uniqueStrings([
    ...input.cities,
    ...input.countries,
    ...input.regions,
  ]).join(', ');

  if (remoteLabel && geoLabel) {
    return `${remoteLabel} / ${geoLabel}`;
  }

  return remoteLabel || geoLabel;
}

function mapRemoteModality(remoteModality: string | undefined): string {
  switch (remoteModality) {
    case 'remote_local':
    case 'remote_total':
      return 'Remote';
    case 'hybrid':
      return 'Hybrid';
    case 'no_remote':
      return '';
    default:
      return normalizeWhitespace(remoteModality).replace(/_/g, ' ');
  }
}

function inferGetOnBoardMarketHint(
  isRemote: boolean,
  locationNames: string[],
): JobMarket {
  const joinedLocation = locationNames.join(', ');
  const brazilLocation = detectBrazilLocation(joinedLocation);

  if (brazilLocation.isBrazilLocation && locationNames.length <= 2) {
    return 'brazil';
  }

  if (/\blatam\b|\blatin america\b|\bsouth america\b|\bcentral america\b|\bamericas\b/i.test(joinedLocation)) {
    return 'latam';
  }

  if (brazilLocation.isBrazilLocation) {
    return 'brazil_friendly';
  }

  return isRemote ? 'brazil_friendly' : 'brazil';
}

function inferCompanyNameFromJobId(jobId: string): string {
  const segments = jobId.split('-');

  if (segments.length < 3) {
    return 'Unknown company';
  }

  const companySlug = segments.at(-2) ?? 'unknown-company';
  return companySlug
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatSalaryRange(
  minSalary: number | undefined,
  maxSalary: number | undefined,
): string | undefined {
  if (!minSalary && !maxSalary) {
    return undefined;
  }

  if (minSalary && maxSalary) {
    return `USD ${minSalary} - ${maxSalary}`;
  }

  if (minSalary) {
    return `USD ${minSalary}+`;
  }

  return `USD ${maxSalary}`;
}
