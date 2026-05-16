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

export const CARD_SELECTOR = 'li[data-job-id]';
export const TITLE_SELECTOR = 'a.JobCard_jobTitle__GLyJ1';
export const COMPANY_SELECTOR = 'span.EmployerProfile_companyName__xaVBo';
export const LOCATION_SELECTOR = 'div.JobCard_location__N3S3X';
export const NEXT_BUTTON_SELECTOR = 'button[data-test="next-page"]';
export const LOGIN_WALL_SELECTOR = 'input[name="username"], form[action*="sign-in"]';
export const CAPTCHA_SELECTOR = 'div#captcha';

/**
 * Lista negra de seletores de botão "Apply". O adapter não clica em nenhum
 * desses (Requirements 16.2 e 16.3).
 */
export const APPLY_BUTTON_SELECTORS: readonly string[] = [
  'button:has-text("Apply")',
  'a:has-text("Apply")',
  'button:has-text("Easy Apply")',
  'a:has-text("Easy Apply")',
  'button:has-text("Candidatar")',
  'a:has-text("Candidatar")',
];

const CAPTCHA_TEXT_REGEX = /confirm you are not a robot/i;
const CAPTCHA_ELEMENT_REGEX = /<div\b[^>]*\bid="captcha"/i;

const LOGIN_WALL_DETECTOR_REGEX =
  /input[^>]*name="username"|form[^>]*action="[^"]*sign-in/i;

const MARKET_HINT_REGEX =
  /\b(Remote|Remoto|Brasil|São Paulo|Rio de Janeiro)\b/i;

const DEFAULT_SITE_CONFIG: BrowserMcpSiteConfig = {
  enabled: false,
  searchQueries: ["software engineer"],
  maxPagesPerQuery: 3,
  rateLimitMs: 6_000,
  maxJobs: 200,
};

// ---------------------------------------------------------------------------
// Helpers de parsing de cards
// ---------------------------------------------------------------------------

function splitIntoCards(domHtml: string): string[] {
  const cardRegex =
    /<li\b[^>]*\bdata-job-id="[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = cardRegex.exec(domHtml)) !== null) {
    out.push(match[0]);
  }
  return out;
}

function extractTextByRegex(cardHtml: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(cardHtml);
  if (!match) {
    return undefined;
  }
  const fragment = match[1] ?? "";
  const stripped = fragment.replaceAll(/<[^>]+>/g, " ");
  const normalized = normalizeWhitespace(stripped);
  return normalized.length > 0 ? normalized : undefined;
}

function extractTitle(cardHtml: string): string | undefined {
  return extractTextByRegex(
    cardHtml,
    /<a\b[^>]*class="[^"]*JobCard_jobTitle[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
  );
}

function extractCompany(cardHtml: string): string | undefined {
  return extractTextByRegex(
    cardHtml,
    /<span\b[^>]*class="[^"]*EmployerProfile_companyName[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  );
}

function extractLocation(cardHtml: string): string | undefined {
  return extractTextByRegex(
    cardHtml,
    /<div\b[^>]*class="[^"]*JobCard_location[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
}

function extractJobId(cardHtml: string): string | undefined {
  const match = /data-job-id="([^"]+)"/i.exec(cardHtml);
  return match ? match[1] : undefined;
}

function extractJobUrl(cardHtml: string): string | undefined {
  const match = /<a\b[^>]*class="[^"]*JobCard_jobTitle[^"]*"[^>]*href="([^"]+)"/i.exec(cardHtml);
  if (!match) return undefined;
  const href = match[1];
  if (href.startsWith("http")) return href;
  return `https://www.glassdoor.com${href}`;
}

function buildSearchUrl(query: string, location?: string): string {
  const params = new URLSearchParams();
  params.set("sc.keyword", query);
  if (location) {
    params.set("locT", "C");
    params.set("locKeyword", location);
  }
  return `https://www.glassdoor.com/Job/jobs.htm?${params.toString()}`;
}

function detectLoginWall(domHtml: string): boolean {
  return LOGIN_WALL_DETECTOR_REGEX.test(domHtml);
}

function detectCaptcha(domHtml: string): boolean {
  return CAPTCHA_ELEMENT_REGEX.test(domHtml) || CAPTCHA_TEXT_REGEX.test(domHtml);
}

function deriveMarketHint(locationText: string): "brazil" | undefined {
  return MARKET_HINT_REGEX.test(locationText) ? "brazil" : undefined;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class GlassdoorAdapter implements SiteAdapter {
  readonly id = "glassdoor" as const;
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

        let snapshot: BrowserMcpSnapshot;
        try {
          if (page === 1) {
            // First page: navigate to search URL
            const url = buildSearchUrl(query, siteConfig.location);
            await client.navigate("glassdoor", url, siteConfig.rateLimitMs);
          } else {
            // Subsequent pages: click "Next" button
            await client.click(NEXT_BUTTON_SELECTOR);
          }
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

          const sourceId = `glassdoor:${jobId}`;
          if (seenSourceIds.has(sourceId)) {
            continue;
          }
          seenSourceIds.add(sourceId);

          const jobUrl = extractJobUrl(cardHtml) ?? `https://www.glassdoor.com/job-listing/j?jl=${jobId}`;
          const marketHint = deriveMarketHint(location);

          const job: RawJobPosting = {
            source: "browser_mcp",
            sourceId,
            sourceBoard: "glassdoor-browser-mcp",
            sourceType: "aggregator",
            sourceFocus: "global",
            sourceTier: "global_aggregator",
            sourceQualityRank: 14,
            companyName: company,
            title,
            url: jobUrl,
            locationText: location,
            descriptionText: "",
            tags: [],
            regionHints: [],
            restrictionHints: [],
            curationNotes: [],
            ...(marketHint ? { marketHint } : {}),
            metadata: {
              browserMcp: {
                siteId: "glassdoor",
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
      siteId: "glassdoor",
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
        siteId: "glassdoor";
        pages: number;
        queries: number;
        durationMs: number;
        droppedJobs: number;
        warnings: string[];
      };
    } = {
      source: "browser_mcp",
      label: "browser_mcp:glassdoor",
      focus: "global",
      tier: "global_aggregator",
      fetchedJobs: jobs.length,
      ...(summaryError ? { error: summaryError } : {}),
      metadata: {
        siteId: "glassdoor",
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
