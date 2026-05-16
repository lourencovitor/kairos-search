import type { JobSourceSummary } from "../../../domain/job.types.js";
import type {
  BrowserMcpConfig,
  BrowserMcpSiteId,
  SiteAdapter,
} from "../browser-mcp.types.js";
import { BROWSER_MCP_SITE_IDS } from "../browser-mcp.types.js";

import { CathoAdapter } from "./catho.adapter.js";
import { GlassdoorAdapter } from "./glassdoor.adapter.js";
import { GupyPublicAdapter } from "./gupy-public.adapter.js";
import { GeekHunterAdapter } from "./geekhunter.adapter.js";
import { InfoJobsBrAdapter } from "./infojobs-br.adapter.js";
import { LinkedInAdapter } from "./linkedin.adapter.js";
import { ProgramaThorAdapter } from "./programathor.adapter.js";
import { ReveloAdapter } from "./revelo.adapter.js";
import { TramposCoAdapter } from "./trampos-co.adapter.js";
import { VagasComAdapter } from "./vagas-com.adapter.js";

// ---------------------------------------------------------------------------
// Deterministic order for site adapters (Requirement 3.7).
// This order is fixed and independent of config iteration order.
// ---------------------------------------------------------------------------

export const SITE_ADAPTER_ORDER: readonly BrowserMcpSiteId[] = BROWSER_MCP_SITE_IDS;

// ---------------------------------------------------------------------------
// Adapter factory map — only sites with implemented adapters are registered.
// Phase B: linkedin. Phase C will add the remaining 8.
// ---------------------------------------------------------------------------

const ADAPTER_FACTORIES: Partial<Record<BrowserMcpSiteId, () => SiteAdapter>> = {
  linkedin: () => new LinkedInAdapter(),
  programathor: () => new ProgramaThorAdapter(),
  glassdoor: () => new GlassdoorAdapter(),
  vagas_com: () => new VagasComAdapter(),
  catho: () => new CathoAdapter(),
  infojobs_br: () => new InfoJobsBrAdapter(),
  gupy_public: () => new GupyPublicAdapter(),
  trampos_co: () => new TramposCoAdapter(),
  revelo: () => new ReveloAdapter(),
  geekhunter: () => new GeekHunterAdapter(),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the list of enabled site adapters in deterministic order.
 * Sites that are enabled but don't have an adapter yet emit a
 * "not_implemented" summary (via `getDisabledSummaries`) and are excluded
 * from the returned array.
 */
export function getSiteAdapters(config: BrowserMcpConfig): SiteAdapter[] {
  const adapters: SiteAdapter[] = [];

  for (const siteId of SITE_ADAPTER_ORDER) {
    const siteConfig = config.sites[siteId];
    if (!siteConfig?.enabled) {
      continue;
    }

    const factory = ADAPTER_FACTORIES[siteId];
    if (!factory) {
      // Not implemented yet — summary emitted via getDisabledSummaries
      continue;
    }

    adapters.push(factory());
  }

  return adapters;
}

/**
 * Returns synthetic `JobSourceSummary` entries for sites that are either
 * disabled or not yet implemented. The engine merges these into the final
 * summary to preserve per-site granularity (Requirement 3.3).
 */
export function getDisabledSummaries(config: BrowserMcpConfig): JobSourceSummary[] {
  const summaries: JobSourceSummary[] = [];

  for (const siteId of SITE_ADAPTER_ORDER) {
    const siteConfig = config.sites[siteId];

    if (!siteConfig?.enabled) {
      summaries.push({
        source: "browser_mcp",
        label: `browser_mcp:${siteId}`,
        focus: "global",
        tier: "global_aggregator",
        fetchedJobs: 0,
        error: "disabled",
      });
      continue;
    }

    // Enabled but no adapter yet
    const factory = ADAPTER_FACTORIES[siteId];
    if (!factory) {
      summaries.push({
        source: "browser_mcp",
        label: `browser_mcp:${siteId}`,
        focus: "global",
        tier: "global_aggregator",
        fetchedJobs: 0,
        error: "not_implemented",
      });
    }
  }

  return summaries;
}
