// ---------------------------------------------------------------------------
// Property 2 — URL round-trip
// Feature: browsermcp-job-search-engine, Property 2: URL round-trip nas saídas da engine
// ---------------------------------------------------------------------------

import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { normalizeJobUrl } from '../../../shared/job.util.js';
import type { BrowserMcpClientLike, BrowserMcpSiteConfig } from '../browser-mcp.types.js';
import { APPLY_BUTTON_SELECTORS, VagasComAdapter } from './vagas-com.adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(name: string): string {
  const filePath = path.resolve(process.cwd(), 'test-fixtures', 'browser-mcp', 'vagas-com', name);
  return readFileSync(filePath, 'utf-8');
}

function buildMockClient(fixtureHtml: string): BrowserMcpClientLike & {
  navigate: ReturnType<typeof vi.fn>;
  snapshot: ReturnType<typeof vi.fn>;
  click: ReturnType<typeof vi.fn>;
  type: ReturnType<typeof vi.fn>;
  remainingPageBudget: ReturnType<typeof vi.fn>;
} {
  return {
    navigate: vi.fn(async () => {}),
    snapshot: vi.fn(async () => ({
      url: 'https://www.vagas.com.br/vagas-de-desenvolvedor',
      title: 'Vagas de Desenvolvedor | Vagas.com.br',
      domHtml: fixtureHtml,
    })),
    click: vi.fn(async () => {}),
    type: vi.fn(async () => {}),
    remainingPageBudget: vi.fn(() => 100),
  };
}

function buildSiteConfig(overrides: Partial<BrowserMcpSiteConfig> = {}): BrowserMcpSiteConfig {
  return {
    enabled: true,
    searchQueries: ['desenvolvedor'],
    maxPagesPerQuery: 1,
    rateLimitMs: 0,
    maxJobs: 200,
    ...overrides,
  };
}

function buildContext(
  client: BrowserMcpClientLike,
  siteConfig: BrowserMcpSiteConfig,
): {
  client: BrowserMcpClientLike;
  siteConfig: BrowserMcpSiteConfig;
  signal: AbortSignal;
  now: () => Date;
} {
  const controller = new AbortController();
  let tick = 0;
  return {
    client,
    siteConfig,
    signal: controller.signal,
    now: () => new Date(1_700_000_000_000 + tick++ * 10),
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('VagasComAdapter happy-path fixture', () => {
  it('extrai 3 vagas com shape canônico', async () => {
    const client = buildMockClient(loadFixture('happy-path.html'));
    const adapter = new VagasComAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    expect(result.jobs).toHaveLength(3);
    expect(result.summary.error).toBeUndefined();
    expect(result.summary.fetchedJobs).toBe(3);

    for (const job of result.jobs) {
      expect(job.source).toBe('browser_mcp');
      expect(job.sourceBoard).toBe('vagas-com-browser-mcp');
      expect(job.sourceType).toBe('aggregator');
      expect(job.sourceFocus).toBe('brazil');
      expect(job.sourceTier).toBe('brazil_public_api');
      expect(job.sourceQualityRank).toBe(16);
      expect(job.sourceId).toMatch(/^vagas_com:\d+$/);
      expect(job.url).toContain('vagas.com.br');
      expect(() => new URL(job.url)).not.toThrow();
      expect(job.companyName.length).toBeGreaterThan(0);
      expect(job.title.length).toBeGreaterThan(0);
      expect(job.descriptionText).toBe('');
      expect(job.tags).toEqual([]);
      expect(job.regionHints).toEqual([]);
      expect(job.restrictionHints).toEqual([]);
      expect(job.curationNotes).toEqual([]);
      expect(job.raw).toBeNull();
      expect(job.metadata).toEqual({
        browserMcp: { siteId: 'vagas_com', query: 'desenvolvedor' },
      });
    }

    const ids = result.jobs.map((j) => j.sourceId);
    expect(ids).toEqual(['vagas_com:2345678', 'vagas_com:9876543', 'vagas_com:1112233']);
  });

  it('não clica em nenhum seletor (incluindo os de Apply) durante o happy-path', async () => {
    const client = buildMockClient(loadFixture('happy-path.html'));
    const adapter = new VagasComAdapter();

    await adapter.collect(buildContext(client, buildSiteConfig()));

    expect(client.click).toHaveBeenCalledTimes(0);
    for (const applySelector of APPLY_BUTTON_SELECTORS) {
      expect(client.click).not.toHaveBeenCalledWith(applySelector);
    }
  });
});

// ---------------------------------------------------------------------------
// Login wall
// ---------------------------------------------------------------------------

describe('VagasComAdapter login-wall fixture', () => {
  it('marca requires_manual_login e retorna zero vagas sem tentar mais páginas', async () => {
    const client = buildMockClient(loadFixture('login-wall.html'));
    const adapter = new VagasComAdapter();

    const result = await adapter.collect(
      buildContext(client, buildSiteConfig({ maxPagesPerQuery: 5 })),
    );

    expect(result.jobs).toHaveLength(0);
    expect(result.summary.error).toBe('requires_manual_login');
    expect(client.navigate).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Captcha
// ---------------------------------------------------------------------------

describe('VagasComAdapter captcha fixture', () => {
  it('marca rate_limited_or_captcha e retorna zero vagas', async () => {
    const client = buildMockClient(loadFixture('captcha.html'));
    const adapter = new VagasComAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    expect(result.jobs).toHaveLength(0);
    expect(result.summary.error).toBe('rate_limited_or_captcha');
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('VagasComAdapter pagination', () => {
  it('navega para ?pagina=N em páginas subsequentes', async () => {
    const client = buildMockClient(loadFixture('happy-path.html'));
    const adapter = new VagasComAdapter();

    await adapter.collect(buildContext(client, buildSiteConfig({ maxPagesPerQuery: 3 })));

    expect(client.navigate).toHaveBeenCalledTimes(3);

    // First page: no pagina param
    const firstUrl = client.navigate.mock.calls[0][1] as string;
    expect(firstUrl).toContain('vagas-de-desenvolvedor');
    expect(firstUrl).not.toContain('pagina=');

    // Second page
    const secondUrl = client.navigate.mock.calls[1][1] as string;
    expect(secondUrl).toContain('pagina=2');

    // Third page
    const thirdUrl = client.navigate.mock.calls[2][1] as string;
    expect(thirdUrl).toContain('pagina=3');
  });
});

// ---------------------------------------------------------------------------
// marketHint
// ---------------------------------------------------------------------------

describe('VagasComAdapter marketHint', () => {
  it("define marketHint='brazil' quando locationText contém termos brasileiros", async () => {
    const client = buildMockClient(loadFixture('happy-path.html'));
    const adapter = new VagasComAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    // "São Paulo, SP" → brazil
    expect(result.jobs[0].marketHint).toBe('brazil');
    // "Remoto - Brasil" → brazil
    expect(result.jobs[1].marketHint).toBe('brazil');
    // "Rio de Janeiro, RJ" → brazil
    expect(result.jobs[2].marketHint).toBe('brazil');
  });

  it('não define marketHint quando locationText não contém termos brasileiros', async () => {
    const htmlWithForeignLocation = `
      <section>
        <a class="link-detalhes-vaga" title="Frontend Dev" href="/vagas/v55555-frontend-dev">
          <span class="emprVaga">ForeignCo</span>
          <span class="vaga-local">New York, USA</span>
        </a>
      </section>
    `;
    const client = buildMockClient(htmlWithForeignLocation);
    const adapter = new VagasComAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].marketHint).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sourceId deduplication
// ---------------------------------------------------------------------------

describe('VagasComAdapter sourceId deduplication', () => {
  it('produz o mesmo array de sourceId em duas chamadas sucessivas', async () => {
    const adapter = new VagasComAdapter();

    const client1 = buildMockClient(loadFixture('happy-path.html'));
    const result1 = await adapter.collect(buildContext(client1, buildSiteConfig()));

    const client2 = buildMockClient(loadFixture('happy-path.html'));
    const result2 = await adapter.collect(buildContext(client2, buildSiteConfig()));

    const ids1 = result1.jobs.map((j) => j.sourceId);
    const ids2 = result2.jobs.map((j) => j.sourceId);
    expect(ids1).toEqual(ids2);
  });

  it('deduplica dentro do mesmo ciclo quando a mesma vaga aparece em páginas/queries diferentes', async () => {
    const html = loadFixture('happy-path.html');
    const client = buildMockClient(html);
    const adapter = new VagasComAdapter();

    const result = await adapter.collect(
      buildContext(
        client,
        buildSiteConfig({
          searchQueries: ['desenvolvedor', 'engenheiro de software'],
          maxPagesPerQuery: 2,
        }),
      ),
    );

    // 2 queries × 2 pages = 4 navigations, but only 3 unique jobs
    expect(client.navigate).toHaveBeenCalledTimes(4);
    expect(result.jobs).toHaveLength(3);
    const ids = result.jobs.map((j) => j.sourceId);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('Property 2 — URL round-trip', () => {
  // **Validates: Requirements 5.2, 15.2**

  const jobIdArb = fc.stringMatching(/^\d{4,10}$/);

  const slugArb = fc.stringMatching(/^[a-z][a-z-]{1,10}[a-z]$/);

  function buildVagasComHtml(jobId: string, slug: string): string {
    return `
      <section>
        <a class="link-detalhes-vaga" title="Test Engineer" href="/vagas/v${jobId}-${slug}">
          <span class="emprVaga">Test Corp</span>
          <span class="vaga-local">São Paulo, SP</span>
        </a>
      </section>
    `;
  }

  it(
    'URLs emitidas são válidas, absolutas e normalizeJobUrl é idempotente',
    { timeout: 30_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(jobIdArb, slugArb, async (jobId, slug) => {
          const html = buildVagasComHtml(jobId, slug);
          const client: BrowserMcpClientLike = {
            navigate: vi.fn(async () => {}),
            snapshot: vi.fn(async () => ({
              url: 'https://www.vagas.com.br/vagas/',
              title: 'Vagas | Vagas.com.br',
              domHtml: html,
            })),
            click: vi.fn(async () => {}),
            type: vi.fn(async () => {}),
            remainingPageBudget: vi.fn(() => 100),
          };

          const adapter = new VagasComAdapter();
          const result = await adapter.collect(buildContext(client, buildSiteConfig()));

          for (const job of result.jobs) {
            // (a) new URL(job.url) não lança
            const parsed = new URL(job.url);

            // (b) URL é absoluta
            expect(parsed.href).toBe(job.url);

            // (c) normalizeJobUrl é idempotente
            const once = normalizeJobUrl(job.url, job.sourceId);
            const twice = normalizeJobUrl(once, job.sourceId);
            expect(twice).toBe(once);
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});
