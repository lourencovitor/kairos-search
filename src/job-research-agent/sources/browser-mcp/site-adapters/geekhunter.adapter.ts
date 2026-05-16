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

export const CARD_SELECTOR = "a[href*='/jobs/'], a[href*='/vagas/']";
export const TITLE_SELECTOR = "h1, h2, h3, h4";
export const COMPANY_SELECTOR = "[class*='company'], [class*='empresa']";
export const LOCATION_SELECTOR = "[class*='location'], [class*='local']";
export const JOB_URL_REGEX = /\/(?:[^"'/]+\/)?jobs\/([^"'?#\s]+)/i;
export const LOGIN_WALL_SELECTOR = 'form[action*="login"], input[type="password"]';
export const CAPTCHA_SELECTOR = ".captcha-container, iframe[src*=\"recaptcha\"]";

export const APPLY_BUTTON_SELECTORS: readonly string[] = [
  'button:has-text("Candidatar")',
  'a:has-text("Candidatar")',
  'button:has-text("Apply")',
  'a:has-text("Apply")',
  'button:has-text("Candidate-se")',
  'a:has-text("Candidate-se")',
];

const DEFAULT_SITE_CONFIG: BrowserMcpSiteConfig = {
  enabled: false,
  searchQueries: ["desenvolvedor", "software engineer", "devops", "qa engineer"],
  maxPagesPerQuery: 2,
  rateLimitMs: 4_000,
  maxJobs: 200,
};

const CAPTCHA_DETECTOR_REGEX = /captcha-container|captcha-overlay|recaptcha/i;
const LOGIN_WALL_DETECTOR_REGEX = /form[^>]*action="[^"]*login|input[^>]*type="password"/i;
const BRAZIL_MARKET_REGEX = /\b(remoto|remote|brasil|brazil|são paulo|rio de janeiro)\b/i;

function buildSearchUrl(query: string, page: number): string {
  const params = new URLSearchParams({ locale: "pt-BR", search: query });
  if (page > 1) {
    params.set("page", String(page));
  }
  return `https://www.geekhunter.com.br/vagas?${params.toString()}`;
}

function splitIntoCards(domHtml: string): string[] {
  const cardRegex =
    /<a\b[^>]*href="[^"]*(?:\/jobs\/|\/vagas\/)[^"]*"[^>]*>[\s\S]*?<\/a>/gi;
  const cards: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(domHtml)) !== null) {
    cards.push(match[0]);
  }

  return cards;
}

function extractText(cardHtml: string): string {
  return normalizeWhitespace(
    cardHtml
      .replaceAll(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replaceAll(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replaceAll(/<[^>]+>/g, " "),
  );
}

function extractTitle(cardHtml: string): string | undefined {
  const headingMatch = /<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i.exec(cardHtml);
  if (headingMatch) {
    const text = normalizeWhitespace(headingMatch[1].replaceAll(/<[^>]+>/g, " "));
    if (text.length > 2) {
      return text;
    }
  }

  const ariaLabelMatch = /aria-label="([^"]+)"/i.exec(cardHtml);
  if (ariaLabelMatch) {
    const text = normalizeWhitespace(ariaLabelMatch[1]);
    if (text.length > 2) {
      return text;
    }
  }

  const href = extractJobUrl(cardHtml);
  const slugMatch = href ? /\/jobs\/([^"'/]+)/i.exec(href) : null;
  return slugMatch ? normalizeWhitespace(slugMatch[1].replaceAll("-", " ")) : undefined;
}

function extractJobUrl(cardHtml: string): string | undefined {
  const hrefMatch = /href="([^"]*(?:\/jobs\/|\/vagas\/)[^"]*)"/i.exec(cardHtml);
  return hrefMatch?.[1];
}

function extractJobId(cardHtml: string): string | undefined {
  const href = extractJobUrl(cardHtml);
  if (!href) {
    return undefined;
  }

  const idMatch = /\/jobs\/([^"'/?.#]+)|\/vagas\/([^"'/?.#]+)/i.exec(href);
  return idMatch?.[1] ?? idMatch?.[2];
}

function extractLocation(cardHtml: string): string {
  const text = extractText(cardHtml);
  const locationMatch =
    /\b(Remoto|Remote|Híbrido|Presencial|São Paulo\s*-\s*SP|Rio de Janeiro\s*-\s*RJ|Brasil|Brazil)\b[^|,]*/i.exec(
      text,
    );
  return normalizeWhitespace(locationMatch?.[0] ?? "");
}

function extractSalary(text: string): string | undefined {
  const salaryMatch = /R\$\s*[\d.,]+(?:\s*-\s*R\$\s*[\d.,]+)?(?:\s*\/\s*(?:m[eê]s|month))?/i.exec(
    text,
  );
  return salaryMatch?.[0];
}

function extractTags(text: string): string[] {
  const tags = [
    "React",
    "React Native",
    "Node",
    "TypeScript",
    "JavaScript",
    "Python",
    "Java",
    ".NET",
    "AWS",
    "Docker",
    "Kubernetes",
    "PostgreSQL",
    "DevOps",
    "QA",
  ];

  return tags.filter((tag) => new RegExp(`\\b${tag.replace(".", "\\.")}\\b`, "i").test(text));
}

function buildCanonicalUrl(href: string): string {
  if (href.startsWith("http")) {
    return href;
  }

  return `https://www.geekhunter.com.br${href.startsWith("/") ? href : `/${href}`}`;
}

function deriveMarketHint(locationText: string): "brazil" | undefined {
  return BRAZIL_MARKET_REGEX.test(locationText) ? "brazil" : undefined;
}

export class GeekHunterAdapter implements SiteAdapter {
  readonly id = "geekhunter" as const;
  readonly defaultConfig: BrowserMcpSiteConfig = DEFAULT_SITE_CONFIG;

  async collect(ctx: SiteAdapterContext): Promise<SiteAdapterResult> {
    const startedAt = ctx.now().getTime();
    const { client, siteConfig } = ctx;

    const jobs: RawJobPosting[] = [];
    const seenSourceIds = new Set<string>();
    const errors: string[] = [];
    const warnings: string[] = [];
    let queriesExecuted = 0;
    let pagesVisited = 0;
    let droppedJobs = 0;
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
          await client.navigate("geekhunter", buildSearchUrl(query, page), siteConfig.rateLimitMs);
          pagesVisited += 1;
          snapshot = await client.snapshot();
        } catch (error) {
          if (error instanceof GlobalPageBudgetExhaustedError) {
            summaryError = "skipped_global_limit";
            errors.push("skipped_global_limit");
            break outer;
          }
          const message = error instanceof Error ? error.message : String(error);
          summaryError = summaryError ?? message;
          errors.push(message);
          break outer;
        }

        if (LOGIN_WALL_DETECTOR_REGEX.test(snapshot.domHtml)) {
          summaryError = "requires_manual_login";
          errors.push("requires_manual_login");
          break outer;
        }

        if (CAPTCHA_DETECTOR_REGEX.test(snapshot.domHtml)) {
          summaryError = "rate_limited_or_captcha";
          errors.push("rate_limited_or_captcha");
          break outer;
        }

        const cards = splitIntoCards(snapshot.domHtml);
        if (cards.length === 0) {
          warnings.push("extraction_zero_results");
          continue;
        }

        let extractedOnThisPage = 0;
        for (const cardHtml of cards) {
          const title = normalizeWhitespace(extractTitle(cardHtml));
          const href = extractJobUrl(cardHtml);
          const jobId = extractJobId(cardHtml);
          const text = extractText(cardHtml);
          const locationText = extractLocation(cardHtml);

          if (!title || !href || !jobId) {
            droppedJobs += 1;
            continue;
          }

          const sourceId = `geekhunter:${jobId}`;
          if (seenSourceIds.has(sourceId)) {
            continue;
          }
          seenSourceIds.add(sourceId);

          jobs.push({
            source: "browser_mcp",
            sourceId,
            sourceBoard: "geekhunter-browser-mcp",
            sourceType: "aggregator",
            sourceFocus: "brazil",
            sourceTier: "brazil_public_api",
            sourceQualityRank: 17,
            companyName: "GeekHunter",
            title,
            url: buildCanonicalUrl(href),
            locationText,
            descriptionText: text,
            salaryText: extractSalary(text),
            tags: extractTags(text),
            marketHint: deriveMarketHint(locationText),
            regionHints: locationText ? [locationText] : [],
            restrictionHints: [],
            curationNotes: ["Collected from GeekHunter public search via Browser MCP."],
            metadata: { siteId: "geekhunter", query, page },
            raw: { cardHtml },
          });
          extractedOnThisPage += 1;

          if (jobs.length >= maxJobs) {
            break;
          }
        }

        if (extractedOnThisPage === 0) {
          warnings.push("extraction_zero_results");
        }
      }
    }

    const trace: SiteAdapterTraceEntry = {
      siteId: "geekhunter",
      queriesExecuted,
      pagesVisited,
      jobsExtracted: jobs.length,
      droppedJobs,
      durationMs: ctx.now().getTime() - startedAt,
      errors,
      warnings,
    };

    const summary: JobSourceSummary = {
      source: "browser_mcp",
      label: "browser_mcp:geekhunter",
      focus: "brazil",
      tier: "brazil_public_api",
      fetchedJobs: jobs.length,
      error: summaryError,
    };

    (summary as { metadata?: Record<string, unknown> }).metadata = {
      siteId: "geekhunter",
      pages: pagesVisited,
      queries: queriesExecuted,
      durationMs: trace.durationMs,
      droppedJobs,
      warnings,
    };

    return { jobs, summary, trace };
  }
}
