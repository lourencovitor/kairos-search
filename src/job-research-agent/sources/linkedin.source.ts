import type { JobResearchConfig } from '../config/job-research.config.js';
import type { RawJobPosting } from '../domain/job.types.js';
import { fetchText } from '../shared/http.util.js';
import {
  decodeHtmlEntities,
  normalizeWhitespace,
  stripHtmlTags,
  toIsoDate,
  uniqueStrings,
} from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

interface LinkedInSearchCard {
  sourceId: string;
  url: string;
  title: string;
  companyName: string;
  locationText: string;
  publishedAt?: string;
}

const LINKEDIN_PAGE_SIZE = 25;

export class LinkedInSource implements JobSource {
  readonly name = 'linkedin' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    if (!config.linkedIn.enabled) {
      return {
        jobs: [],
        summaries: [
          {
            source: this.name,
            label: 'LinkedIn public jobs search',
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
            label: 'LinkedIn public jobs search',
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
            label: 'LinkedIn public jobs search',
            focus: 'brazil',
            tier: 'brazil_public_api',
            fetchedJobs: 0,
            error: error instanceof Error ? error.message : 'Unknown LinkedIn error',
          },
        ],
      };
    }
  }

  private async fetchSearchJobs(config: JobResearchConfig): Promise<RawJobPosting[]> {
    const jobs: RawJobPosting[] = [];
    const seenSourceIds = new Set<string>();

    for (const query of config.linkedIn.searchQueries) {
      for (let page = 0; page < config.linkedIn.maxPagesPerQuery; page += 1) {
        const html = await this.fetchSearchPage(config, query, page);
        const cards = parseLinkedInSearchCards(html);

        for (const card of cards) {
          if (seenSourceIds.has(card.sourceId)) {
            continue;
          }

          seenSourceIds.add(card.sourceId);

          jobs.push({
            source: this.name,
            sourceId: card.sourceId,
            sourceBoard: 'linkedin-public-jobs',
            sourceType: 'aggregator',
            sourceFocus: 'brazil',
            sourceTier: 'brazil_public_api',
            sourceQualityRank: 14,
            companyName: card.companyName,
            title: card.title,
            url: card.url,
            locationText: card.locationText,
            descriptionText: `${card.title}\n\n${query}\n\n${card.locationText}`,
            employmentType: undefined,
            publishedAt: card.publishedAt,
            updatedAt: card.publishedAt,
            salaryText: undefined,
            tags: uniqueStrings([
              query,
              card.locationText,
            ]),
            marketHint: inferLinkedInMarket(card.locationText),
            remotePolicyHint: inferRemotePolicyHint(card.locationText),
            regionHints: uniqueStrings([card.locationText, config.linkedIn.location]),
            restrictionHints: [],
            curationNotes: [],
            metadata: {
              searchQuery: query,
              searchLocation: config.linkedIn.location,
              remoteBySource: /remote/i.test(card.locationText),
              sourceMode: 'linkedin-public-jobs',
            },
            raw: card,
          });
        }
      }
    }

    return jobs;
  }

  private async fetchSearchPage(
    config: JobResearchConfig,
    query: string,
    page: number,
  ): Promise<string> {
    const url = new URL('https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search');
    url.searchParams.set('keywords', query);
    url.searchParams.set('location', config.linkedIn.location);
    url.searchParams.set('start', String(page * LINKEDIN_PAGE_SIZE));

    return fetchText(url.toString(), {
      headers: {
        'user-agent': config.userAgent,
      },
      timeoutMs: config.requestTimeoutMs,
    });
  }

}

function parseLinkedInSearchCards(html: string): LinkedInSearchCard[] {
  const cards: LinkedInSearchCard[] = [];
  const cardRegex =
    /data-entity-urn="urn:li:jobPosting:(\d+)"[\s\S]*?<a class="base-card__full-link[^"]*" href="([^"]+)"[\s\S]*?<h3 class="base-search-card__title">([\s\S]*?)<\/h3>[\s\S]*?<h4 class="base-search-card__subtitle">([\s\S]*?)<\/h4>[\s\S]*?<span class="job-search-card__location">([\s\S]*?)<\/span>[\s\S]*?<time class="job-search-card__listdate" datetime="([^"]+)"/g;

  for (const match of html.matchAll(cardRegex)) {
    const [, sourceId, url, title, companyName, locationText, publishedAt] = match;

    cards.push({
      sourceId,
      url: decodeHtmlEntities(url),
      title: normalizeWhitespace(stripHtmlTags(title)),
      companyName: normalizeWhitespace(stripHtmlTags(companyName)),
      locationText: normalizeWhitespace(stripHtmlTags(locationText)),
      publishedAt: toIsoDate(publishedAt),
    });
  }

  return cards;
}

function inferLinkedInMarket(locationText: string): 'brazil' | 'brazil_friendly' | 'latam' | 'international' {
  const normalizedLocation = normalizeWhitespace(locationText).toLowerCase();

  if (/\bbrazil\b|\bbrasil\b/.test(normalizedLocation)) {
    return 'brazil';
  }

  if (/\blatam\b|\blatin america\b|\bsouth america\b/.test(normalizedLocation)) {
    return 'latam';
  }

  return 'brazil_friendly';
}

function inferRemotePolicyHint(locationText: string): 'remote' | 'hybrid' | 'onsite' | 'unknown' {
  const searchableText = locationText.toLowerCase();

  if (/\bhybrid\b/.test(searchableText)) {
    return 'hybrid';
  }

  if (/\bremote\b/.test(searchableText)) {
    return 'remote';
  }

  if (/\bon-?site\b/.test(searchableText)) {
    return 'onsite';
  }

  return 'unknown';
}
