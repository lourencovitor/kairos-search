import { describe, expect, it } from 'vitest';

import path from 'node:path';

import { type JobResearchConfig, createJobResearchConfig } from '../config/job-research.config.js';
import type { JobMarket, JobResearchRunResult, JobSourceSummary } from '../domain/job.types.js';
import { formatCliOutput, parseArgs } from './run-job-research.js';

// Fixture mínima de JobResearchRunResult. Só populamos os campos que o
// formatCliOutput lê; os demais são placeholders válidos para satisfazer o tipo.
function buildRunResult(
  overrides: {
    csvReportBySeniorityPaths?: Partial<
      JobResearchRunResult['output']['csvReportBySeniorityPaths']
    >;
    sourceSummaries?: JobSourceSummary[];
  } = {},
): JobResearchRunResult {
  const marketCounts: Record<JobMarket, number> = {
    brazil: 0,
    brazil_friendly: 0,
    latam: 0,
    international: 0,
    unclear: 0,
  };

  return {
    runId: 'run-123',
    generatedAt: '2026-01-01T00:00:00.000Z',
    totalRawJobs: 0,
    sourceSummaries: overrides.sourceSummaries ?? [],
    selectionSummary: {
      limit: 100,
      minScore: 50,
      desiredPrimaryJobs: 0,
      desiredInternationalJobs: 0,
      usedThresholdFallback: false,
      selectedPrimaryJobs: 0,
      selectedSecondaryJobs: 0,
      selectedWorldwideCompatiblePrimaryJobs: 0,
      filledFromSecondaryBecausePrimaryShortfall: 0,
      marketCounts,
    },
    selectedJobs: [],
    rankedJobs: [],
    rejectedJobs: [],
    output: {
      runDirectory: '/tmp/run-123',
      latestDirectory: '/tmp/latest',
      rawJobsPath: '/tmp/run-123/raw-jobs.json',
      rankedJobsPath: '/tmp/run-123/ranked-jobs.json',
      rejectedJobsPath: '/tmp/run-123/rejected-jobs.json',
      filterFunnelPath: '/tmp/run-123/filter-funnel.json',
      summaryPath: '/tmp/run-123/summary.json',
      markdownReportPath: '/tmp/run-123/report.md',
      csvReportPath: '/tmp/run-123/report.csv',
      csvReportBySeniorityPaths: {
        junior: null,
        pleno: null,
        senior: null,
        staff: null,
        arq: null,
        qa: null,
        devops: null,
        management: null,
        ...overrides.csvReportBySeniorityPaths,
      },
      browserMcpTracePath: null,
    },
  };
}

function buildConfig(
  overrides: {
    browserMcpEnabled?: boolean;
  } = {},
): JobResearchConfig {
  return createJobResearchConfig({
    browserMcp: {
      enabled: overrides.browserMcpEnabled ?? false,
    } as Partial<JobResearchConfig['browserMcp']> as JobResearchConfig['browserMcp'],
  });
}

describe('formatCliOutput — CSV report paths (V2, 8 keys)', () => {
  it('renders all 8 CSV report lines in canonical order when every path is null', () => {
    const result = buildRunResult();
    const config = buildConfig();

    const output = formatCliOutput(result, config);
    const lines = output.split('\n');

    const csvLines = lines.filter((line) => line.startsWith('CSV report '));
    // O primeiro é o "CSV report: ..." (o geral); filtramos só os 8 por-grupo.
    const groupLines = csvLines.filter((line) => !line.startsWith('CSV report:'));

    expect(groupLines).toHaveLength(8);
    expect(groupLines[0]).toMatch(/^CSV report junior: /);
    expect(groupLines[1]).toMatch(/^CSV report pleno:/);
    expect(groupLines[2]).toMatch(/^CSV report senior: /);
    expect(groupLines[3]).toMatch(/^CSV report staff:/);
    expect(groupLines[4]).toMatch(/^CSV report arq:/);
    expect(groupLines[5]).toMatch(/^CSV report qa:/);
    expect(groupLines[6]).toMatch(/^CSV report devops: /);
    expect(groupLines[7]).toMatch(/^CSV report mgmt:/);

    for (const line of groupLines) {
      expect(line).toContain('skipped (0 jobs)');
    }
  });

  it('renders the relative path when the CSV path is non-null', () => {
    const absoluteCsv = path.resolve(process.cwd(), 'data/tmp/report-junior.csv');
    const result = buildRunResult({
      csvReportBySeniorityPaths: { junior: absoluteCsv },
    });
    const config = buildConfig();

    const output = formatCliOutput(result, config);

    expect(output).toContain(`CSV report junior: data/tmp/report-junior.csv`);
    expect(output).toContain('CSV report pleno:  skipped (0 jobs)');
  });
});

describe('formatCliOutput — Browser MCP summary block', () => {
  it('omits the block entirely when config.browserMcp.enabled === false', () => {
    const result = buildRunResult({
      sourceSummaries: [
        {
          source: 'browser_mcp',
          label: 'linkedin-browser-mcp',
          focus: 'global',
          tier: 'global_aggregator',
          fetchedJobs: 42,
        },
      ],
    });
    const config = buildConfig({ browserMcpEnabled: false });

    const output = formatCliOutput(result, config);

    expect(output).not.toContain('Browser MCP summary');
    expect(output).not.toMatch(/^\s+-\s/m);
  });

  it('omits the block when enabled but no browser_mcp summaries exist', () => {
    const result = buildRunResult({
      sourceSummaries: [
        // Summary de outra fonte — não deve ativar o bloco.
        {
          source: 'linkedin',
          label: 'linkedin',
          focus: 'global',
          tier: 'global_aggregator',
          fetchedJobs: 10,
        },
      ],
    });
    const config = buildConfig({ browserMcpEnabled: true });

    const output = formatCliOutput(result, config);

    expect(output).not.toContain('Browser MCP summary');
  });

  it('renders one line per browser_mcp summary with metadata counters', () => {
    const linkedinSummary = {
      source: 'browser_mcp' as const,
      label: 'browser_mcp:linkedin',
      focus: 'global' as const,
      tier: 'global_aggregator' as const,
      fetchedJobs: 42,
      metadata: {
        siteId: 'linkedin',
        pages: 3,
        queries: 2,
        durationMs: 1500,
      },
    };
    const programathorSummary = {
      source: 'browser_mcp' as const,
      label: 'programathor-browser-mcp',
      focus: 'brazil' as const,
      tier: 'brazil_public_api' as const,
      fetchedJobs: 17,
      metadata: {
        // No explicit siteId: derive from the label suffix.
        pages: 5,
        queries: 1,
        durationMs: 900,
      },
    };

    const result = buildRunResult({
      sourceSummaries: [linkedinSummary, programathorSummary],
    });
    const config = buildConfig({ browserMcpEnabled: true });

    const output = formatCliOutput(result, config);

    expect(output).toContain('Browser MCP summary (enabled):');
    expect(output).toContain('  - linkedin: fetched=42, pages=3, queries=2, duration=1500ms');
    expect(output).toContain('  - programathor: fetched=17, pages=5, queries=1, duration=900ms');
  });

  it('defaults missing metadata counters to 0', () => {
    const summary = {
      source: 'browser_mcp' as const,
      label: 'browser_mcp:glassdoor',
      focus: 'global' as const,
      tier: 'global_aggregator' as const,
      fetchedJobs: 0,
      // Sem metadata — pages/queries/duration viram 0.
    };

    const result = buildRunResult({ sourceSummaries: [summary] });
    const config = buildConfig({ browserMcpEnabled: true });

    const output = formatCliOutput(result, config);

    expect(output).toContain('  - glassdoor: fetched=0, pages=0, queries=0, duration=0ms');
  });
});

describe('parseArgs — Browser MCP CLI flags', () => {
  it('--browser-mcp sets browserMcp.enabled=true', () => {
    const result = parseArgs(['--browser-mcp']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.browserMcp?.enabled).toBe(true);
  });

  it('--no-browser-mcp sets browserMcp.enabled=false', () => {
    const result = parseArgs(['--no-browser-mcp']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.browserMcp?.enabled).toBe(false);
  });

  it('--browser-mcp-only enables browser mcp and disables all other sources', () => {
    const result = parseArgs(['--browser-mcp-only']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const overrides = result.value;
    expect(overrides.browserMcp?.enabled).toBe(true);
    expect((overrides.programathor as { enabled: boolean })?.enabled).toBe(false);
    expect((overrides.linkedIn as { enabled: boolean })?.enabled).toBe(false);
    expect((overrides.himalayas as { enabled: boolean })?.enabled).toBe(false);
    expect((overrides.getOnBoard as { enabled: boolean })?.enabled).toBe(false);
    expect((overrides.gupy as { enabled: boolean })?.enabled).toBe(false);
    expect(overrides.greenhouseBoards).toEqual([]);
    expect(overrides.leverCompanies).toEqual([]);
    expect(overrides.ashbyCompanies).toEqual([]);
    expect(overrides.remotive).toEqual({ enabled: false });
    expect(overrides.remoteOk).toEqual({ enabled: false });
    expect(overrides.manualSource).toEqual({ enabled: false });
  });

  it('--browser-mcp-site=linkedin --browser-mcp-site=programathor enables only those two', () => {
    const result = parseArgs(['--browser-mcp-site=linkedin', '--browser-mcp-site=programathor']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const overrides = result.value;
    expect(overrides.browserMcp?.enabled).toBe(true);

    const sites = (overrides.browserMcp as { sites: Record<string, { enabled: boolean }> })?.sites;
    expect(sites.linkedin.enabled).toBe(true);
    expect(sites.programathor.enabled).toBe(true);
    expect(sites.glassdoor.enabled).toBe(false);
    expect(sites.vagas_com.enabled).toBe(false);
    expect(sites.catho.enabled).toBe(false);
    expect(sites.infojobs_br.enabled).toBe(false);
    expect(sites.gupy_public.enabled).toBe(false);
    expect(sites.trampos_co.enabled).toBe(false);
    expect(sites.revelo.enabled).toBe(false);
  });

  it('--browser-mcp-site with invalid id returns error result', () => {
    const result = parseArgs(['--browser-mcp-site=invalid_site']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(1);
      expect(result.error).toContain('unknown browser-mcp site: invalid_site');
    }
  });

  it('conflicting --browser-mcp and --no-browser-mcp returns error result', () => {
    const result = parseArgs(['--browser-mcp', '--no-browser-mcp']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(1);
      expect(result.error).toBe('conflicting flags: --browser-mcp and --no-browser-mcp');
    }
  });

  it('--help returns ok: false with code 0', () => {
    const result = parseArgs(['--help']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(0);
  });
});
