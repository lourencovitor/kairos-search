import { describe, expect, it } from 'vitest';

import type { BrowserMcpConfig, BrowserMcpSiteId } from '../browser-mcp.types.js';
import { BROWSER_MCP_SITE_IDS } from '../browser-mcp.types.js';
import { SITE_ADAPTER_ORDER, getDisabledSummaries, getSiteAdapters } from './index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConfig(
  overrides: Partial<Record<BrowserMcpSiteId, { enabled: boolean }>> = {},
): BrowserMcpConfig {
  const sites = {} as BrowserMcpConfig['sites'];
  for (const id of BROWSER_MCP_SITE_IDS) {
    sites[id] = {
      enabled: overrides[id]?.enabled ?? false,
      searchQueries: ['test'],
      maxPagesPerQuery: 1,
      rateLimitMs: 1000,
      maxJobs: 50,
    };
  }
  return {
    enabled: true,
    connectTimeoutMs: 5000,
    parallelSites: false,
    globalMaxPages: 50,
    sites,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('site-adapters registry', () => {
  describe('SITE_ADAPTER_ORDER', () => {
    it('has the deterministic fixed order matching BROWSER_MCP_SITE_IDS', () => {
      expect(SITE_ADAPTER_ORDER).toEqual([
        'linkedin',
        'programathor',
        'glassdoor',
        'vagas_com',
        'catho',
        'infojobs_br',
        'gupy_public',
        'trampos_co',
        'revelo',
        'geekhunter',
      ]);
    });
  });

  describe('getSiteAdapters', () => {
    it('returns only enabled adapters that have implementations', () => {
      const config = buildConfig({ linkedin: { enabled: true } });
      const adapters = getSiteAdapters(config);

      expect(adapters).toHaveLength(1);
      expect(adapters[0]?.id).toBe('linkedin');
    });

    it('returns empty array when all sites are disabled', () => {
      const config = buildConfig();
      const adapters = getSiteAdapters(config);

      expect(adapters).toHaveLength(0);
    });

    it('returns all enabled adapters that have implementations', () => {
      const config = buildConfig({
        linkedin: { enabled: true },
        programathor: { enabled: true },
        glassdoor: { enabled: true },
        vagas_com: { enabled: true },
        catho: { enabled: true },
        infojobs_br: { enabled: true },
        gupy_public: { enabled: true },
      });
      const adapters = getSiteAdapters(config);

      // All 7 enabled sites have adapters now
      expect(adapters).toHaveLength(7);
      expect(adapters[0]?.id).toBe('linkedin');
      expect(adapters[1]?.id).toBe('programathor');
      expect(adapters[2]?.id).toBe('glassdoor');
      expect(adapters[3]?.id).toBe('vagas_com');
      expect(adapters[4]?.id).toBe('catho');
      expect(adapters[5]?.id).toBe('infojobs_br');
      expect(adapters[6]?.id).toBe('gupy_public');
    });

    it('preserves deterministic order when multiple adapters are enabled', () => {
      const config = buildConfig({
        linkedin: { enabled: true },
        programathor: { enabled: true },
        revelo: { enabled: true },
      });
      const adapters = getSiteAdapters(config);

      expect(adapters.map((a) => a.id)).toEqual(['linkedin', 'programathor', 'revelo']);
    });
  });

  describe('getDisabledSummaries', () => {
    it("emits 'disabled' error for sites with enabled: false", () => {
      const config = buildConfig({ linkedin: { enabled: true } });
      const summaries = getDisabledSummaries(config);

      // linkedin is enabled and has adapter → not in summaries
      // remaining 9 are disabled → 9 summaries with error: "disabled"
      const disabledSummaries = summaries.filter((s) => s.error === 'disabled');
      expect(disabledSummaries).toHaveLength(9);

      for (const summary of disabledSummaries) {
        expect(summary.fetchedJobs).toBe(0);
        expect(summary.source).toBe('browser_mcp');
        expect(summary.error).toBe('disabled');
      }
    });

    it("emits no 'not_implemented' errors when all adapters are registered", () => {
      const config = buildConfig({
        linkedin: { enabled: true },
        programathor: { enabled: true },
        glassdoor: { enabled: true },
        vagas_com: { enabled: true },
        catho: { enabled: true },
        infojobs_br: { enabled: true },
        gupy_public: { enabled: true },
        trampos_co: { enabled: true },
        revelo: { enabled: true },
      });
      const summaries = getDisabledSummaries(config);

      const notImplemented = summaries.filter((s) => s.error === 'not_implemented');
      expect(notImplemented).toHaveLength(0);
    });

    it('does not emit summary for enabled sites with working adapter', () => {
      const config = buildConfig({ linkedin: { enabled: true } });
      const summaries = getDisabledSummaries(config);

      const linkedinSummary = summaries.find((s) => s.label === 'browser_mcp:linkedin');
      expect(linkedinSummary).toBeUndefined();
    });

    it('preserves deterministic order in summaries', () => {
      const config = buildConfig(); // all disabled
      const summaries = getDisabledSummaries(config);

      expect(summaries.map((s) => s.label)).toEqual([
        'browser_mcp:linkedin',
        'browser_mcp:programathor',
        'browser_mcp:glassdoor',
        'browser_mcp:vagas_com',
        'browser_mcp:catho',
        'browser_mcp:infojobs_br',
        'browser_mcp:gupy_public',
        'browser_mcp:trampos_co',
        'browser_mcp:revelo',
        'browser_mcp:geekhunter',
      ]);
    });

    it('all summaries have correct shape', () => {
      const config = buildConfig();
      const summaries = getDisabledSummaries(config);

      for (const summary of summaries) {
        expect(summary.source).toBe('browser_mcp');
        expect(summary.focus).toBe('global');
        expect(summary.tier).toBe('global_aggregator');
        expect(summary.fetchedJobs).toBe(0);
        expect(summary.label).toMatch(/^browser_mcp:/);
      }
    });
  });
});
