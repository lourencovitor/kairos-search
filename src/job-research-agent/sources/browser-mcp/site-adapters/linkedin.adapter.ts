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

export const CARD_SELECTOR =
  'li.jobs-search__results-list-item, li.job-search-card, .base-card';
export const TITLE_SELECTOR =
  'h3.base-search-card__title, a.job-card-container__link-wrapper, h3';
export const COMPANY_SELECTOR =
  'h4.base-search-card__subtitle, a.job-card-container__company-name, .job-search-card__subtitle-link';
export const LOCATION_SELECTOR =
  '.job-search-card__location, .base-search-card__metadata span';
export const JOB_URL_REGEX = /\/jobs\/view\/(?:[^\/\s"']+-)?(\d+)/i;
export const LOGIN_WALL_SELECTOR = 'input[name="session_key"]';
export const CAPTCHA_SELECTOR =
  '[data-test-id="captcha"], #captcha-internal, iframe[src*="captcha"]';

/**
 * Lista negra de seletores de botão "Apply". O adapter não clica em nenhum
 * desses; o próprio `BrowserMcpClient` também os rejeita no nível de transporte
 * (Requirements 16.2 e 16.3). A constante é exportada para ser usada em testes.
 */
export const APPLY_BUTTON_SELECTORS: readonly string[] = [
  'button[aria-label*="Apply"]',
  'a[data-control-name="jobdetails_topcard_inapply"]',
  'button:has-text("Apply")',
  'button:has-text("Easy Apply")',
];

const CAPTCHA_DETECTOR_REGEX =
  /captcha-internal|data-test-id="captcha"|iframe src=".*captcha"/i;

const DEFAULT_SITE_CONFIG: BrowserMcpSiteConfig = {
  enabled: false,
  searchQueries: ["software engineer", "engenheiro de software"],
  maxPagesPerQuery: 1,
  rateLimitMs: 4_000,
  maxJobs: 200,
  location: "Brazil",
};

// ---------------------------------------------------------------------------
// Helpers de parsing de cards (regex-based: snapshot.domHtml é uma string
// opaque, e queremos evitar uma dependência pesada tipo cheerio).
// ---------------------------------------------------------------------------

/**
 * Quebra o HTML em blocos de `<li ... class="...base-card..." ...>...</li>`,
 * cobrindo as três classes suportadas (`jobs-search__results-list-item`,
 * `job-search-card`, `base-card`). O regex é tolerante a atributos adicionais e
 * a whitespace/quebras de linha entre tags.
 */
function splitIntoCards(domHtml: string): string[] {
  const cardRegex =
    /<li\b[^>]*\bclass="[^"]*(?:jobs-search__results-list-item|job-search-card|base-card)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = cardRegex.exec(domHtml)) !== null) {
    out.push(match[1] ?? "");
  }
  return out;
}

function extractTextAfterTag(cardHtml: string, classPattern: RegExp): string | undefined {
  const match = cardHtml.match(classPattern);
  if (!match) {
    return undefined;
  }
  // Pega o texto interno da tag; se houver tags aninhadas, strip inline.
  const fragment = match[1] ?? "";
  const stripped = fragment.replace(/<[^>]+>/g, " ");
  const normalized = normalizeWhitespace(stripped);
  return normalized.length > 0 ? normalized : undefined;
}

function extractTitle(cardHtml: string): string | undefined {
  // <h3 class="base-search-card__title ...">Title</h3>
  return (
    extractTextAfterTag(
      cardHtml,
      /<h3\b[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i,
    ) ??
    extractTextAfterTag(
      cardHtml,
      /<a\b[^>]*class="[^"]*job-card-container__link-wrapper[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
    ) ??
    extractTextAfterTag(cardHtml, /<h3\b[^>]*>([\s\S]*?)<\/h3>/i)
  );
}

function extractCompany(cardHtml: string): string | undefined {
  return (
    extractTextAfterTag(
      cardHtml,
      /<h4\b[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i,
    ) ??
    extractTextAfterTag(
      cardHtml,
      /<a\b[^>]*class="[^"]*job-card-container__company-name[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
    ) ??
    extractTextAfterTag(
      cardHtml,
      /<a\b[^>]*class="[^"]*job-search-card__subtitle-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
    )
  );
}

function extractLocation(cardHtml: string): string | undefined {
  return (
    extractTextAfterTag(
      cardHtml,
      /<span\b[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    ) ??
    extractTextAfterTag(
      cardHtml,
      /<div\b[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ) ??
    extractTextAfterTag(
      cardHtml,
      /<span\b[^>]*class="[^"]*base-search-card__metadata[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    )
  );
}

function extractJobId(cardHtml: string): string | undefined {
  const match = cardHtml.match(JOB_URL_REGEX);
  return match ? match[1] : undefined;
}

function buildCanonicalUrl(jobId: string): string {
  return `https://www.linkedin.com/jobs/view/${jobId}/`;
}

function buildSearchUrl(query: string, location: string | undefined, page: number): string {
  const params = new URLSearchParams();
  params.set("keywords", query);
  if (location) {
    params.set("location", location);
  }
  params.set("start", String(page * 25));
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

function detectLoginWall(domHtml: string): boolean {
  if (domHtml.includes(LOGIN_WALL_SELECTOR)) {
    return true;
  }
  return domHtml.includes('name="session_key"') || domHtml.includes("session_key");
}

function detectCaptcha(domHtml: string): boolean {
  return CAPTCHA_DETECTOR_REGEX.test(domHtml);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class LinkedInAdapter implements SiteAdapter {
  readonly id = "linkedin" as const;
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

      for (let page = 0; page < maxPages; page += 1) {
        if (jobs.length >= maxJobs) {
          break outer;
        }

        const url = buildSearchUrl(query, siteConfig.location, page);

        let snapshot: BrowserMcpSnapshot;
        try {
          await client.navigate("linkedin", url, siteConfig.rateLimitMs);
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

          const sourceId = `linkedin:${jobId}`;
          if (seenSourceIds.has(sourceId)) {
            continue;
          }
          seenSourceIds.add(sourceId);

          const job: RawJobPosting = {
            source: "browser_mcp",
            sourceId,
            sourceBoard: "linkedin-browser-mcp",
            sourceType: "aggregator",
            sourceFocus: "global",
            sourceTier: "global_aggregator",
            sourceQualityRank: 14,
            companyName: company,
            title,
            url: buildCanonicalUrl(jobId),
            locationText: location,
            descriptionText: "",
            tags: [],
            regionHints: [],
            restrictionHints: [],
            curationNotes: [],
            metadata: {
              browserMcp: {
                siteId: "linkedin",
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

        // Requirement 17.2 — layout-change detection: se a página carregou mas
        // nenhum card foi aproveitado, emite warning para o trace writer.
        if (cards.length > 0 && extractedOnThisPage === 0) {
          warnings.push("extraction_zero_results");
        }
      }
    }

    const durationMs = ctx.now().getTime() - startedAt;

    const trace: SiteAdapterTraceEntry = {
      siteId: "linkedin",
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
        siteId: "linkedin";
        pages: number;
        queries: number;
        durationMs: number;
        droppedJobs: number;
        warnings: string[];
      };
    } = {
      source: "browser_mcp",
      label: "browser_mcp:linkedin",
      focus: "global",
      tier: "global_aggregator",
      fetchedJobs: jobs.length,
      ...(summaryError ? { error: summaryError } : {}),
      metadata: {
        siteId: "linkedin",
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
