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

export const CARD_SELECTOR = ".cell-list-content";
export const TITLE_SELECTOR = "h3.title";
export const COMPANY_SELECTOR = "p.company-name";
export const LOCATION_SELECTOR = "span.location";
export const JOB_URL_REGEX = /\/jobs\/(\d+)-[^"'\s]*/i;
export const LOGIN_WALL_SELECTOR = 'form.login-form, form[action="/sessions"]';
export const CAPTCHA_SELECTOR = ".captcha-overlay, iframe[src*=\"recaptcha\"]";

/**
 * Lista negra de seletores de botão "Apply". O adapter não clica em nenhum
 * desses (Requirements 16.2 e 16.3).
 */
export const APPLY_BUTTON_SELECTORS: readonly string[] = [
  'button:has-text("Candidatar")',
  'a:has-text("Candidatar")',
  'button:has-text("Apply")',
  'a:has-text("Apply")',
];

const CAPTCHA_DETECTOR_REGEX =
  /captcha-overlay|<iframe[^>]*src="[^"]*recaptcha\/api2\/(?!aframe)[^"]*"/i;

const LOGIN_WALL_DETECTOR_REGEX =
  /form[^>]*action="\/sessions"|form[^>]*class="[^"]*login-form/i;

const MARKET_HINT_REGEX =
  /\b(Remote|Remoto|Brasil|São Paulo|Rio de Janeiro)\b/i;

const DEFAULT_SITE_CONFIG: BrowserMcpSiteConfig = {
  enabled: false,
  searchQueries: ["desenvolvedor", "software engineer"],
  maxPagesPerQuery: 3,
  rateLimitMs: 4_000,
  maxJobs: 200,
};

// ---------------------------------------------------------------------------
// Helpers de parsing de cards
// ---------------------------------------------------------------------------

function splitIntoCards(domHtml: string): string[] {
  // Each job card is an <a href="/jobs/ID-slug"> containing a cell-list-content div.
  // We extract the full <a>...</a> block for each job link.
  const cardRegex =
    /<a\b[^>]*href="\/jobs\/\d+[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
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
  // Real structure: <h3 class="text-24 line-height-30">Title Here</h3>
  return extractTextByTag(
    cardHtml,
    /<h3\b[^>]*>([\s\S]*?)<\/h3>/i,
  );
}

function extractCompany(cardHtml: string): string | undefined {
  // Real structure: <span><i class="fa fa-briefcase"></i>Company Name</span>
  const match = /<i\b[^>]*class="[^"]*fa-briefcase[^"]*"[^>]*><\/i>([\s\S]*?)<\/span>/i.exec(cardHtml);
  if (!match) return undefined;
  const text = normalizeWhitespace(match[1].replaceAll(/<[^>]+>/g, " "));
  return text.length > 0 ? text : undefined;
}

function extractLocation(cardHtml: string): string | undefined {
  // Real structure: <span><i class="fas fa-map-marker-alt"></i>Location</span>
  const match = /<i\b[^>]*class="[^"]*fa-map-marker[^"]*"[^>]*><\/i>([\s\S]*?)<\/span>/i.exec(cardHtml);
  if (!match) return undefined;
  const text = normalizeWhitespace(match[1].replaceAll(/<[^>]+>/g, " "));
  return text.length > 0 ? text : undefined;
}

function extractJobId(cardHtml: string): string | undefined {
  const match = JOB_URL_REGEX.exec(cardHtml);
  if (!match) return undefined;
  // Reset lastIndex since JOB_URL_REGEX has /i flag but no /g
  return match[1];
}

function buildCanonicalUrl(jobId: string, slug: string): string {
  return `https://www.programathor.com.br/jobs/${jobId}-${slug}`;
}

function extractSlug(cardHtml: string): string {
  const slugRegex = /\/jobs\/\d+-([\w-]+)/i;
  const match = slugRegex.exec(cardHtml);
  return match ? match[1] : "unknown";
}

function buildSearchUrl(query: string, page: number): string {
  const params = new URLSearchParams();
  params.set("query", query);
  if (page > 1) {
    params.set("page", String(page));
  }
  return `https://www.programathor.com.br/jobs?${params.toString()}`;
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

export class ProgramaThorAdapter implements SiteAdapter {
  readonly id = "programathor" as const;
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
          await client.navigate("programathor", url, siteConfig.rateLimitMs);
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

          if (!title || !company || !jobId) {
            droppedJobs += 1;
            continue;
          }

          const sourceId = `programathor:${jobId}`;
          if (seenSourceIds.has(sourceId)) {
            continue;
          }
          seenSourceIds.add(sourceId);

          const slug = extractSlug(cardHtml);
          const marketHint = deriveMarketHint(location);

          const job: RawJobPosting = {
            source: "browser_mcp",
            sourceId,
            sourceBoard: "programathor-browser-mcp",
            sourceType: "aggregator",
            sourceFocus: "brazil",
            sourceTier: "brazil_public_api",
            sourceQualityRank: 16,
            companyName: company,
            title,
            url: buildCanonicalUrl(jobId, slug),
            locationText: location,
            descriptionText: "",
            tags: [],
            regionHints: [],
            restrictionHints: [],
            curationNotes: [],
            ...(marketHint ? { marketHint } : {}),
            metadata: {
              browserMcp: {
                siteId: "programathor",
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
      siteId: "programathor",
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
        siteId: "programathor";
        pages: number;
        queries: number;
        durationMs: number;
        droppedJobs: number;
        warnings: string[];
      };
    } = {
      source: "browser_mcp",
      label: "browser_mcp:programathor",
      focus: "brazil",
      tier: "brazil_public_api",
      fetchedJobs: jobs.length,
      ...(summaryError ? { error: summaryError } : {}),
      metadata: {
        siteId: "programathor",
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
