import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { BrowserMcpClientLike, BrowserMcpSiteConfig } from "../browser-mcp.types.js";

import { APPLY_BUTTON_SELECTORS, GupyPublicAdapter } from "./gupy-public.adapter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(name: string): string {
  const filePath = path.resolve(
    process.cwd(),
    "test-fixtures",
    "browser-mcp",
    "gupy-public",
    name,
  );
  return readFileSync(filePath, "utf-8");
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
      url: "https://portal.gupy.io/job-search/term=desenvolvedor",
      title: "Vagas | Gupy",
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
    searchQueries: ["desenvolvedor"],
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

describe("GupyPublicAdapter happy-path fixture", () => {
  it("extrai 3 vagas com shape canônico", async () => {
    const client = buildMockClient(loadFixture("happy-path.html"));
    const adapter = new GupyPublicAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    expect(result.jobs).toHaveLength(3);
    expect(result.summary.error).toBeUndefined();
    expect(result.summary.fetchedJobs).toBe(3);

    for (const job of result.jobs) {
      expect(job.source).toBe("browser_mcp");
      expect(job.sourceBoard).toBe("gupy-public-browser-mcp");
      expect(job.sourceType).toBe("aggregator");
      expect(job.sourceFocus).toBe("brazil");
      expect(job.sourceTier).toBe("brazil_public_api");
      expect(job.sourceQualityRank).toBe(11);
      expect(job.sourceId).toMatch(/^gupy_public:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(job.url).toContain("jobs.gupy.io");
      expect(() => new URL(job.url)).not.toThrow();
      expect(job.companyName.length).toBeGreaterThan(0);
      expect(job.title.length).toBeGreaterThan(0);
      expect(job.descriptionText).toBe("");
      expect(job.tags).toEqual([]);
      expect(job.regionHints).toEqual([]);
      expect(job.restrictionHints).toEqual([]);
      expect(job.curationNotes).toEqual([]);
      expect(job.raw).toBeNull();
      expect(job.metadata).toEqual({
        browserMcp: { siteId: "gupy_public", query: "desenvolvedor" },
      });
    }

    const ids = result.jobs.map((j) => j.sourceId);
    expect(ids).toEqual([
      "gupy_public:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "gupy_public:b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "gupy_public:c3d4e5f6-a7b8-9012-cdef-123456789012",
    ]);
  });

  it("não clica em nenhum seletor (incluindo os de Apply) durante o happy-path", async () => {
    const client = buildMockClient(loadFixture("happy-path.html"));
    const adapter = new GupyPublicAdapter();

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

describe("GupyPublicAdapter login-wall fixture", () => {
  it("marca requires_manual_login e retorna zero vagas sem tentar mais páginas", async () => {
    const client = buildMockClient(loadFixture("login-wall.html"));
    const adapter = new GupyPublicAdapter();

    const result = await adapter.collect(
      buildContext(client, buildSiteConfig({ maxPagesPerQuery: 5 })),
    );

    expect(result.jobs).toHaveLength(0);
    expect(result.summary.error).toBe("requires_manual_login");
    expect(client.navigate).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Captcha
// ---------------------------------------------------------------------------

describe("GupyPublicAdapter captcha fixture", () => {
  it("marca rate_limited_or_captcha e retorna zero vagas", async () => {
    const client = buildMockClient(loadFixture("captcha.html"));
    const adapter = new GupyPublicAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    expect(result.jobs).toHaveLength(0);
    expect(result.summary.error).toBe("rate_limited_or_captcha");
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("GupyPublicAdapter pagination", () => {
  it("navega para &page=N em páginas subsequentes", async () => {
    const client = buildMockClient(loadFixture("happy-path.html"));
    const adapter = new GupyPublicAdapter();

    await adapter.collect(
      buildContext(client, buildSiteConfig({ maxPagesPerQuery: 3 })),
    );

    expect(client.navigate).toHaveBeenCalledTimes(3);

    // First page: no page param
    const firstUrl = client.navigate.mock.calls[0][1] as string;
    expect(firstUrl).toContain("portal.gupy.io/job-search/term=");
    expect(firstUrl).not.toContain("page=");

    // Second page
    const secondUrl = client.navigate.mock.calls[1][1] as string;
    expect(secondUrl).toContain("page=2");

    // Third page
    const thirdUrl = client.navigate.mock.calls[2][1] as string;
    expect(thirdUrl).toContain("page=3");
  });
});

// ---------------------------------------------------------------------------
// marketHint
// ---------------------------------------------------------------------------

describe("GupyPublicAdapter marketHint", () => {
  it("define marketHint='brazil' quando locationText contém termos brasileiros", async () => {
    const client = buildMockClient(loadFixture("happy-path.html"));
    const adapter = new GupyPublicAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    // "São Paulo, SP" → brazil
    expect(result.jobs[0].marketHint).toBe("brazil");
    // "Remoto - Brasil" → brazil
    expect(result.jobs[1].marketHint).toBe("brazil");
    // "Rio de Janeiro, RJ" → brazil
    expect(result.jobs[2].marketHint).toBe("brazil");
  });

  it("não define marketHint quando locationText não contém termos brasileiros", async () => {
    const htmlWithForeignLocation = `
      <div class="job-list">
        <div class="job-card" data-job-id="d4e5f6a7-b8c9-0123-defg-456789012345">
          <a class="job-card__link" href="https://foreign.jobs.gupy.io/jobs/1111/job/d4e5f6a7-b8c9-0123-def0-456789012345">
            <h3 class="job-card__title">Frontend Dev</h3>
          </a>
          <p class="job-card__company">ForeignCo</p>
          <p class="job-card__location">New York, USA</p>
        </div>
      </div>
    `;
    const client = buildMockClient(htmlWithForeignLocation);
    const adapter = new GupyPublicAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].marketHint).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sourceId deduplication
// ---------------------------------------------------------------------------

describe("GupyPublicAdapter sourceId deduplication", () => {
  it("produz o mesmo array de sourceId em duas chamadas sucessivas", async () => {
    const adapter = new GupyPublicAdapter();

    const client1 = buildMockClient(loadFixture("happy-path.html"));
    const result1 = await adapter.collect(buildContext(client1, buildSiteConfig()));

    const client2 = buildMockClient(loadFixture("happy-path.html"));
    const result2 = await adapter.collect(buildContext(client2, buildSiteConfig()));

    const ids1 = result1.jobs.map((j) => j.sourceId);
    const ids2 = result2.jobs.map((j) => j.sourceId);
    expect(ids1).toEqual(ids2);
  });

  it("deduplica dentro do mesmo ciclo quando a mesma vaga aparece em páginas/queries diferentes", async () => {
    const html = loadFixture("happy-path.html");
    const client = buildMockClient(html);
    const adapter = new GupyPublicAdapter();

    const result = await adapter.collect(
      buildContext(
        client,
        buildSiteConfig({
          searchQueries: ["desenvolvedor", "engenheiro de software"],
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

// ---------------------------------------------------------------------------
// Property 2 — URL round-trip
// Feature: browsermcp-job-search-engine, Property 2: URL round-trip nas saídas da engine
// ---------------------------------------------------------------------------

import fc from "fast-check";

import { normalizeJobUrl } from "../../../shared/job.util.js";

describe("Property 2 — URL round-trip", () => {
  // **Validates: Requirements 5.2, 15.2**

  const uuidArb = fc.stringMatching(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );

  const companySlugArb = fc.constantFrom("acme", "globex", "initech", "techbr");

  function buildGupyHtml(uuid: string, companySlug: string): string {
    return `
      <div class="job-list">
        <div class="job-card" data-job-id="${uuid}">
          <a class="job-card__link" href="https://${companySlug}.jobs.gupy.io/jobs/1234/job/${uuid}">
            <h3 class="job-card__title">Test Engineer</h3>
          </a>
          <p class="job-card__company">Test Corp</p>
          <p class="job-card__location">São Paulo, SP</p>
        </div>
      </div>
    `;
  }

  it("URLs emitidas são válidas, absolutas e normalizeJobUrl é idempotente", { timeout: 30_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, companySlugArb, async (uuid, companySlug) => {
        const html = buildGupyHtml(uuid, companySlug);
        const client: BrowserMcpClientLike = {
          navigate: vi.fn(async () => {}),
          snapshot: vi.fn(async () => ({
            url: "https://portal.gupy.io/vagas",
            title: "Vagas | Gupy",
            domHtml: html,
          })),
          click: vi.fn(async () => {}),
          type: vi.fn(async () => {}),
          remainingPageBudget: vi.fn(() => 100),
        };

        const adapter = new GupyPublicAdapter();
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
  });
});
