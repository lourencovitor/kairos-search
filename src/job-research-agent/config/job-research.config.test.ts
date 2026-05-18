import { describe, expect, it } from 'vitest';

import type { BrowserMcpSiteId } from '../sources/browser-mcp/browser-mcp.types.js';
import {
  type JobResearchConfig,
  applyExcludeQaRolesOverride,
  createJobResearchConfig,
  defaultJobResearchConfig,
} from './job-research.config.js';

const BROWSER_MCP_SITE_IDS: readonly BrowserMcpSiteId[] = [
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
];

describe('defaultJobResearchConfig — browserMcp defaults', () => {
  it('has browserMcp.enabled === true', () => {
    expect(defaultJobResearchConfig.browserMcp.enabled).toBe(true);
  });

  it('has connectTimeoutMs === 15_000, parallelSites === true, globalMaxPages === 300', () => {
    expect(defaultJobResearchConfig.browserMcp.connectTimeoutMs).toBe(15_000);
    expect(defaultJobResearchConfig.browserMcp.parallelSites).toBe(true);
    expect(defaultJobResearchConfig.browserMcp.globalMaxPages).toBe(300);
  });

  it('exposes all 10 site ids', () => {
    const keys = Object.keys(defaultJobResearchConfig.browserMcp.sites).sort();
    expect(keys).toEqual([...BROWSER_MCP_SITE_IDS].sort());
  });

  it('has enabled === true on all 10 sites', () => {
    for (const id of BROWSER_MCP_SITE_IDS) {
      expect(defaultJobResearchConfig.browserMcp.sites[id].enabled).toBe(true);
    }
  });

  it('has rateLimitMs === 6000 for glassdoor and === 2000 for all other sites', () => {
    expect(defaultJobResearchConfig.browserMcp.sites.glassdoor.rateLimitMs).toBe(6_000);
    for (const id of BROWSER_MCP_SITE_IDS) {
      if (id === 'glassdoor') continue;
      expect(defaultJobResearchConfig.browserMcp.sites[id].rateLimitMs).toBe(2_000);
    }
  });

  it('has maxJobs === 200 on every site', () => {
    for (const id of BROWSER_MCP_SITE_IDS) {
      expect(defaultJobResearchConfig.browserMcp.sites[id].maxJobs).toBe(200);
    }
  });

  it('sets Brazil location hint for linkedin and glassdoor', () => {
    expect(defaultJobResearchConfig.browserMcp.sites.linkedin.location).toBe('Brazil');
    expect(defaultJobResearchConfig.browserMcp.sites.glassdoor.location).toBe('Brazil');
  });
});

describe('defaultJobResearchConfig — QA and per-group targets', () => {
  it('defaults excludeQaRoles to false', () => {
    expect(defaultJobResearchConfig.excludeQaRoles).toBe(false);
  });

  it('defaults seniorityReportTargetJobsByGroup to an empty object', () => {
    expect(defaultJobResearchConfig.seniorityReportTargetJobsByGroup).toEqual({});
  });

  it('does NOT contain "qa engineer" or "quality assurance" in excludedTitleKeywords', () => {
    const normalized = defaultJobResearchConfig.excludedTitleKeywords.map((term) =>
      term.toLowerCase(),
    );
    expect(normalized).not.toContain('qa engineer');
    expect(normalized).not.toContain('quality assurance');
  });
});

describe('applyExcludeQaRolesOverride', () => {
  it('returns the config unchanged when excludeQaRoles === false', () => {
    const base = createJobResearchConfig();
    const result = applyExcludeQaRolesOverride(base);
    expect(result).toBe(base);
    expect(result.excludedTitleKeywords).toBe(base.excludedTitleKeywords);
  });

  it('adds both QA terms back when excludeQaRoles === true', () => {
    const overridden: JobResearchConfig = createJobResearchConfig({ excludeQaRoles: true });
    const result = applyExcludeQaRolesOverride(overridden);
    const lowered = result.excludedTitleKeywords.map((term) => term.toLowerCase());
    expect(lowered).toContain('qa engineer');
    expect(lowered).toContain('quality assurance');
  });

  it('is idempotent — duplicate terms are not added on a second pass', () => {
    const overridden: JobResearchConfig = createJobResearchConfig({ excludeQaRoles: true });
    const once = applyExcludeQaRolesOverride(overridden);
    const twice = applyExcludeQaRolesOverride(once);

    const countQaEngineer = twice.excludedTitleKeywords.filter(
      (term) => term.toLowerCase() === 'qa engineer',
    ).length;
    const countQualityAssurance = twice.excludedTitleKeywords.filter(
      (term) => term.toLowerCase() === 'quality assurance',
    ).length;

    expect(countQaEngineer).toBe(1);
    expect(countQualityAssurance).toBe(1);
  });
});

describe('createJobResearchConfig — deep merge of browserMcp', () => {
  it('deep-merges a partial browserMcp override without wiping the other 9 sites', () => {
    const config = createJobResearchConfig({
      browserMcp: {
        enabled: true,
        sites: {
          linkedin: { enabled: true },
        },
      } as unknown as JobResearchConfig['browserMcp'],
    });

    // Top-level flag stays on.
    expect(config.browserMcp.enabled).toBe(true);

    // Overridden site preserves its other defaults.
    expect(config.browserMcp.sites.linkedin.enabled).toBe(true);
    expect(config.browserMcp.sites.linkedin.rateLimitMs).toBe(2_000);
    expect(config.browserMcp.sites.linkedin.maxJobs).toBe(200);
    expect(config.browserMcp.sites.linkedin.location).toBe('Brazil');
    expect(config.browserMcp.sites.linkedin.searchQueries.length).toBeGreaterThan(0);

    // All 10 keys still present.
    const keys = Object.keys(config.browserMcp.sites).sort();
    expect(keys).toEqual([...BROWSER_MCP_SITE_IDS].sort());

    // Non-overridden sites keep default shape.
    for (const id of BROWSER_MCP_SITE_IDS) {
      if (id === 'linkedin') continue;
      const site = config.browserMcp.sites[id];
      expect(site.enabled).toBe(true);
      expect(site.maxJobs).toBe(200);
      expect(typeof site.rateLimitMs).toBe('number');
      expect(site.rateLimitMs).toBe(id === 'glassdoor' ? 6_000 : 2_000);
      expect(Array.isArray(site.searchQueries)).toBe(true);
      expect(site.searchQueries.length).toBeGreaterThan(0);
      expect(typeof site.maxPagesPerQuery).toBe('number');
    }

    // Preserves other untouched top-level defaults.
    expect(config.browserMcp.connectTimeoutMs).toBe(15_000);
    expect(config.browserMcp.parallelSites).toBe(true);
    expect(config.browserMcp.globalMaxPages).toBe(300);
  });

  it('shallow-merges seniorityReportTargetJobsByGroup', () => {
    const config = createJobResearchConfig({
      seniorityReportTargetJobsByGroup: { qa: 25, devops: 40 },
    });
    expect(config.seniorityReportTargetJobsByGroup).toEqual({ qa: 25, devops: 40 });
  });
});
