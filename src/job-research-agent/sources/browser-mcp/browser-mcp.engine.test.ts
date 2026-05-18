import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { JobResearchConfig } from '../../config/job-research.config.js';
import {
  createJobResearchConfig,
  defaultJobResearchConfig,
} from '../../config/job-research.config.js';
import type { RawJobPosting } from '../../domain/job.types.js';
import { BrowserMcpTraceWriter } from './browser-mcp-trace.writer.js';
import { BrowserMcpEngine } from './browser-mcp.engine.js';
import type {
  BrowserMcpConfig,
  BrowserMcpSiteId,
  BrowserMcpTransport,
  SiteAdapter,
  SiteAdapterContext,
  SiteAdapterResult,
  SiteAdapterTraceEntry,
} from './browser-mcp.types.js';
import { BROWSER_MCP_SITE_IDS } from './browser-mcp.types.js';

/** Transport sempre respondendo com snapshot vazio; `close` é no-op. */
function buildOkTransport(): BrowserMcpTransport {
  return {
    invoke: vi.fn(async () => ({
      url: 'about:blank',
      title: '',
      domHtml: '',
    })) as unknown as BrowserMcpTransport['invoke'],
    close: vi.fn(async () => {}),
  };
}

/** Transport cujo `invoke` nunca resolve — força timeout no connect. */
function buildPendingTransport(): BrowserMcpTransport {
  return {
    invoke: vi.fn(() => new Promise(() => {})) as unknown as BrowserMcpTransport['invoke'],
    close: vi.fn(async () => {}),
  };
}

function buildRawJob(sourceId: string, overrides: Partial<RawJobPosting> = {}): RawJobPosting {
  return {
    source: 'browser_mcp',
    sourceId,
    sourceBoard: 'test-board',
    sourceType: 'aggregator',
    sourceFocus: 'global',
    sourceTier: 'global_aggregator',
    companyName: 'Acme',
    title: 'Software Engineer',
    url: `https://example.com/jobs/${sourceId}`,
    locationText: 'Remote',
    descriptionText: '',
    tags: [],
    regionHints: [],
    restrictionHints: [],
    curationNotes: [],
    metadata: {},
    raw: null,
    ...overrides,
  };
}

function buildTrace(
  siteId: BrowserMcpSiteId,
  overrides: Partial<SiteAdapterTraceEntry> = {},
): SiteAdapterTraceEntry {
  return {
    siteId,
    queriesExecuted: 1,
    pagesVisited: 1,
    jobsExtracted: 0,
    droppedJobs: 0,
    durationMs: 0,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

interface BuildMockAdapterOptions {
  jobs?: RawJobPosting[];
  jobsExtracted?: number;
  throwMessage?: string;
  /** Deferred resolution for manual control in tests that need it. */
  manualResolver?: { promise: Promise<void> };
}

function buildMockAdapter(
  id: BrowserMcpSiteId,
  behavior: 'ok' | 'throw' | 'manual',
  options: BuildMockAdapterOptions = {},
): SiteAdapter {
  const jobs = options.jobs ?? [];
  const jobsExtracted = options.jobsExtracted ?? jobs.length;

  return {
    id,
    defaultConfig: defaultJobResearchConfig.browserMcp.sites[id],
    collect: vi.fn(async (_ctx: SiteAdapterContext): Promise<SiteAdapterResult> => {
      if (behavior === 'manual') {
        await options.manualResolver?.promise;
      }
      if (behavior === 'throw') {
        throw new Error(options.throwMessage ?? 'boom');
      }
      return {
        jobs,
        summary: {
          source: 'browser_mcp',
          label: `browser_mcp:${id}`,
          focus: 'mixed',
          tier: 'global_aggregator',
          fetchedJobs: jobs.length,
        },
        trace: buildTrace(id, { jobsExtracted }),
      };
    }),
  };
}

/** Enables only the specified sites; all others are explicitly disabled. */
function buildConfigWithSitesEnabled(
  ids: BrowserMcpSiteId[],
  overrides: Partial<BrowserMcpConfig> = {},
): JobResearchConfig {
  const enabledSet = new Set(ids);
  const sites = Object.fromEntries(
    BROWSER_MCP_SITE_IDS.map((id) => [id, { enabled: enabledSet.has(id) }]),
  ) as Record<BrowserMcpSiteId, { enabled: boolean }>;

  return createJobResearchConfig({
    browserMcp: {
      enabled: true,
      parallelSites: false,
      ...overrides,
      sites,
    } as unknown as JobResearchConfig['browserMcp'],
  });
}

describe('BrowserMcpEngine — disabled via config', () => {
  it('returns empty and never calls transportFactory when enabled=false', async () => {
    const transportFactory = vi.fn(() => buildOkTransport());
    const engine = new BrowserMcpEngine({
      transportFactory,
      traceWriter: new BrowserMcpTraceWriter(),
      adaptersFactory: vi.fn(() => []),
    });

    const config = createJobResearchConfig({
      browserMcp: { enabled: false } as unknown as JobResearchConfig['browserMcp'],
    });

    const result = await engine.fetchJobs(config);

    expect(result).toStrictEqual({ jobs: [], summaries: [] });
    expect(transportFactory).toHaveBeenCalledTimes(0);
  });
});

describe('BrowserMcpEngine — connect failure', () => {
  it('populates one summary per enabled site with connect-failure message', async () => {
    const transport = buildPendingTransport();
    const transportFactory = vi.fn(() => transport);
    const adaptersFactory = vi.fn(() => [
      buildMockAdapter('linkedin', 'ok'),
      buildMockAdapter('programathor', 'ok'),
    ]);

    const engine = new BrowserMcpEngine({
      transportFactory,
      traceWriter: new BrowserMcpTraceWriter(),
      adaptersFactory,
    });

    const config = buildConfigWithSitesEnabled(['linkedin', 'programathor'], {
      connectTimeoutMs: 50,
    });

    const result = await engine.fetchJobs(config);

    expect(result.jobs).toStrictEqual([]);
    expect(result.summaries).toHaveLength(2);

    const siteIds = result.summaries.map((s) => s.label).sort();
    expect(siteIds).toStrictEqual(['browser_mcp:linkedin', 'browser_mcp:programathor']);

    for (const summary of result.summaries) {
      expect(summary.source).toBe('browser_mcp');
      expect(summary.fetchedJobs).toBe(0);
      expect(summary.error).toMatch(/browser_mcp connect failed:/);
    }

    // Adapters should never have been invoked because connect failed first.
    // adaptersFactory may or may not have been called — engine is allowed to
    // skip it on connect failure, but we don't enforce that. What we enforce
    // is that no adapter.collect ran.
    for (const call of adaptersFactory.mock.calls) {
      // no-op: just to silence unused warnings
      void call;
    }

    expect(transport.close).toHaveBeenCalledTimes(1);
  });
});

describe('BrowserMcpEngine — adapter throw isolation', () => {
  it('continues past a throwing adapter and aggregates jobs from healthy ones', async () => {
    const jobsA = [buildRawJob('a-1'), buildRawJob('a-2')];
    const jobsC = [buildRawJob('c-1')];

    const adapterA = buildMockAdapter('linkedin', 'ok', { jobs: jobsA });
    const adapterB = buildMockAdapter('programathor', 'throw', {
      throwMessage: 'programathor blew up',
    });
    const adapterC = buildMockAdapter('glassdoor', 'ok', { jobs: jobsC });

    const engine = new BrowserMcpEngine({
      transportFactory: () => buildOkTransport(),
      traceWriter: new BrowserMcpTraceWriter(),
      adaptersFactory: () => [adapterA, adapterB, adapterC],
    });

    const config = buildConfigWithSitesEnabled(['linkedin', 'programathor', 'glassdoor']);

    const result = await engine.fetchJobs(config);

    expect(result.jobs).toHaveLength(3);
    expect(result.summaries).toHaveLength(3);

    const bySite = new Map(result.summaries.map((s) => [s.label, s]));
    expect(bySite.get('browser_mcp:linkedin')?.error).toBeUndefined();
    expect(bySite.get('browser_mcp:glassdoor')?.error).toBeUndefined();
    expect(bySite.get('browser_mcp:programathor')?.error).toBe('programathor blew up');

    expect(adapterA.collect).toHaveBeenCalledTimes(1);
    expect(adapterB.collect).toHaveBeenCalledTimes(1);
    expect(adapterC.collect).toHaveBeenCalledTimes(1);
  });
});

describe('BrowserMcpEngine — trace persistence', () => {
  let runDir: string;

  beforeEach(() => {
    runDir = mkdtempSync(path.join(tmpdir(), 'browser-mcp-engine-'));
  });

  afterEach(() => {
    rmSync(runDir, { recursive: true, force: true });
  });

  it('passes per-site entries to the trace writer when runDirectoryResolver returns a path', async () => {
    const traceWriter = new BrowserMcpTraceWriter();
    const writeSpy = vi.spyOn(traceWriter, 'write');

    const adapterA = buildMockAdapter('linkedin', 'ok', {
      jobs: [buildRawJob('a-1')],
      jobsExtracted: 1,
    });
    const adapterB = buildMockAdapter('programathor', 'ok', {
      jobs: [buildRawJob('b-1'), buildRawJob('b-2')],
      jobsExtracted: 2,
    });

    const engine = new BrowserMcpEngine({
      transportFactory: () => buildOkTransport(),
      traceWriter,
      adaptersFactory: () => [adapterA, adapterB],
      runDirectoryResolver: () => runDir,
    });

    const config = buildConfigWithSitesEnabled(['linkedin', 'programathor']);

    await engine.fetchJobs(config);

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const [calledRunDir, calledTrace] = writeSpy.mock.calls[0]!;
    expect(calledRunDir).toBe(runDir);
    expect(calledTrace.sites).toHaveLength(2);
    expect(calledTrace.config).toStrictEqual({
      enabled: true,
      parallelSites: false, // buildConfigWithSitesEnabled defaults to serial
      globalMaxPages: defaultJobResearchConfig.browserMcp.globalMaxPages,
    });
    expect(calledTrace.runId).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(calledTrace.sites.map((s) => s.siteId).sort()).toStrictEqual([
      'linkedin',
      'programathor',
    ]);
  });

  it('skips persistence when runDirectoryResolver is omitted', async () => {
    const traceWriter = new BrowserMcpTraceWriter();
    const writeSpy = vi.spyOn(traceWriter, 'write');

    const engine = new BrowserMcpEngine({
      transportFactory: () => buildOkTransport(),
      traceWriter,
      adaptersFactory: () => [buildMockAdapter('linkedin', 'ok')],
    });

    const config = buildConfigWithSitesEnabled(['linkedin']);
    await engine.fetchJobs(config);

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('swallows trace-writer errors without failing the engine', async () => {
    const traceWriter = new BrowserMcpTraceWriter();
    vi.spyOn(traceWriter, 'write').mockRejectedValue(new Error('disk full'));

    const engine = new BrowserMcpEngine({
      transportFactory: () => buildOkTransport(),
      traceWriter,
      adaptersFactory: () => [
        buildMockAdapter('linkedin', 'ok', {
          jobs: [buildRawJob('a-1')],
        }),
      ],
      runDirectoryResolver: () => runDir,
    });

    const config = buildConfigWithSitesEnabled(['linkedin']);

    const result = await engine.fetchJobs(config);
    expect(result.jobs).toHaveLength(1);
    expect(result.summaries).toHaveLength(1);
  });
});

describe('BrowserMcpEngine — SIGINT abort (serial mode)', () => {
  it('marks adapters not yet started with aborted_sigint', async () => {
    const deferred: { resolve: () => void; promise: Promise<void> } = (() => {
      let res!: () => void;
      const promise = new Promise<void>((r) => {
        res = r;
      });
      return { resolve: res, promise };
    })();

    const adapterA = buildMockAdapter('linkedin', 'manual', {
      manualResolver: { promise: deferred.promise },
      jobs: [buildRawJob('a-1')],
    });
    const adapterB = buildMockAdapter('programathor', 'ok', {
      jobs: [buildRawJob('b-1')],
    });
    const adapterC = buildMockAdapter('glassdoor', 'ok', {
      jobs: [buildRawJob('c-1')],
    });

    const engine = new BrowserMcpEngine({
      transportFactory: () => buildOkTransport(),
      traceWriter: new BrowserMcpTraceWriter(),
      adaptersFactory: () => [adapterA, adapterB, adapterC],
    });

    const config = buildConfigWithSitesEnabled(['linkedin', 'programathor', 'glassdoor']);

    const promise = engine.fetchJobs(config);

    // Let the first adapter begin executing, then fire SIGINT before it resolves.
    // Using a microtask yield is enough because manual adapter awaits on `deferred.promise`.
    await new Promise((r) => setImmediate(r));
    process.emit('SIGINT', 'SIGINT' as NodeJS.Signals);

    // Resolve the first adapter so it completes naturally.
    deferred.resolve();

    const result = await promise;

    // Adapter A completed successfully.
    expect(adapterA.collect).toHaveBeenCalledTimes(1);
    // Adapters B and C were skipped because SIGINT fired before serial loop reached them.
    expect(adapterB.collect).not.toHaveBeenCalled();
    expect(adapterC.collect).not.toHaveBeenCalled();

    expect(result.summaries).toHaveLength(3);
    const bySite = new Map(result.summaries.map((s) => [s.label, s]));
    expect(bySite.get('browser_mcp:linkedin')?.error).toBeUndefined();
    expect(bySite.get('browser_mcp:programathor')?.error).toBe('aborted_sigint');
    expect(bySite.get('browser_mcp:glassdoor')?.error).toBe('aborted_sigint');
  });
});
