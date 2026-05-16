import type { JobSourceSummary, RawJobPosting } from "../../../domain/job.types.js";
import { normalizeWhitespace } from "../../../shared/job.util.js";
import {
  GlobalPageBudgetExhaustedError,
  type BrowserMcpSiteConfig,
  type BrowserMcpSnapshot,
  type SiteAdapter,
  type SiteAdapterContext,
  type SiteAdapterResult,
  type SiteAdapterTraceEntry,
} from "../browser-mcp.types.js";

// ---------------------------------------------------------------------------
// Seletores e constantes top-level (Requirement 3.6 — seletores declarados).
// ---------------------------------------------------------------------------

export const CARD_SELECTOR = "article.opportunity-card";
export const TITLE_SELECTOR = "h2.opportunity-card__title";
export const COMPANY_SELECTOR = "p.opportunity-card__company";
export const LOCATION_SELECTOR = "p.opportunity-card__location";
export const JOB_URL_REGEX = /\/opportunities\/(\d+)/i;
export const LOGIN_WALL_SELECTOR = 'form.login-form, form[action="/login"]';
export const CAPTCHA_SELECTOR = ".captcha-container, iframe[src*=\"recaptcha\"]";

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
];

const CAPTCHA_DETECTOR_REGEX =
  /captcha-container|captcha-overlay/i;

const LOGIN_WALL_DETECTOR_REGEX =
  /form[^>]*action="\/login"|form[^>]*class="[^"]*login-form/i;

const MARKET_HINT_REGEX =
  /\b(Remote|Remoto|Brasil|São Paulo|Rio de Janeiro)\b/i;

const DEFAULT_SITE_CONFIG: BrowserMcpSiteConfig = {
  enabled: false,
  searchQueries: ["desenvolvedor", "designer"],
  maxPagesPerQuery: 2,
  rateLimitMs: 4_000,
  maxJobs: 200,
};

// ---------------------------------------------------------------------------
// Helpers de parsing de cards
// ---------------------------------------------------------------------------

function splitIntoCards(domHtml: string): string[] {
  // Real structure: <div class="opportunity-box" data-opportunity-id="ID">...<a href="/oportunidades/ID">...</a>...</div>
  const cardRegex =
    /<div\b[^>]*class="opportunity-box[^"]*"[^>]*>([\s\S]*?)<\/a>\s*<\/div>/gi;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = cardRegex.exec(domHtml)) !== null) {
    out.push(match[0]);
  }
  return out;
}

function extractTextByTag(cardHtml: string, tagPattern: RegExp): string | undefined {
  const match = tagPattern.exec(cardHtml);
  if (!match) {
    return undefined;
  }
  const fragment = match[1] ?? "";
  const stripped = fragment.replaceAll(/<[^>]+>/g, " ");
  const normalized = normalizeWhitespace(stripped);
  return normalized.length > 0 ? normalized : undefined;
}

function extractTitle(cardHtml: string): string | undefined {
  // Real: <h4>Title</h4> inside <div class="info">
  return extractTextByTag(cardHtml, /<h4\b[^>]*>([\s\S]*?)<\/h4>/i);
}

function extractCompany(cardHtml: string): string | undefined {
  // Real: <img alt="Company"> or company name in a span/p after h4
  const imgMatch = /<img\b[^>]*alt="([^"]+)"[^>]*>/i.exec(cardHtml);
  if (imgMatch && imgMatch[1].length > 1) return normalizeWhitespace(imgMatch[1]);
  return undefined;
}

function extractLocation(cardHtml: string): string | undefined {
  // Trampos shows location as text near the card, often in a span
  const locMatch = /<span\b[^>]*class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml);
  if (locMatch) return normalizeWhitespace(locMatch[1].replaceAll(/<[^>]+>/g, ""));
  // Fallback: look for "Remoto" or city names in the info div
  const infoMatch = /<div\b[^>]*class="info"[^>]*>([\s\S]*?)<\/div>/i.exec(cardHtml);
  if (infoMatch) {
    const text = infoMatch[1].replaceAll(/<[^>]+>/g, " ");
    const remoto = /\b(Remoto|Remote|São Paulo|Rio de Janeiro|Brasil)\b/i.exec(text);
    if (remoto) return remoto[0];
  }
  return undefined;
}

function extractJobUrl(cardHtml: string): string | undefined {
  const hrefMatch = /href="(\/oportunidades\/[^"]+)"/.exec(cardHtml);
  if (!hrefMatch) return undefined;
  return hrefMatch[1];
}

function extractJobId(cardHtml: string): string | undefined {
  // data-opportunity-id="772836" or from URL /oportunidades/772836
  const dataId = /data-opportunity-id="(\d+)"/.exec(cardHtml);
  if (dataId) return dataId[1];
  const href = extractJobUrl(cardHtml);
  if (!href) return undefined;
  const match = /\/oportunidades\/(\d+)/.exec(href);
  return match ? match[1] : undefined;
}

function buildCanonicalUrl(href: string): string {
  if (href.startsWith("http")) {
    return href;
  }
  return `https://trampos.co${href}`;
}

function buildSearchUrl(query: string, page: number): string {
  const encoded = encodeURIComponent(query);
  let url = `https://trampos.co/oportunidades?search=${encoded}`;
  if (page > 1) {
    url += `&page=${page}`;
  }
  return url;
}

function detectLoginWall(domHtml: string): boolean {
  return LOGIN_WALL_DETECTOR_REGEX.test(domHtml);
}

function detectCaptcha(domHtml: string): boolean {
  return CAPTCHA_DETECTOR_REGEX.test(domHtml);
}

function deriveMarketHint(locationText: string): "brazil" | undefined {
  return MARKET_HINT_REGEX.test(locationText) ? "brazil" : undefined;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class TramposCoAdapter implements SiteAdapter {
  readonly id = "trampos_co" as const;
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
          await client.navigate("trampos_co", url, siteConfig.rateLimitMs);
          pagesVisited += 1;
          snapshot = await client.snapshot();
        } catch (error) {
          if (error instanceof GlobalPageBudgetExhaustedError) {
            summaryError = "skipped_global_limit";
            errors.push("skipped_global_limit");
            break outer;
          }
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
          summaryError = summaryError ?? message;
          break outer;
        }

        const { domHtml } = snapshot;

        if (detectLoginWall(domHtml)) {
          summaryError = "requires_manual_login";
          errors.push("requires_manual_login");
          break outer;
        }

        if (detectCaptcha(domHtml)) {
          summaryError = "rate_limited_or_captcha";
          errors.push("rate_limited_or_captcha");
          break outer;
        }

        const cards = splitIntoCards(domHtml);
        if (cards.length === 0) {
          warnings.push("extraction_zero_results");
          continue;
        }

        let extractedOnThisPage = 0;

        for (const cardHtml of cards) {
          const title = normalizeWhitespace(extractTitle(cardHtml));
          const company = normalizeWhitespace(extractCompany(cardHtml));
          const location = normalizeWhitespace(extractLocation(cardHtml) ?? "");
          const jobId = extractJobId(cardHtml);
          const href = extractJobUrl(cardHtml);

          if (!title || !jobId || !href) {
            droppedJobs += 1;
            continue;
          }

          const sourceId = `trampos_co:${jobId}`;
          if (seenSourceIds.has(sourceId)) {
            continue;
          }
          seenSourceIds.add(sourceId);

          const marketHint = deriveMarketHint(location);

          const job: RawJobPosting = {
            source: "browser_mcp",
            sourceId,
            sourceBoard: "trampos-co-browser-mcp",
            sourceType: "aggregator",
            sourceFocus: "brazil",
            sourceTier: "brazil_public_api",
            sourceQualityRank: 16,
            companyName: company || "Empresa não informada",
            title,
            url: buildCanonicalUrl(href),
            locationText: location,
            descriptionText: "",
            tags: [],
            regionHints: [],
            restrictionHints: [],
            curationNotes: [],
            ...(marketHint ? { marketHint } : {}),
            metadata: {
              browserMcp: {
                siteId: "trampos_co",
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
          warnings.push("extraction_zero_results");
        }
      }
    }

    const durationMs = ctx.now().getTime() - startedAt;

    const trace: SiteAdapterTraceEntry = {
      siteId: "trampos_co",
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
        siteId: "trampos_co";
        pages: number;
        queries: number;
        durationMs: number;
        droppedJobs: number;
        warnings: string[];
      };
    } = {
      source: "browser_mcp",
      label: "browser_mcp:trampos_co",
      focus: "brazil",
      tier: "brazil_public_api",
      fetchedJobs: jobs.length,
      ...(summaryError ? { error: summaryError } : {}),
      metadata: {
        siteId: "trampos_co",
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
