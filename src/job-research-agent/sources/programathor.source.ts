import type { JobResearchConfig } from '../config/job-research.config.js';
import type { RawJobPosting } from '../domain/job.types.js';
import { fetchText } from '../shared/http.util.js';
import {
  decodeHtmlEntities,
  normalizeWhitespace,
  stripHtmlTags,
  uniqueStrings,
} from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

interface ProgramaThorCard {
  sourceId: string;
  url: string;
  title: string;
  companyName: string;
  locationText: string;
  companyType?: string;
  salaryText?: string;
  expertise?: string;
  employmentType?: string;
  tags: string[];
}

export class ProgramaThorSource implements JobSource {
  readonly name = 'programathor' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    if (!config.programathor.enabled) {
      return {
        jobs: [],
        summaries: [
          {
            source: this.name,
            label: 'ProgramaThor jobs',
            focus: 'brazil',
            tier: 'brazil_public_api',
            fetchedJobs: 0,
          },
        ],
      };
    }

    try {
      const jobs = await this.fetchListingJobs(config);

      return {
        jobs,
        summaries: [
          {
            source: this.name,
            label: 'ProgramaThor jobs',
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
            label: 'ProgramaThor jobs',
            focus: 'brazil',
            tier: 'brazil_public_api',
            fetchedJobs: 0,
            error: error instanceof Error ? error.message : 'Unknown ProgramaThor error',
          },
        ],
      };
    }
  }

  private async fetchListingJobs(config: JobResearchConfig): Promise<RawJobPosting[]> {
    const jobs: RawJobPosting[] = [];
    const seenSourceIds = new Set<string>();

    for (let page = 1; page <= config.programathor.maxPages; page += 1) {
      const html = await this.fetchPage(config, page);
      const cards = parseProgramaThorCards(html);

      for (const card of cards) {
        if (seenSourceIds.has(card.sourceId)) {
          continue;
        }

        seenSourceIds.add(card.sourceId);

        jobs.push({
          source: this.name,
          sourceId: card.sourceId,
          sourceBoard: 'programathor',
          sourceType: 'aggregator',
          sourceFocus: 'brazil',
          sourceTier: 'brazil_public_api',
          sourceQualityRank: 16,
          companyName: card.companyName,
          title: card.title,
          url: card.url,
          locationText: card.locationText,
          descriptionText: [
            card.title,
            card.companyName,
            card.locationText,
            card.companyType,
            card.salaryText,
            card.expertise,
            card.employmentType,
            ...card.tags,
          ]
            .filter(Boolean)
            .join('\n'),
          employmentType: card.employmentType,
          tags: uniqueStrings(card.tags),
          marketHint: inferProgramaThorMarket(card.locationText),
          remotePolicyHint: inferProgramaThorRemotePolicy(card.locationText),
          regionHints: uniqueStrings([card.locationText]),
          restrictionHints: [],
          curationNotes: [],
          metadata: {
            companyType: card.companyType,
            expertise: card.expertise,
            remoteBySource: /remoto/i.test(card.locationText),
            sourceMode: config.programathor.remoteOnly ? 'remote-only-listing' : 'listing',
          },
          raw: card,
        });
      }
    }

    return jobs;
  }

  private async fetchPage(config: JobResearchConfig, page: number): Promise<string> {
    const basePath =
      page <= 1 ? '/jobs' : `/jobs/page/${page}`;
    const url = new URL(`https://programathor.com.br${basePath}`);

    if (config.programathor.remoteOnly) {
      url.searchParams.set('remoto', 'true');
    }

    return fetchText(url.toString(), {
      headers: {
        'user-agent': config.userAgent,
      },
      timeoutMs: config.requestTimeoutMs,
    });
  }
}

function parseProgramaThorCards(html: string): ProgramaThorCard[] {
  const cards: ProgramaThorCard[] = [];
  const cardRegex =
    /<a href="(\/jobs\/(\d+)-[^"]+)">[\s\S]*?<div class="cell-list-content"><h3 class="text-24 line-height-30">([\s\S]*?)<\/h3><div class='cell-list-content-icon'>([\s\S]*?)<\/div><div>([\s\S]*?)<\/div><\/div>[\s\S]*?<\/a>/g;

  for (const match of html.matchAll(cardRegex)) {
    const [, relativeUrl, sourceId, rawTitle, rawMeta, rawTags] = match;
    const title = normalizeWhitespace(stripHtmlTags(rawTitle.replace(/<span class="new-label">[\s\S]*?<\/span>/g, '')));
    const metadataValues = extractProgramaThorMetadataValues(rawMeta);
    const tags = extractProgramaThorTags(rawTags);

    if (!title || metadataValues.length < 2) {
      continue;
    }

    cards.push({
      sourceId,
      url: `https://programathor.com.br${decodeHtmlEntities(relativeUrl)}`,
      title,
      companyName: metadataValues[0] ?? 'Unknown company',
      locationText: metadataValues[1] ?? '',
      companyType: metadataValues[2],
      salaryText: metadataValues[3],
      expertise: metadataValues[4],
      employmentType: metadataValues[5],
      tags,
    });
  }

  return cards;
}

function extractProgramaThorMetadataValues(rawMeta: string): string[] {
  return [...rawMeta.matchAll(/<span><i[^>]*><\/i>([\s\S]*?)<\/span>/g)]
    .map((match) => normalizeWhitespace(stripHtmlTags(match[1])))
    .filter(Boolean);
}

function extractProgramaThorTags(rawTags: string): string[] {
  return uniqueStrings(
    [...rawTags.matchAll(/<span class='tag-list background-gray'>([\s\S]*?)<\/span>/g)]
      .map((match) => normalizeWhitespace(stripHtmlTags(match[1]))),
  );
}

function inferProgramaThorMarket(locationText: string): 'brazil' | 'brazil_friendly' {
  return /\bremoto\b|\bs[aã]o paulo\b|\brio de janeiro\b|\bbelo horizonte\b|\bcuritiba\b|\bflorian[oó]polis\b|\bporto alegre\b|\bbrasil\b|\bbrazil\b/i.test(
    normalizeWhitespace(locationText).toLowerCase(),
  )
    ? 'brazil'
    : 'brazil_friendly';
}

function inferProgramaThorRemotePolicy(locationText: string): 'remote' | 'hybrid' | 'onsite' | 'unknown' {
  const searchableText = normalizeWhitespace(locationText).toLowerCase();

  if (/\bh[ií]brido\b|\bhybrid\b/.test(searchableText)) {
    return 'hybrid';
  }

  if (/\bremoto\b|\bremote\b/.test(searchableText)) {
    return 'remote';
  }

  if (/\bpresencial\b|\bon-?site\b/.test(searchableText)) {
    return 'onsite';
  }

  return 'unknown';
}
