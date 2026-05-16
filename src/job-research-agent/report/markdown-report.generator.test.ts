import { describe, expect, it } from "vitest";

import {
  createJobResearchConfig,
  type JobResearchConfig,
} from "../config/job-research.config.js";
import type {
  JobOpportunity,
  JobSelectionSummary,
  JobSourceSummary,
  RoleCategory,
  SeniorityLevel,
} from "../domain/job.types.js";
import { MarkdownReportGenerator, type MarkdownReportInput } from "./markdown-report.generator.js";

// Helper de fixture — usa defaults "inócuos" para todos os campos não
// envolvidos no teste. `JobOpportunity` tem muitos campos; aqui vive a lista
// mínima para deixar os casos de teste enxutos.
function buildJobOpportunity(overrides: Partial<JobOpportunity> = {}): JobOpportunity {
  const base: JobOpportunity = {
    id: "job-1",
    source: "linkedin",
    sourceId: "linkedin:1",
    sourceType: "aggregator",
    sourceFocus: "global",
    sourceTier: "global_aggregator",
    companyName: "Acme Corp",
    normalizedCompanyName: "acme-corp",
    title: "Senior Software Engineer",
    normalizedTitle: "senior software engineer",
    url: "https://example.com/jobs/1",
    locationText: "Remote - Brazil",
    descriptionText: "",
    discoveredAt: "2026-05-05T00:00:00.000Z",
    tags: [],
    metadata: {},
    roleMatches: [],
    remotePolicy: "remote",
    remoteConfidence: 1,
    remoteRegions: [],
    regionFit: "brazil_or_latam",
    jobMarket: "brazil",
    brazilLocationPriority: "none",
    marketSignals: [],
    visaSignal: "not_mentioned",
    restrictionSignals: [],
    seniority: "senior",
    roleCategory: "software_engineering",
    stackSignals: [],
    sourceQualityRank: 10,
    reportBucket: "primary",
    isRelevant: true,
    rejectionReasons: [],
    notes: [],
    score: 80,
    scoreBreakdown: {
      titleMatch: 0,
      seniorityFit: 0,
      marketFit: 0,
      locationBoost: 0,
      stackMatch: 0,
      preferredPlatformBoost: 0,
      sourceQuality: 0,
      recency: 0,
      compensation: 0,
      restrictionsPenalty: 0,
      clarityPenalty: 0,
      stackPenalty: 0,
      total: 80,
    },
    rawJob: {
      source: "linkedin",
      sourceId: "linkedin:1",
      sourceType: "aggregator",
      sourceFocus: "global",
      sourceTier: "global_aggregator",
      companyName: "Acme Corp",
      title: "Senior Software Engineer",
      url: "https://example.com/jobs/1",
      locationText: "Remote - Brazil",
      descriptionText: "",
      tags: [],
      regionHints: [],
      restrictionHints: [],
      curationNotes: [],
      metadata: {},
      raw: {},
    },
  };

  return { ...base, ...overrides };
}

function buildSelectionSummary(
  overrides: Partial<JobSelectionSummary> = {},
): JobSelectionSummary {
  return {
    limit: 100,
    minScore: 50,
    desiredPrimaryJobs: 0,
    desiredInternationalJobs: 0,
    usedThresholdFallback: false,
    selectedPrimaryJobs: 0,
    selectedSecondaryJobs: 0,
    selectedWorldwideCompatiblePrimaryJobs: 0,
    filledFromSecondaryBecausePrimaryShortfall: 0,
    marketCounts: {
      brazil: 0,
      brazil_friendly: 0,
      latam: 0,
      international: 0,
      unclear: 0,
    },
    ...overrides,
  };
}

function buildInput(
  overrides: Partial<MarkdownReportInput> = {},
): MarkdownReportInput {
  const config: JobResearchConfig = createJobResearchConfig();
  return {
    generatedAt: "2026-05-05T15:00:00.000Z",
    totalRawJobs: 0,
    selectionSummary: buildSelectionSummary(),
    selectedJobs: [],
    rankedJobs: [],
    rejectedJobs: [],
    sourceSummaries: [],
    config,
    ...overrides,
  };
}

// Mapeia grupo V2 → (seniority, roleCategory) canônicos que caem nele.
// Usado para montar um ranking que cobre os 7 grupos em um snapshot só.
const GROUP_SEED: Array<{
  group: string;
  seniority: SeniorityLevel;
  roleCategory: RoleCategory;
}> = [
  { group: "junior", seniority: "junior", roleCategory: "software_engineering" },
  { group: "pleno", seniority: "mid_level", roleCategory: "software_engineering" },
  { group: "senior", seniority: "senior", roleCategory: "software_engineering" },
  { group: "staff", seniority: "staff", roleCategory: "software_engineering" },
  { group: "arq", seniority: "architect", roleCategory: "software_architecture" },
  { group: "qa", seniority: "mid_level", roleCategory: "qa" },
  { group: "devops", seniority: "senior", roleCategory: "devops" },
];

describe("MarkdownReportGenerator — V1 section preserved", () => {
  it("still renders the legacy '## Seniority Reports' section", () => {
    const generator = new MarkdownReportGenerator();

    const selectedJobs = [
      buildJobOpportunity({
        id: "v1-senior",
        seniority: "senior",
        score: 90,
      }),
    ];

    const output = generator.generate(
      buildInput({
        totalRawJobs: 1,
        selectedJobs,
        rankedJobs: selectedJobs,
      }),
    );

    expect(output).toContain("## Seniority Reports");
    // Sub-headers de V1 (getSeniorityReportGroupLabel): Junior | Mid-level / Pleno | Senior+
    expect(output).toContain("### Senior+");
  });
});

describe("MarkdownReportGenerator — V2 section layout", () => {
  it("renders '## Reports by Group (V2)' with exactly 7 sub-sections in canonical order", () => {
    const generator = new MarkdownReportGenerator();

    const rankedJobs = GROUP_SEED.map((seed, index) =>
      buildJobOpportunity({
        id: `v2-${seed.group}`,
        seniority: seed.seniority,
        roleCategory: seed.roleCategory,
        companyName: `Company ${seed.group}`,
        title: `${seed.group} role`,
        url: `https://example.com/jobs/${index + 1}`,
        score: 80,
      }),
    );

    const output = generator.generate(
      buildInput({
        totalRawJobs: rankedJobs.length,
        selectedJobs: rankedJobs,
        rankedJobs,
      }),
    );

    expect(output).toContain("## Reports by Group (V2)");

    const v2Start = output.indexOf("## Reports by Group (V2)");
    const v2Section = output.slice(v2Start);

    const expectedHeaders = [
      "### Junior",
      "### Pleno",
      "### Senior",
      "### Staff",
      "### Arq",
      "### QA",
      "### DevOps",
    ] as const;

    let searchIndex = 0;
    for (const header of expectedHeaders) {
      const headerIndex = v2Section.indexOf(header, searchIndex);
      expect(
        headerIndex,
        `expected '${header}' to appear in V2 section after index ${searchIndex}`,
      ).toBeGreaterThanOrEqual(0);
      searchIndex = headerIndex + header.length;
    }
  });

  it("renders the placeholder line for empty groups", () => {
    const generator = new MarkdownReportGenerator();

    const juniorOnly = [
      buildJobOpportunity({
        id: "junior-only",
        seniority: "junior",
        roleCategory: "software_engineering",
        score: 70,
      }),
    ];

    const output = generator.generate(
      buildInput({
        totalRawJobs: 1,
        selectedJobs: juniorOnly,
        rankedJobs: juniorOnly,
      }),
    );

    // Pleno / Senior / Staff / Arq / QA / DevOps estão todos vazios.
    expect(output).toContain("Sem vagas no grupo Pleno nesta execução.");
    expect(output).toContain("Sem vagas no grupo Senior nesta execução.");
    expect(output).toContain("Sem vagas no grupo Staff nesta execução.");
    expect(output).toContain("Sem vagas no grupo Arq nesta execução.");
    expect(output).toContain("Sem vagas no grupo QA nesta execução.");
    expect(output).toContain("Sem vagas no grupo DevOps nesta execução.");
  });
});

describe("MarkdownReportGenerator — Browser MCP status line", () => {
  it("renders 'Browser MCP: disabled' when no browser_mcp summaries are present", () => {
    const generator = new MarkdownReportGenerator();

    const summaries: JobSourceSummary[] = [
      {
        source: "linkedin",
        label: "LinkedIn",
        focus: "global",
        tier: "global_aggregator",
        fetchedJobs: 10,
      },
    ];

    const output = generator.generate(buildInput({ sourceSummaries: summaries }));

    expect(output).toContain("Browser MCP: disabled");
    expect(output).not.toContain("Browser MCP: enabled");
  });

  it("renders 'Browser MCP: enabled (...)' with per-site counts parsed from summary.label", () => {
    const generator = new MarkdownReportGenerator();

    const summaries: JobSourceSummary[] = [
      {
        source: "browser_mcp",
        label: "browser_mcp:linkedin",
        focus: "global",
        tier: "global_aggregator",
        fetchedJobs: 7,
      },
      {
        source: "browser_mcp",
        label: "browser_mcp:programathor",
        focus: "brazil",
        tier: "brazil_public_api",
        fetchedJobs: 3,
      },
    ];

    const output = generator.generate(buildInput({ sourceSummaries: summaries }));

    expect(output).toContain("Browser MCP: enabled (linkedin=7, programathor=3)");
    expect(output).not.toContain("Browser MCP: disabled");
  });
});
