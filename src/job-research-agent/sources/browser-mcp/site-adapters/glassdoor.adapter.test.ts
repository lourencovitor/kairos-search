import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { BrowserMcpClientLike, BrowserMcpSiteConfig } from "../browser-mcp.types.js";

import { APPLY_BUTTON_SELECTORS, GlassdoorAdapter, NEXT_BUTTON_SELECTOR } from "./glassdoor.adapter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(name: string): string {
  const filePath = path.resolve(
    process.cwd(),
    "test-fixtures",
    "browser-mcp",
    "glassdoor",
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
      url: "https://www.glassdoor.com/Job/jobs.htm",
      title: "Software Engineer Jobs | Glassdoor",
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
    searchQueries: ["software engineer"],
    maxPagesPerQuery: 1,
    rateLimitMs: 6_000,
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

describe("GlassdoorAdapter happy-path fixture", () => {
  it("extrai 3 vagas com shape canônico", async () => {
    const client = buildMockClient(loadFixture("happy-path.html"));
    const adapter = new GlassdoorAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    expect(result.jobs).toHaveLength(3);
    expect(result.summary.error).toBeUndefined();
    expect(result.summary.fetchedJobs).toBe(3);

    for (const job of result.jobs) {
      expect(job.source).toBe("browser_mcp");
      expect(job.sourceBoard).toBe("glassdoor-browser-mcp");
      expect(job.sourceType).toBe("aggregator");
      expect(job.sourceFocus).toBe("global");
      expect(job.sourceTier).toBe("global_aggregator");
      expect(job.sourceQualityRank).toBe(14);
      expect(job.sourceId).toMatch(/^glassdoor:\d+$/);
      expect(job.url.startsWith("https://www.glassdoor.com/")).toBe(true);
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
        browserMcp: { siteId: "glassdoor", query: "software engineer" },
      });
    }

    const ids = result.jobs.map((j) => j.sourceId);
    expect(ids).toEqual(["glassdoor:1001234", "glassdoor:2005678", "glassdoor:3009999"]);
  });

  it("não clica em nenhum seletor de Apply durante o happy-path", async () => {
    const client = buildMockClient(loadFixture("happy-path.html"));
    const adapter = new GlassdoorAdapter();

    await adapter.collect(buildContext(client, buildSiteConfig()));

    for (const applySelector of APPLY_BUTTON_SELECTORS) {
      expect(client.click).not.toHaveBeenCalledWith(applySelector);
    }
  });
});

// ---------------------------------------------------------------------------
// Login wall
// ---------------------------------------------------------------------------

describe("GlassdoorAdapter login-wall fixture", () => {
  it("marca requires_manual_login e retorna zero vagas sem tentar mais páginas", async () => {
    const client = buildMockClient(loadFixture("login-wall.html"));
    const adapter = new GlassdoorAdapter();

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

describe("GlassdoorAdapter captcha fixture", () => {
  it("marca rate_limited_or_captcha e retorna zero vagas", async () => {
    const client = buildMockClient(loadFixture("captcha.html"));
    const adapter = new GlassdoorAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    expect(result.jobs).toHaveLength(0);
    expect(result.summary.error).toBe("rate_limited_or_captcha");
  });

  it("detecta captcha via texto 'confirm you are not a robot'", async () => {
    const htmlWithCaptchaText = `
      <html><body>
        <div class="challenge">
          <p>Please confirm you are not a robot to continue.</p>
        </div>
      </body></html>
    `;
    const client = buildMockClient(htmlWithCaptchaText);
    const adapter = new GlassdoorAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    expect(result.jobs).toHaveLength(0);
    expect(result.summary.error).toBe("rate_limited_or_captcha");
  });
});

// ---------------------------------------------------------------------------
// Pagination (click-based)
// ---------------------------------------------------------------------------

describe("GlassdoorAdapter pagination", () => {
  it("usa navigate na primeira página e click no botão next nas subsequentes", async () => {
    const client = buildMockClient(loadFixture("happy-path.html"));
    const adapter = new GlassdoorAdapter();

    await adapter.collect(
      buildContext(client, buildSiteConfig({ maxPagesPerQuery: 3 })),
    );

    // First page: navigate
    expect(client.navigate).toHaveBeenCalledTimes(1);
    const firstUrl = client.navigate.mock.calls[0][1] as string;
    expect(firstUrl).toContain("glassdoor.com/Job/jobs.htm");
    expect(firstUrl).toContain("sc.keyword=software+engineer");

    // Pages 2 and 3: click next button
    expect(client.click).toHaveBeenCalledTimes(2);
    expect(client.click).toHaveBeenCalledWith(NEXT_BUTTON_SELECTOR);
  });
});

// ---------------------------------------------------------------------------
// marketHint
// ---------------------------------------------------------------------------

describe("GlassdoorAdapter marketHint", () => {
  it("define marketHint='brazil' quando locationText contém termos brasileiros", async () => {
    const client = buildMockClient(loadFixture("happy-path.html"));
    const adapter = new GlassdoorAdapter();

    const result = await adapter.collect(buildContext(client, buildSiteConfig()));

    // "Remote - São Paulo, Brazil" → brazil
    expect(result.jobs[0].marketHint).toBe("brazil");
    // "Remoto - Brasil" → brazil
    expect(result.jobs[1].marketHint).toBe("brazil");
    // "New York, NY" → undefined
    expect(result.jobs[2].marketHint).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// rateLimitMs
// ---------------------------------------------------------------------------

describe("GlassdoorAdapter rateLimitMs", () => {
  it("respeita o rateLimitMs configurado passando-o ao client.navigate", async () => {
    const client = buildMockClient(loadFixture("happy-path.html"));
    const adapter = new GlassdoorAdapter();

    const customRateLimit = 10_000;
    await adapter.collect(
      buildContext(client, buildSiteConfig({ rateLimitMs: customRateLimit })),
    );

    expect(client.navigate).toHaveBeenCalledWith("glassdoor", expect.any(String), customRateLimit);
  });

  it("usa rateLimitMs default de 6000 quando não sobrescrito", () => {
    const adapter = new GlassdoorAdapter();
    expect(adapter.defaultConfig.rateLimitMs).toBe(6_000);
  });
});

// ---------------------------------------------------------------------------
// sourceId deduplication
// ---------------------------------------------------------------------------

describe("GlassdoorAdapter sourceId deduplication", () => {
  it("deduplica dentro do mesmo ciclo quando a mesma vaga aparece em queries diferentes", async () => {
    const html = loadFixture("happy-path.html");
    const client = buildMockClient(html);
    const adapter = new GlassdoorAdapter();

    const result = await adapter.collect(
      buildContext(
        client,
        buildSiteConfig({
          searchQueries: ["software engineer", "developer"],
          maxPagesPerQuery: 1,
        }),
      ),
    );

    // 2 queries × 1 page = 2 navigations, but only 3 unique jobs
    expect(client.navigate).toHaveBeenCalledTimes(2);
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

  const jobIdArb = fc.stringMatching(/^\d{4,10}$/);

  function buildGlassdoorHtml(jobId: string): string {
    return `
      <ul class="JobsList_jobsList__lqjTr">
        <li class="JobsList_jobListItem__wuQ1e" data-job-id="${jobId}">
          <a href="/job-listing/test-engineer-acme-JV_IC${jobId}" class="JobCard_jobTitle__GLyJ1">Test Engineer</a>
          <span class="EmployerProfile_companyName__xaVBo">Test Corp</span>
          <div class="JobCard_location__N3S3X">Remote - Brazil</div>
        </li>
      </ul>
    `;
  }

  it("URLs emitidas são válidas, absolutas e normalizeJobUrl é idempotente", { timeout: 30_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(jobIdArb, async (jobId) => {
        const html = buildGlassdoorHtml(jobId);
        const client: BrowserMcpClientLike = {
          navigate: vi.fn(async () => {}),
          snapshot: vi.fn(async () => ({
            url: "https://www.glassdoor.com/Job/jobs.htm",
            title: "Jobs | Glassdoor",
            domHtml: html,
          })),
          click: vi.fn(async () => {}),
          type: vi.fn(async () => {}),
          remainingPageBudget: vi.fn(() => 100),
        };

        const adapter = new GlassdoorAdapter();
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
