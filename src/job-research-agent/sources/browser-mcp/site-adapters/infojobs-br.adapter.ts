import type { JobSourceSummary, RawJobPosting } from '../../../domain/job.types.js';
import { normalizeWhitespace } from '../../../shared/job.util.js';
import {
  type BrowserMcpSiteConfig,
  type BrowserMcpSnapshot,
  GlobalPageBudgetExhaustedError,
  type SiteAdapter,
  type SiteAdapterContext,
  type SiteAdapterResult,
  type SiteAdapterTraceEntry,
} from '../browser-mcp.types.js';

// ---------------------------------------------------------------------------
// Seletores e constantes top-level (Requirement 3.6 — seletores declarados).
// ---------------------------------------------------------------------------

export const CARD_SELECTOR = 'div.offer-card';
export const TITLE_SELECTOR = 'h2.offer-card__title';
export const COMPANY_SELECTOR = 'p.offer-card__company';
export const LOCATION_SELECTOR = 'p.offer-card__location';
export const JOB_URL_REGEX = /\/ofertas\/(\d+)\//i;
export const LOGIN_WALL_SELECTOR = 'form.login-form, form[action="/login"]';
export const CAPTCHA_SELECTOR = '.captcha-container, iframe[src*="recaptcha"]';

/**
 * Lista negra de seletores de botão "Apply". O adapter não clica em nenhum
 * desses (Requirements 16.2 e 16.3).
 */
export const APPLY_BUTTON_SELECTORS: readonly string[] = [
  'button:has-text("Candidatar")',
  'a:has-text("Candidatar")',
  'button:has-text("Apply")',
  'a:has-text("Apply")',
  'button:has-text("Candidate-se")',
  'a:has-text("Candidate-se")',
  'button:has-text("Inscrever")',
  'a:has-text("Inscrever")',
];

const CAPTCHA_DETECTOR_REGEX = /captcha-container|captcha-overlay/i;

const LOGIN_WALL_DETECTOR_REGEX = /form[^>]*action="\/login"|form[^>]*class="[^"]*login-form/i;

const MARKET_HINT_REGEX = /\b(Remote|Remoto|Brasil|São Paulo|Rio de Janeiro)\b/i;

const DEFAULT_SITE_CONFIG: BrowserMcpSiteConfig = {
  enabled: false,
  searchQueries: ['desenvolvedor', 'engenheiro de software'],
  maxPagesPerQuery: 2,
  rateLimitMs: 4_000,
  maxJobs: 200,
};

// ---------------------------------------------------------------------------
// Helpers de parsing de cards
// ---------------------------------------------------------------------------

function splitIntoCards(domHtml: string): string[] {
  // Real structure: links like /vaga-de-TITLE__ID.aspx
  const cardRegex = /<a\b[^>]*href="[^"]*\/vaga-de-[^"]*__\d+\.aspx"[^>]*>[\s\S]*?<\/a>/gi;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = cardRegex.exec(domHtml)) !== null) {
    out.push(match[0]);
  }
  return out;
}

function _extractTextByTag(cardHtml: string, tagPattern: RegExp): string | undefined {
  const match = tagPattern.exec(cardHtml);
  if (!match) {
    return undefined;
  }
  const fragment = match[1] ?? '';
  const stripped = fragment.replaceAll(/<[^>]+>/g, ' ');
  const normalized = normalizeWhitespace(stripped);
  return normalized.length > 0 ? normalized : undefined;
}

function extractTitle(cardHtml: string): string | undefined {
  // Real: <h2 class="h3 font-weight-bold text-body mb-2 js_vacancyTitle">Title</h2>
  const h2Match = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(cardHtml);
  if (h2Match) {
    const text = normalizeWhitespace(h2Match[1].replaceAll(/<[^>]+>/g, ''));
    if (text.length > 2) return text;
  }
  // Fallback: extract from URL slug
  const urlMatch = /vaga-de-(.+?)(?:-em-[^_]*)?__\d+\.aspx/.exec(cardHtml);
  if (urlMatch) return normalizeWhitespace(urlMatch[1].replaceAll('-', ' '));
  return undefined;
}

function extractCompany(cardHtml: string): string | undefined {
  // Company often in a span or secondary text within the card
  const compMatch = /<span[^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml);
  if (compMatch) {
    const text = normalizeWhitespace(compMatch[1].replaceAll(/<[^>]+>/g, ''));
    if (text.length > 2 && !text.includes('vaga')) return text;
  }
  return undefined;
}

function extractLocation(cardHtml: string): string | undefined {
  // Location often in secondary text
  const locMatch = /(?:em|local[^:]*:)\s*([^<,]+)/i.exec(cardHtml);
  if (locMatch) return normalizeWhitespace(locMatch[1]);
  return undefined;
}

function extractJobUrl(cardHtml: string): string | undefined {
  const hrefMatch = /href="([^"]*vaga-de-[^"]*__\d+\.aspx)"/.exec(cardHtml);
  if (!hrefMatch) return undefined;
  return hrefMatch[1];
}

function extractJobId(cardHtml: string): string | undefined {
  const href = extractJobUrl(cardHtml);
  if (!href) return undefined;
  const match = /__(\d+)\.aspx/.exec(href);
  return match ? match[1] : undefined;
}

function buildCanonicalUrl(href: string): string {
  if (href.startsWith('http')) {
    return href;
  }
  return `https://www.infojobs.com.br${href}`;
}

function buildSearchUrl(query: string, page: number): string {
  const encoded = encodeURIComponent(query);
  let url = `https://www.infojobs.com.br/empregos.aspx?palabra=${encoded}`;
  if (page > 1) {
    url += `&Page=${page}`;
  }
  return url;
}

function detectLoginWall(domHtml: string): boolean {
  return LOGIN_WALL_DETECTOR_REGEX.test(domHtml);
}

function detectCaptcha(domHtml: string): boolean {
  return CAPTCHA_DETECTOR_REGEX.test(domHtml);
}

function deriveMarketHint(locationText: string): 'brazil' | undefined {
  return MARKET_HINT_REGEX.test(locationText) ? 'brazil' : undefined;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class InfoJobsBrAdapter implements SiteAdapter {
  readonly id = 'infojobs_br' as const;
  readonly defaultConfig: BrowserMcpSiteConfig = DEFAULT_SITE_CONFIG;

  async collect(ctx: SiteAdapterContext): Promise<SiteAdapterResult> {
    const startedAt = ctx.now().getTime();
    const { client, siteConfig } = ctx;

    const jobs: RawJobPosting[] = [];
    const seenSourceIds = new Set<string>();

    let queriesExecuted = 0;
    let pagesVisited = 0;
    let droppedJobs = 0;
    const errors: string[] = [];
    const warnings: string[] = [];
    let summaryError: string | undefined;

    const maxPages = Math.max(0, siteConfig.maxPagesPerQuery);
    const maxJobs = Math.max(0, siteConfig.maxJobs);

    outer: for (const query of siteConfig.searchQueries) {
      queriesExecuted += 1;

      for (let page = 1; page <= maxPages; page += 1) {
        if (jobs.length >= maxJobs) {
          break outer;
        }

        const url = buildSearchUrl(query, page);

        let snapshot: BrowserMcpSnapshot;
        try {
          await client.navigate('infojobs_br', url, siteConfig.rateLimitMs);
          pagesVisited += 1;
          snapshot = await client.snapshot();
        } catch (error) {
          if (error instanceof GlobalPageBudgetExhaustedError) {
            summaryError = 'skipped_global_limit';
            errors.push('skipped_global_limit');
            break outer;
          }
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
          summaryError = summaryError ?? message;
          break outer;
        }

        const { domHtml } = snapshot;

        if (detectLoginWall(domHtml)) {
          summaryError = 'requires_manual_login';
          errors.push('requires_manual_login');
          break outer;
        }

        if (detectCaptcha(domHtml)) {
          summaryError = 'rate_limited_or_captcha';
          errors.push('rate_limited_or_captcha');
          break outer;
        }

        const cards = splitIntoCards(domHtml);
        if (cards.length === 0) {
          warnings.push('extraction_zero_results');
          continue;
        }

        let extractedOnThisPage = 0;

        for (const cardHtml of cards) {
          const title = normalizeWhitespace(extractTitle(cardHtml));
          const company = normalizeWhitespace(extractCompany(cardHtml));
          const location = normalizeWhitespace(extractLocation(cardHtml) ?? '');
          const jobId = extractJobId(cardHtml);
          const href = extractJobUrl(cardHtml);

          if (!title || !jobId || !href) {
            droppedJobs += 1;
            continue;
          }

          const sourceId = `infojobs_br:${jobId}`;
          if (seenSourceIds.has(sourceId)) {
            continue;
          }
          seenSourceIds.add(sourceId);

          const marketHint = deriveMarketHint(location);

          const job: RawJobPosting = {
            source: 'browser_mcp',
            sourceId,
            sourceBoard: 'infojobs-br-browser-mcp',
            sourceType: 'aggregator',
            sourceFocus: 'brazil',
            sourceTier: 'brazil_public_api',
            sourceQualityRank: 12,
            companyName: company || 'Empresa não informada',
            title,
            url: buildCanonicalUrl(href),
            locationText: location,
            descriptionText: '',
            tags: [],
            regionHints: [],
            restrictionHints: [],
            curationNotes: [],
            ...(marketHint ? { marketHint } : {}),
            metadata: {
              browserMcp: {
                siteId: 'infojobs_br',
                query,
              },
            },
            raw: null,
          };

          jobs.push(job);
          extractedOnThisPage += 1;

          if (jobs.length >= maxJobs) {
            break;
          }
        }

        // Requirement 17.2 — layout-change detection
        if (cards.length > 0 && extractedOnThisPage === 0) {
          warnings.push('extraction_zero_results');
        }
      }
    }

    const durationMs = ctx.now().getTime() - startedAt;

    const trace: SiteAdapterTraceEntry = {
      siteId: 'infojobs_br',
      queriesExecuted,
      pagesVisited,
      jobsExtracted: jobs.length,
      droppedJobs,
      durationMs,
      errors,
      warnings,
    };

    const summary: JobSourceSummary & {
      metadata?: {
        siteId: 'infojobs_br';
        pages: number;
        queries: number;
        durationMs: number;
        droppedJobs: number;
        warnings: string[];
      };
    } = {
      source: 'browser_mcp',
      label: 'browser_mcp:infojobs_br',
      focus: 'brazil',
      tier: 'brazil_public_api',
      fetchedJobs: jobs.length,
      ...(summaryError ? { error: summaryError } : {}),
      metadata: {
        siteId: 'infojobs_br',
        pages: pagesVisited,
        queries: queriesExecuted,
        durationMs,
        droppedJobs,
        warnings,
      },
    };

    return { jobs, summary, trace };
  }
}
