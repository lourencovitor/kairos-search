import type { AshbyCompanyConfig, JobResearchConfig } from '../config/job-research.config.js';
import type { RawJobPosting, RemotePolicy } from '../domain/job.types.js';
import { fetchJson } from '../shared/http.util.js';
import { normalizeWhitespace, stripHtmlTags } from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

const GRAPHQL_URL = 'https://jobs.ashbyhq.com/api/non-user-graphql';

const LIST_QUERY = `
  query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
    jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
      jobPostings {
        id
        title
        locationName
        workplaceType
        employmentType
        compensationTierSummary
        secondaryLocations { locationName }
      }
    }
  }
`.trim();

const DETAIL_QUERY = `
  query ApiJobPostingById($jobPostingId: String!, $organizationHostedJobsPageName: String!) {
    jobPosting(jobPostingId: $jobPostingId, organizationHostedJobsPageName: $organizationHostedJobsPageName) {
      id
      descriptionHtml
      publishedDate
    }
  }
`.trim();

interface AshbyJobBrief {
  id: string;
  title: string;
  locationName: string;
  workplaceType: 'Remote' | 'OnSite' | 'Hybrid' | string;
  employmentType: string;
  compensationTierSummary: string | null;
  secondaryLocations: Array<{ locationName: string }>;
}

interface AshbyListResponse {
  data?: {
    jobBoard?: {
      jobPostings?: AshbyJobBrief[];
    };
  };
}

interface AshbyDetailResponse {
  data?: {
    jobPosting?: {
      id: string;
      descriptionHtml: string;
      publishedDate: string | null;
    };
  };
}

export class AshbySource implements JobSource {
  readonly name = 'ashby' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    if (config.ashbyCompanies.length === 0) {
      return { jobs: [], summaries: [] };
    }

    const allJobs: RawJobPosting[] = [];
    const summaries: JobSourceFetchResult['summaries'] = [];

    await Promise.allSettled(
      config.ashbyCompanies.map(async (company) => {
        try {
          const jobs = await this.fetchCompanyJobs(company, config);
          allJobs.push(...jobs);
          summaries.push({
            source: this.name,
            label: `Ashby – ${company.companyName}`,
            focus: 'global',
            tier: 'direct_company_board',
            fetchedJobs: jobs.length,
          });
        } catch (error) {
          summaries.push({
            source: this.name,
            label: `Ashby – ${company.companyName}`,
            focus: 'global',
            tier: 'direct_company_board',
            fetchedJobs: 0,
            error: error instanceof Error ? error.message : 'Unknown Ashby error',
          });
        }
      }),
    );

    return { jobs: allJobs, summaries };
  }

  private async fetchCompanyJobs(
    company: AshbyCompanyConfig,
    config: JobResearchConfig,
  ): Promise<RawJobPosting[]> {
    const listResponse = await fetchJson<AshbyListResponse>(
      `${GRAPHQL_URL}?op=ApiJobBoardWithTeams`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': config.userAgent,
        },
        body: JSON.stringify({
          operationName: 'ApiJobBoardWithTeams',
          variables: { organizationHostedJobsPageName: company.slug },
          query: LIST_QUERY,
        }),
        timeoutMs: config.requestTimeoutMs,
      },
    );

    const briefs = listResponse.data?.jobBoard?.jobPostings ?? [];
    const remoteBriefs = briefs.filter((j) => j.workplaceType === 'Remote');

    const jobs: RawJobPosting[] = [];

    for (const brief of remoteBriefs) {
      const detail = await this.fetchDetail(company.slug, brief.id, config);
      const allLocations = [brief.locationName, ...brief.secondaryLocations.map(l => l.locationName)]
        .filter(Boolean)
        .join(', ');

      jobs.push({
        source: this.name,
        sourceId: brief.id,
        sourceBoard: `ashby:${company.slug}`,
        sourceType: 'direct_company_board',
        sourceFocus: 'global',
        sourceTier: 'direct_company_board',
        sourceQualityRank: 11,
        companyName: company.companyName,
        title: normalizeWhitespace(brief.title),
        url: `https://jobs.ashbyhq.com/${company.slug}/${brief.id}`,
        locationText: allLocations || 'Remote',
        descriptionText: stripHtmlTags(detail.descriptionHtml),
        employmentType: brief.employmentType === 'FullTime' ? 'Full-time' : brief.employmentType,
        publishedAt: detail.publishedDate ?? undefined,
        updatedAt: detail.publishedDate ?? undefined,
        salaryText: brief.compensationTierSummary ?? undefined,
        tags: [],
        marketHint: undefined,
        remotePolicyHint: inferRemotePolicy(brief.workplaceType),
        regionHints: extractRegionHints(allLocations),
        restrictionHints: [],
        curationNotes: [],
        metadata: { ashbySlug: company.slug },
        raw: brief,
      });
    }

    return jobs;
  }

  private async fetchDetail(
    slug: string,
    jobId: string,
    config: JobResearchConfig,
  ): Promise<{ descriptionHtml: string; publishedDate: string | null }> {
    try {
      const response = await fetchJson<AshbyDetailResponse>(
        `${GRAPHQL_URL}?op=ApiJobPostingById`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'user-agent': config.userAgent,
          },
          body: JSON.stringify({
            operationName: 'ApiJobPostingById',
            variables: { jobPostingId: jobId, organizationHostedJobsPageName: slug },
            query: DETAIL_QUERY,
          }),
          timeoutMs: Math.min(config.requestTimeoutMs, 8_000),
        },
      );
      return {
        descriptionHtml: response.data?.jobPosting?.descriptionHtml ?? '',
        publishedDate: response.data?.jobPosting?.publishedDate ?? null,
      };
    } catch {
      return { descriptionHtml: '', publishedDate: null };
    }
  }
}

function inferRemotePolicy(workplaceType: string): RemotePolicy {
  switch (workplaceType) {
    case 'Remote':  return 'remote';
    case 'Hybrid':  return 'hybrid';
    case 'OnSite':  return 'onsite';
    default:        return 'unknown';
  }
}

function extractRegionHints(locationText: string): string[] {
  const hints: string[] = [];

  if (/worldwide|global|anywhere/i.test(locationText)) hints.push('Worldwide');
  if (/brazil|brasil/i.test(locationText))              hints.push('Brazil');
  if (/latin america|latam|america latina/i.test(locationText)) hints.push('LATAM');
  if (/united states|usa|\bUS\b/i.test(locationText))  hints.push('United States');
  if (/europe/i.test(locationText))                     hints.push('Europe');
  if (/canada/i.test(locationText))                     hints.push('Canada');

  return hints;
}
