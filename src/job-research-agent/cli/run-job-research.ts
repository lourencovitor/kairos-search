import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createJobResearchConfig } from '../config/job-research.config.js';
import type { JobResearchConfig } from '../config/job-research.config.js';
import type { JobResearchRunResult, JobSourceSummary } from '../domain/job.types.js';
import { createDefaultJobResearchAgent } from '../index.js';
import {
  BROWSER_MCP_SITE_IDS,
  type BrowserMcpSiteId,
} from '../sources/browser-mcp/browser-mcp.types.js';

export type ParseArgsResult =
  | { ok: true; value: Partial<JobResearchConfig> }
  | { ok: false; error: string; code: number };

/**
 * Renders the full CLI output as a string (tests call this directly).
 *
 * Canonical line order (Requirement 12.6):
 *   Run ID / Raw jobs fetched / Ranked jobs / Selected jobs / Markdown report /
 *   CSV report / 8 CSV report <group> lines in V2 order /
 *   Browser MCP summary block (only when enabled + at least one browser_mcp summary).
 */
export function formatCliOutput(result: JobResearchRunResult, config: JobResearchConfig): string {
  const lines: string[] = [
    `Run ID: ${result.runId}`,
    `Raw jobs fetched: ${result.totalRawJobs}`,
    `Ranked jobs: ${result.rankedJobs.length}`,
    `Selected jobs: ${result.selectedJobs.length}`,
    `Markdown report: ${path.relative(process.cwd(), result.output.markdownReportPath)}`,
    `CSV report: ${path.relative(process.cwd(), result.output.csvReportPath)}`,
    `CSV report junior: ${formatOptionalPath(result.output.csvReportBySeniorityPaths.junior)}`,
    `CSV report pleno:  ${formatOptionalPath(result.output.csvReportBySeniorityPaths.pleno)}`,
    `CSV report senior: ${formatOptionalPath(result.output.csvReportBySeniorityPaths.senior)}`,
    `CSV report staff:  ${formatOptionalPath(result.output.csvReportBySeniorityPaths.staff)}`,
    `CSV report arq:    ${formatOptionalPath(result.output.csvReportBySeniorityPaths.arq)}`,
    `CSV report qa:     ${formatOptionalPath(result.output.csvReportBySeniorityPaths.qa)}`,
    `CSV report devops: ${formatOptionalPath(result.output.csvReportBySeniorityPaths.devops)}`,
    `CSV report mgmt:   ${formatOptionalPath(result.output.csvReportBySeniorityPaths.management ?? null)}`,
  ];

  const browserMcpBlock = formatBrowserMcpSummaryBlock(result, config);
  if (browserMcpBlock.length > 0) {
    lines.push(...browserMcpBlock);
  }

  return lines.join('\n');
}

export function parseArgs(argv: string[]): ParseArgsResult {
  const overrides: Partial<JobResearchConfig> = {};

  const hasBrowserMcp = argv.includes('--browser-mcp');
  const hasNoBrowserMcp = argv.includes('--no-browser-mcp');

  if (hasBrowserMcp && hasNoBrowserMcp) {
    return { ok: false, error: 'conflicting flags: --browser-mcp and --no-browser-mcp', code: 1 };
  }

  const browserMcpSiteArgs: string[] = [];
  for (const argument of argv) {
    if (argument.startsWith('--browser-mcp-site=')) {
      const id = argument.split('=')[1];
      if (id) browserMcpSiteArgs.push(id);
    }
  }

  for (const id of browserMcpSiteArgs) {
    if (!BROWSER_MCP_SITE_IDS.includes(id as BrowserMcpSiteId)) {
      return {
        ok: false,
        error: `unknown browser-mcp site: ${id}. Valid ids: ${BROWSER_MCP_SITE_IDS.join(', ')}`,
        code: 1,
      };
    }
  }

  for (const argument of argv) {
    if (argument === '--help') {
      return {
        ok: false,
        error:
          'Usage: pnpm job-research [--top=100] [--min-score=50] [--output-dir=data/job-research] [--manual-input-dir=data/manual-inputs]',
        code: 0,
      };
    }

    if (argument.startsWith('--top=')) {
      overrides.reportTopJobs = Number(argument.split('=')[1]);
      continue;
    }

    if (argument.startsWith('--min-score=')) {
      overrides.minReportScore = Number(argument.split('=')[1]);
      continue;
    }

    if (argument.startsWith('--output-dir=')) {
      overrides.outputRootDir = path.resolve(process.cwd(), argument.split('=')[1] ?? '');
      continue;
    }

    if (argument.startsWith('--manual-input-dir=')) {
      overrides.manualInputDir = path.resolve(process.cwd(), argument.split('=')[1] ?? '');
    }
  }

  if (hasBrowserMcp) {
    overrides.browserMcp = {
      ...overrides.browserMcp,
      enabled: true,
    } as JobResearchConfig['browserMcp'];
  }

  if (hasNoBrowserMcp) {
    overrides.browserMcp = {
      ...overrides.browserMcp,
      enabled: false,
    } as JobResearchConfig['browserMcp'];
  }

  if (argv.includes('--browser-mcp-only')) {
    overrides.browserMcp = {
      ...overrides.browserMcp,
      enabled: true,
    } as JobResearchConfig['browserMcp'];
    overrides.programathor = { enabled: false } as JobResearchConfig['programathor'];
    overrides.linkedIn = { enabled: false } as JobResearchConfig['linkedIn'];
    overrides.himalayas = { enabled: false } as JobResearchConfig['himalayas'];
    overrides.getOnBoard = { enabled: false } as JobResearchConfig['getOnBoard'];
    overrides.gupy = { enabled: false } as JobResearchConfig['gupy'];
    overrides.greenhouseBoards = [];
    overrides.leverCompanies = [];
    overrides.ashbyCompanies = [];
    overrides.remotive = { enabled: false };
    overrides.remoteOk = { enabled: false };
    overrides.manualSource = { enabled: false };
  }

  if (argv.includes('--http-only')) {
    overrides.browserMcp = {
      ...overrides.browserMcp,
      enabled: false,
    } as JobResearchConfig['browserMcp'];
  }

  if (browserMcpSiteArgs.length > 0) {
    const enabledIds = new Set(browserMcpSiteArgs as BrowserMcpSiteId[]);
    const sites: Partial<Record<BrowserMcpSiteId, { enabled: boolean }>> = {};
    for (const id of BROWSER_MCP_SITE_IDS) {
      sites[id] = { enabled: enabledIds.has(id) };
    }
    overrides.browserMcp = {
      ...overrides.browserMcp,
      enabled: true,
      sites,
    } as JobResearchConfig['browserMcp'];
  }

  return { ok: true, value: overrides };
}

function formatOptionalPath(filePath: string | null): string {
  return filePath ? path.relative(process.cwd(), filePath) : 'skipped (0 jobs)';
}

/**
 * Builds the Browser MCP summary block. Returns an empty array (omitting the
 * block entirely) when:
 *   - `config.browserMcp.enabled === false`; or
 *   - the filtered list of `source === "browser_mcp"` summaries is empty.
 */
function formatBrowserMcpSummaryBlock(
  result: JobResearchRunResult,
  config: JobResearchConfig,
): string[] {
  if (!config.browserMcp.enabled) {
    return [];
  }

  const browserMcpSummaries = result.sourceSummaries.filter(
    (summary) => summary.source === 'browser_mcp',
  );

  if (browserMcpSummaries.length === 0) {
    return [];
  }

  const lines: string[] = ['Browser MCP summary (enabled):'];
  for (const summary of browserMcpSummaries) {
    const siteId = extractBrowserMcpSiteId(summary);
    const metadata = (summary as { metadata?: Record<string, unknown> }).metadata ?? {};
    const pages = typeof metadata.pages === 'number' ? metadata.pages : 0;
    const queries = typeof metadata.queries === 'number' ? metadata.queries : 0;
    const duration = typeof metadata.durationMs === 'number' ? metadata.durationMs : 0;
    lines.push(
      `  - ${siteId}: fetched=${summary.fetchedJobs}, pages=${pages}, queries=${queries}, duration=${duration}ms`,
    );
  }

  return lines;
}

function extractBrowserMcpSiteId(summary: JobSourceSummary): string {
  const metadataSiteId = (summary as { metadata?: { siteId?: unknown } }).metadata?.siteId;
  if (typeof metadataSiteId === 'string' && metadataSiteId.length > 0) {
    return metadataSiteId;
  }

  const label = summary.label ?? '';
  const prefixMatch = /^browser_mcp:(.+)$/.exec(label);
  if (prefixMatch) {
    return prefixMatch[1] ?? 'unknown';
  }

  const suffixMatch = /^(.+)-browser-mcp$/.exec(label);
  if (suffixMatch) {
    return suffixMatch[1] ?? 'unknown';
  }

  return label || 'unknown';
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    if (parsed.code === 0) {
      console.log(parsed.error);
    } else {
      console.error(parsed.error);
    }
    process.exit(parsed.code);
  }

  try {
    const config = createJobResearchConfig(parsed.value);
    const agent = createDefaultJobResearchAgent(config);
    const result = await agent.run();
    console.log(formatCliOutput(result, config));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Unknown error while running job research',
    );
    process.exit(1);
  }
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  await main();
}
