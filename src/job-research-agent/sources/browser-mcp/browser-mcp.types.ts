import type { RawJobPosting, JobSourceSummary } from "../../domain/job.types.js";

export type BrowserMcpToolName =
  | "browser_navigate"
  | "browser_snapshot"
  | "browser_click"
  | "browser_type"
  | "browser_screenshot"
  | "browser_get_console_logs";

export interface BrowserMcpTransport {
  invoke<T = unknown>(tool: BrowserMcpToolName, args: Record<string, unknown>): Promise<T>;
  close(): Promise<void>;
}

export interface BrowserMcpSnapshot {
  url: string;
  title: string;
  domHtml: string;
  accessibilityTree?: unknown;
}

export type BrowserMcpSiteId =
  | "linkedin"
  | "programathor"
  | "glassdoor"
  | "vagas_com"
  | "catho"
  | "infojobs_br"
  | "gupy_public"
  | "trampos_co"
  | "revelo"
  | "geekhunter";

export const BROWSER_MCP_SITE_IDS: readonly BrowserMcpSiteId[] = [
  "linkedin",
  "programathor",
  "glassdoor",
  "vagas_com",
  "catho",
  "infojobs_br",
  "gupy_public",
  "trampos_co",
  "revelo",
  "geekhunter",
] as const;

export interface BrowserMcpSiteConfig {
  enabled: boolean;
  searchQueries: string[];
  maxPagesPerQuery: number;
  rateLimitMs: number;
  maxJobs: number;
  location?: string;
  extraParams?: Record<string, unknown>;
}

export interface BrowserMcpConfig {
  enabled: boolean;
  connectTimeoutMs: number;
  parallelSites: boolean;
  globalMaxPages: number;
  sites: Record<BrowserMcpSiteId, BrowserMcpSiteConfig>;
}

// Forward-declared so SiteAdapterContext can reference it without a circular import.
// The concrete BrowserMcpClient class lives in browser-mcp.client.ts (task 3.2).
export interface BrowserMcpClientLike {
  navigate(siteId: BrowserMcpSiteId, url: string, rateLimitMs: number): Promise<void>;
  snapshot(): Promise<BrowserMcpSnapshot>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  remainingPageBudget(): number;
}

export interface SiteAdapterContext {
  client: BrowserMcpClientLike;
  siteConfig: BrowserMcpSiteConfig;
  signal: AbortSignal;
  now: () => Date;
}

export interface SiteAdapterTraceEntry {
  siteId: BrowserMcpSiteId;
  queriesExecuted: number;
  pagesVisited: number;
  jobsExtracted: number;
  droppedJobs: number;
  durationMs: number;
  errors: string[];
  warnings: string[];
}

export interface SiteAdapterResult {
  jobs: RawJobPosting[];
  summary: JobSourceSummary;
  trace: SiteAdapterTraceEntry;
}

export interface SiteAdapter {
  readonly id: BrowserMcpSiteId;
  readonly defaultConfig: BrowserMcpSiteConfig;
  collect(ctx: SiteAdapterContext): Promise<SiteAdapterResult>;
}

export class ForbiddenSelectorError extends Error {
  constructor(selector: string) {
    super(`Forbidden selector (blacklisted): ${selector}`);
    this.name = "ForbiddenSelectorError";
  }
}

export class GlobalPageBudgetExhaustedError extends Error {
  constructor() {
    super("Global page budget exhausted");
    this.name = "GlobalPageBudgetExhaustedError";
  }
}
