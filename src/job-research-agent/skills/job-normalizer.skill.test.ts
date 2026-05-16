import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  createJobResearchConfig,
  type JobResearchConfig,
} from "../config/job-research.config.js";
import type { RawJobPosting, RoleCategory } from "../domain/job.types.js";
import { normalizeJob } from "./job-normalizer.skill.js";
import { applyJobFilters } from "./job-filter.skill.js";

const FIXED_NOW = new Date("2026-05-05T12:00:00.000Z");

// Override do config para permitir títulos QA (o default exclui "qa engineer" e
// "quality assurance" — o normalizer não aplica esse filtro, mas mantemos o
// config mínimo e consistente para este unit test isolado do filtro).
const TEST_CONFIG: JobResearchConfig = createJobResearchConfig({
  excludedTitleKeywords: [],
});

function buildRawJob(title: string): RawJobPosting {
  return {
    source: "manual",
    sourceId: `test-${title.replace(/\s+/g, "-").toLowerCase()}`,
    sourceType: "manual",
    sourceFocus: "brazil",
    sourceTier: "manual_curated",
    companyName: "Test Co",
    title,
    url: "https://example.com/jobs/test",
    locationText: "Remote - Brazil",
    descriptionText: "Sample description",
    tags: [],
    regionHints: [],
    restrictionHints: [],
    curationNotes: [],
    metadata: {},
    raw: null,
  };
}

function roleCategoryFor(title: string): RoleCategory {
  return normalizeJob(buildRawJob(title), TEST_CONFIG, FIXED_NOW).roleCategory;
}

describe("job-normalizer — QA role detection", () => {
  it('detects "QA Engineer" title as qa', () => {
    expect(roleCategoryFor("QA Engineer")).toBe("qa");
  });

  it('detects "Quality Assurance Specialist" title as qa', () => {
    expect(roleCategoryFor("Quality Assurance Specialist")).toBe("qa");
  });

  it('detects "Test Engineer" title as qa', () => {
    expect(roleCategoryFor("Test Engineer")).toBe("qa");
  });

  it('detects "SDET" title as qa', () => {
    expect(roleCategoryFor("SDET")).toBe("qa");
  });

  it('detects "Analista de Testes" title as qa', () => {
    expect(roleCategoryFor("Analista de Testes")).toBe("qa");
  });

  it('does NOT classify "Senior Software Engineer" as qa', () => {
    const category = roleCategoryFor("Senior Software Engineer");
    expect(category).not.toBe("qa");
    expect(category).toBe("software_engineering");
  });
});

// Feature: browsermcp-job-search-engine, Property 8: Títulos de QA mapeiam para roleCategory = "qa"
describe("Property 8 — QA title recognition", () => {
  const QA_CONFIG: JobResearchConfig = createJobResearchConfig({
    excludedTitleKeywords: [],
    excludeQaRoles: false,
  });

  const QA_INFIXES = [
    "QA",
    "qa",
    "Quality Assurance",
    "quality assurance",
    "Tester Engineer",
    "Testing Engineer",
    "SDET",
    "sdet",
    "Analista de Testes",
    "analista de testes",
  ];

  const safeString = fc.string({ minLength: 0, maxLength: 12 }).map((s) =>
    s.replace(/[^\w ]/g, "").trim(),
  );

  const qaTitle = fc
    .tuple(safeString, fc.constantFrom(...QA_INFIXES), safeString)
    .map(([prefix, infix, suffix]) => {
      const parts = [prefix, infix, suffix].filter((p) => p.length > 0);
      return parts.join(" ");
    });

  it("normalizeJob assigns roleCategory = 'qa' for any title containing a QA pattern", () => {
    fc.assert(
      fc.property(qaTitle, (title) => {
        const raw: RawJobPosting = {
          source: "manual",
          sourceId: `pbt-qa-${title.replace(/\s+/g, "-").toLowerCase().slice(0, 40)}`,
          sourceType: "manual",
          sourceFocus: "brazil",
          sourceTier: "manual_curated",
          companyName: "PBT Corp",
          title,
          url: "https://example.com/jobs/pbt-qa",
          locationText: "Remote - Brazil",
          descriptionText: "QA role description",
          tags: [],
          regionHints: [],
          restrictionHints: [],
          curationNotes: [],
          metadata: {},
          raw: null,
        };

        const normalized = normalizeJob(raw, QA_CONFIG, FIXED_NOW);
        expect(normalized.roleCategory).toBe("qa");
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Validates: Requirements 8.2, 8.4
   */
  it("applyJobFilters does NOT add 'Excluded title category' when excludeQaRoles = false", () => {
    fc.assert(
      fc.property(qaTitle, (title) => {
        const raw: RawJobPosting = {
          source: "manual",
          sourceId: `pbt-qa-filter-${title.replace(/\s+/g, "-").toLowerCase().slice(0, 40)}`,
          sourceType: "manual",
          sourceFocus: "brazil",
          sourceTier: "manual_curated",
          companyName: "PBT Corp",
          title,
          url: "https://example.com/jobs/pbt-qa-filter",
          locationText: "Remote - Brazil",
          descriptionText: "QA role description with node.js aws docker kubernetes",
          tags: ["node.js", "aws"],
          regionHints: [],
          restrictionHints: [],
          curationNotes: [],
          metadata: {},
          raw: null,
        };

        const normalized = normalizeJob(raw, QA_CONFIG, FIXED_NOW);
        const filtered = applyJobFilters(normalized, QA_CONFIG);
        expect(filtered.rejectionReasons).not.toContain("Excluded title category");
      }),
      { numRuns: 200 },
    );
  });
});

describe("job-filter — global fallback by report group", () => {
  const GLOBAL_FALLBACK_CONFIG: JobResearchConfig = createJobResearchConfig({
    excludedTitleKeywords: [],
    restrictToBrazilPriorityMarkets: true,
    globalFallbackReportGroups: ["senior", "staff", "arq", "qa", "devops", "management"],
  });

  function buildGlobalRawJob(title: string): RawJobPosting {
    return {
      ...buildRawJob(title),
      sourceFocus: "global",
      sourceTier: "direct_company_board",
      locationText: "Remote Worldwide",
      descriptionText: "Remote worldwide role with TypeScript, AWS, and PostgreSQL.",
      regionHints: ["worldwide"],
    };
  }

  it("allows worldwide remote senior+ roles through the global fallback", () => {
    const normalized = normalizeJob(
      buildGlobalRawJob("Senior Software Engineer"),
      GLOBAL_FALLBACK_CONFIG,
      FIXED_NOW,
    );
    const filtered = applyJobFilters(normalized, GLOBAL_FALLBACK_CONFIG);

    expect(filtered.jobMarket).toBe("international");
    expect(filtered.isRelevant).toBe(true);
    expect(filtered.rejectionReasons).not.toContain(
      "Only Brazil-priority markets are allowed in the current mode",
    );
  });

  it("keeps worldwide remote junior roles out of the report", () => {
    const normalized = normalizeJob(
      buildGlobalRawJob("Junior Software Engineer"),
      GLOBAL_FALLBACK_CONFIG,
      FIXED_NOW,
    );
    const filtered = applyJobFilters(normalized, GLOBAL_FALLBACK_CONFIG);

    expect(filtered.jobMarket).toBe("international");
    expect(filtered.isRelevant).toBe(false);
    expect(filtered.rejectionReasons).toContain(
      "Only Brazil-priority markets are allowed in the current mode",
    );
  });
});
