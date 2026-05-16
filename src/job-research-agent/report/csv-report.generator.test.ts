import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type {
  JobOpportunity,
  RawJobPosting,
  RoleCategory,
  SeniorityLevel,
} from "../domain/job.types.js";
import { SENIORITY_REPORT_GROUP_V2_ORDER } from "../domain/job.types.js";
import type { JobScoreBreakdown } from "../domain/job-score.types.js";
import { jobOpportunityArb } from "../../../test-fixtures/browser-mcp/generators.js";
import {
  CsvReportGenerator,
  type CsvSeniorityJobGroupsV2,
} from "./csv-report.generator.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
//
// `JobOpportunity` carrega muitos campos, mas os únicos que importam para o
// CSV gerado aqui são: rank (derivado da ordem do array), score, companyName,
// title, url, source, locationText, jobMarket, seniority, stackSignals,
// publishedAt, reportBucket (opcional) e os campos usados por
// `toSeniorityReportGroupV2` (seniority + roleCategory). Os demais são
// preenchidos com defaults benignos para compor uma instância válida.

function buildScoreBreakdown(total: number): JobScoreBreakdown {
  return {
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
    total,
  };
}

function buildRawJob(overrides: Partial<RawJobPosting> = {}): RawJobPosting {
  return {
    source: "linkedin",
    sourceId: "raw-1",
    sourceType: "aggregator",
    sourceFocus: "brazil",
    sourceTier: "brazil_public_api",
    companyName: "Acme",
    title: "Software Engineer",
    url: "https://example.com/jobs/1",
    locationText: "Remote",
    descriptionText: "",
    tags: [],
    regionHints: [],
    restrictionHints: [],
    curationNotes: [],
    metadata: {},
    raw: null,
    ...overrides,
  };
}

function buildJobOpportunity(overrides: Partial<JobOpportunity> = {}): JobOpportunity {
  const score = overrides.score ?? 80;
  const raw = buildRawJob({
    companyName: overrides.companyName,
    title: overrides.title,
    url: overrides.url,
    source: overrides.source,
    sourceId: overrides.sourceId,
    locationText: overrides.locationText,
    publishedAt: overrides.publishedAt,
  });

  return {
    id: "job-1",
    source: "linkedin",
    sourceId: "job-1",
    sourceType: "aggregator",
    sourceFocus: "brazil",
    sourceTier: "brazil_public_api",
    companyName: "Acme",
    normalizedCompanyName: "acme",
    title: "Software Engineer",
    normalizedTitle: "software engineer",
    url: "https://example.com/jobs/1",
    locationText: "Remote",
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
    isRelevant: true,
    rejectionReasons: [],
    notes: [],
    score,
    scoreBreakdown: buildScoreBreakdown(score),
    rawJob: raw,
    ...overrides,
  };
}

function buildJobForGroup(
  options: {
    id: string;
    seniority: SeniorityLevel;
    roleCategory: RoleCategory;
    score: number;
    company: string;
    title: string;
  },
): JobOpportunity {
  return buildJobOpportunity({
    id: options.id,
    sourceId: options.id,
    score: options.score,
    seniority: options.seniority,
    roleCategory: options.roleCategory,
    companyName: options.company,
    title: options.title,
    normalizedCompanyName: options.company.toLowerCase(),
    normalizedTitle: options.title.toLowerCase(),
    url: `https://example.com/jobs/${options.id}`,
    publishedAt: "2026-05-01T00:00:00.000Z",
    stackSignals: ["typescript", "node"],
  });
}

// Cada grupo V2 recebe 3 vagas com combinações válidas de seniority/roleCategory
// que respeitam a precedência `toSeniorityReportGroupV2`.
const CANONICAL_GROUPS: CsvSeniorityJobGroupsV2 = {
  junior: [
    buildJobForGroup({
      id: "jun-1",
      seniority: "junior",
      roleCategory: "software_engineering",
      score: 95,
      company: "AlphaCo",
      title: "Junior Software Engineer",
    }),
    buildJobForGroup({
      id: "jun-2",
      seniority: "junior",
      roleCategory: "software_engineering",
      score: 80,
      company: "BetaCo",
      title: "Junior Backend Developer",
    }),
    buildJobForGroup({
      id: "jun-3",
      seniority: "junior",
      roleCategory: "software_engineering",
      score: 70,
      company: "GammaCo",
      title: "Junior Full Stack",
    }),
  ],
  pleno: [
    buildJobForGroup({
      id: "ple-1",
      seniority: "mid_level",
      roleCategory: "software_engineering",
      score: 90,
      company: "DeltaCo",
      title: "Pleno Software Engineer",
    }),
    buildJobForGroup({
      id: "ple-2",
      seniority: "mid_level",
      roleCategory: "software_engineering",
      score: 85,
      company: "EpsilonCo",
      title: "Mid-level Backend",
    }),
    buildJobForGroup({
      id: "ple-3",
      seniority: "mid_level",
      roleCategory: "software_engineering",
      score: 75,
      company: "ZetaCo",
      title: "Pleno Full Stack Engineer",
    }),
  ],
  senior: [
    buildJobForGroup({
      id: "sen-1",
      seniority: "senior",
      roleCategory: "software_engineering",
      score: 100,
      company: "EtaCo",
      title: "Senior Software Engineer",
    }),
    buildJobForGroup({
      id: "sen-2",
      seniority: "lead",
      roleCategory: "tech_lead",
      score: 92,
      company: "ThetaCo",
      title: "Tech Lead",
    }),
    buildJobForGroup({
      id: "sen-3",
      seniority: "senior",
      roleCategory: "software_engineering",
      score: 88,
      company: "IotaCo",
      title: "Senior Backend Engineer",
    }),
  ],
  staff: [
    buildJobForGroup({
      id: "sta-1",
      seniority: "staff",
      roleCategory: "software_engineering",
      score: 110,
      company: "KappaCo",
      title: "Staff Software Engineer",
    }),
    buildJobForGroup({
      id: "sta-2",
      seniority: "principal",
      roleCategory: "software_engineering",
      score: 105,
      company: "LambdaCo",
      title: "Principal Engineer",
    }),
    buildJobForGroup({
      id: "sta-3",
      seniority: "staff_or_principal",
      roleCategory: "software_engineering",
      score: 95,
      company: "MuCo",
      title: "Staff / Principal Engineer",
    }),
  ],
  arq: [
    buildJobForGroup({
      id: "arq-1",
      seniority: "architect",
      roleCategory: "software_architecture",
      score: 115,
      company: "NuCo",
      title: "Software Architect",
    }),
    buildJobForGroup({
      id: "arq-2",
      seniority: "senior",
      roleCategory: "cloud_architecture",
      score: 100,
      company: "XiCo",
      title: "Cloud Architect",
    }),
    buildJobForGroup({
      id: "arq-3",
      seniority: "lead",
      roleCategory: "solutions_architecture",
      score: 90,
      company: "OmicronCo",
      title: "Solutions Architect",
    }),
  ],
  qa: [
    buildJobForGroup({
      id: "qa-1",
      seniority: "senior",
      roleCategory: "qa",
      score: 95,
      company: "PiCo",
      title: "Senior QA Engineer",
    }),
    buildJobForGroup({
      id: "qa-2",
      seniority: "mid_level",
      roleCategory: "qa",
      score: 80,
      company: "RhoCo",
      title: "QA Engineer",
    }),
    buildJobForGroup({
      id: "qa-3",
      seniority: "junior",
      roleCategory: "qa",
      score: 70,
      company: "SigmaCo",
      title: "Junior QA / SDET",
    }),
  ],
  devops: [
    buildJobForGroup({
      id: "dev-1",
      seniority: "senior",
      roleCategory: "devops",
      score: 100,
      company: "TauCo",
      title: "Senior DevOps Engineer",
    }),
    buildJobForGroup({
      id: "dev-2",
      seniority: "staff",
      roleCategory: "devops",
      score: 105,
      company: "UpsilonCo",
      title: "Staff Platform Engineer",
    }),
    buildJobForGroup({
      id: "dev-3",
      seniority: "lead",
      roleCategory: "devops",
      score: 90,
      company: "PhiCo",
      title: "SRE Lead",
    }),
  ],
};

const EMPTY_GROUPS: CsvSeniorityJobGroupsV2 = {
  junior: [],
  pleno: [],
  senior: [],
  staff: [],
  arq: [],
  qa: [],
  devops: [],
  management: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CsvReportGenerator.generateFromSeniorityGroupsV2", () => {
  const generator = new CsvReportGenerator();

  it("returns null for every empty group", () => {
    const result = generator.generateFromSeniorityGroupsV2(EMPTY_GROUPS);

    expect(result).toStrictEqual({
      junior: null,
      pleno: null,
      senior: null,
      staff: null,
      arq: null,
      qa: null,
      devops: null,
    });
  });

  it("returns null for groups with an empty array even when siblings are populated", () => {
    const result = generator.generateFromSeniorityGroupsV2({
      ...EMPTY_GROUPS,
      junior: CANONICAL_GROUPS.junior,
    });

    expect(result.junior).not.toBeNull();
    expect(result.junior).toContain("report_group");
    // Empty siblings must remain null, not empty strings or header-only CSVs.
    expect(result.pleno).toBeNull();
    expect(result.senior).toBeNull();
    expect(result.staff).toBeNull();
    expect(result.arq).toBeNull();
    expect(result.qa).toBeNull();
    expect(result.devops).toBeNull();
  });

  it.each([
    ["junior"],
    ["pleno"],
    ["senior"],
    ["staff"],
    ["arq"],
    ["qa"],
    ["devops"],
  ] as const)(
    "emits a CSV for the %s group whose header ends in report_group and whose rows carry that group value",
    (group) => {
      const result = generator.generateFromSeniorityGroupsV2(CANONICAL_GROUPS);
      const csv = result[group];

      expect(csv).not.toBeNull();
      const [header, ...dataRows] = (csv as string).split("\n");

      // Header always ends with `report_group` — the new V2 column.
      expect(header.endsWith(",report_group")).toBe(true);

      // Exactly 3 data rows per group (we built 3 fixtures each).
      expect(dataRows).toHaveLength(3);

      // The last column of each row must equal the group key.
      for (const row of dataRows) {
        const cells = row.split(",");
        expect(cells.at(-1)).toBe(group);
      }
    },
  );

  it("snapshot: junior group CSV", () => {
    const { junior } = generator.generateFromSeniorityGroupsV2(CANONICAL_GROUPS);
    expect(junior).toMatchInlineSnapshot(`
      "rank,fit,score,company,title,url,source,location,fit_reason,job_market,seniority,stack_signals,published_at,report_group
      1,Excelente,95,AlphaCo,Junior Software Engineer,<https://example.com/jobs/jun-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Junior,typescript; node,2026-05-01T00:00:00.000Z,junior
      2,Otima,80,BetaCo,Junior Backend Developer,<https://example.com/jobs/jun-2>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Junior,typescript; node,2026-05-01T00:00:00.000Z,junior
      3,Otima,70,GammaCo,Junior Full Stack,<https://example.com/jobs/jun-3>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Junior,typescript; node,2026-05-01T00:00:00.000Z,junior"
    `);
  });

  it("snapshot: pleno group CSV", () => {
    const { pleno } = generator.generateFromSeniorityGroupsV2(CANONICAL_GROUPS);
    expect(pleno).toMatchInlineSnapshot(`
      "rank,fit,score,company,title,url,source,location,fit_reason,job_market,seniority,stack_signals,published_at,report_group
      1,Excelente,90,DeltaCo,Pleno Software Engineer,<https://example.com/jobs/ple-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Pleno,typescript; node,2026-05-01T00:00:00.000Z,pleno
      2,Excelente,85,EpsilonCo,Mid-level Backend,<https://example.com/jobs/ple-2>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Pleno,typescript; node,2026-05-01T00:00:00.000Z,pleno
      3,Otima,75,ZetaCo,Pleno Full Stack Engineer,<https://example.com/jobs/ple-3>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Pleno,typescript; node,2026-05-01T00:00:00.000Z,pleno"
    `);
  });

  it("snapshot: senior group CSV", () => {
    const { senior } = generator.generateFromSeniorityGroupsV2(CANONICAL_GROUPS);
    expect(senior).toMatchInlineSnapshot(`
      "rank,fit,score,company,title,url,source,location,fit_reason,job_market,seniority,stack_signals,published_at,report_group
      1,Excelente,100,EtaCo,Senior Software Engineer,<https://example.com/jobs/sen-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Senior,typescript; node,2026-05-01T00:00:00.000Z,senior
      2,Excelente,92,ThetaCo,Tech Lead,<https://example.com/jobs/sen-2>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Lead,typescript; node,2026-05-01T00:00:00.000Z,senior
      3,Excelente,88,IotaCo,Senior Backend Engineer,<https://example.com/jobs/sen-3>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Senior,typescript; node,2026-05-01T00:00:00.000Z,senior"
    `);
  });

  it("snapshot: staff group CSV", () => {
    const { staff } = generator.generateFromSeniorityGroupsV2(CANONICAL_GROUPS);
    expect(staff).toMatchInlineSnapshot(`
      "rank,fit,score,company,title,url,source,location,fit_reason,job_market,seniority,stack_signals,published_at,report_group
      1,Excelente,110,KappaCo,Staff Software Engineer,<https://example.com/jobs/sta-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Staff,typescript; node,2026-05-01T00:00:00.000Z,staff
      2,Excelente,105,LambdaCo,Principal Engineer,<https://example.com/jobs/sta-2>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Principal,typescript; node,2026-05-01T00:00:00.000Z,staff
      3,Excelente,95,MuCo,Staff / Principal Engineer,<https://example.com/jobs/sta-3>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Staff / Principal,typescript; node,2026-05-01T00:00:00.000Z,staff"
    `);
  });

  it("snapshot: arq group CSV", () => {
    const { arq } = generator.generateFromSeniorityGroupsV2(CANONICAL_GROUPS);
    expect(arq).toMatchInlineSnapshot(`
      "rank,fit,score,company,title,url,source,location,fit_reason,job_market,seniority,stack_signals,published_at,report_group
      1,Excelente,115,NuCo,Software Architect,<https://example.com/jobs/arq-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Architect,typescript; node,2026-05-01T00:00:00.000Z,arq
      2,Excelente,100,XiCo,Cloud Architect,<https://example.com/jobs/arq-2>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Senior,typescript; node,2026-05-01T00:00:00.000Z,arq
      3,Excelente,90,OmicronCo,Solutions Architect,<https://example.com/jobs/arq-3>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Lead,typescript; node,2026-05-01T00:00:00.000Z,arq"
    `);
  });

  it("snapshot: qa group CSV", () => {
    const { qa } = generator.generateFromSeniorityGroupsV2(CANONICAL_GROUPS);
    expect(qa).toMatchInlineSnapshot(`
      "rank,fit,score,company,title,url,source,location,fit_reason,job_market,seniority,stack_signals,published_at,report_group
      1,Excelente,95,PiCo,Senior QA Engineer,<https://example.com/jobs/qa-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Senior,typescript; node,2026-05-01T00:00:00.000Z,qa
      2,Otima,80,RhoCo,QA Engineer,<https://example.com/jobs/qa-2>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Pleno,typescript; node,2026-05-01T00:00:00.000Z,qa
      3,Otima,70,SigmaCo,Junior QA / SDET,<https://example.com/jobs/qa-3>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Junior,typescript; node,2026-05-01T00:00:00.000Z,qa"
    `);
  });

  it("snapshot: devops group CSV", () => {
    const { devops } = generator.generateFromSeniorityGroupsV2(CANONICAL_GROUPS);
    expect(devops).toMatchInlineSnapshot(`
      "rank,fit,score,company,title,url,source,location,fit_reason,job_market,seniority,stack_signals,published_at,report_group
      1,Excelente,100,TauCo,Senior DevOps Engineer,<https://example.com/jobs/dev-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Senior,typescript; node,2026-05-01T00:00:00.000Z,devops
      2,Excelente,105,UpsilonCo,Staff Platform Engineer,<https://example.com/jobs/dev-2>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Staff,typescript; node,2026-05-01T00:00:00.000Z,devops
      3,Excelente,90,PhiCo,SRE Lead,<https://example.com/jobs/dev-3>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Lead,typescript; node,2026-05-01T00:00:00.000Z,devops"
    `);
  });
});

describe("CsvReportGenerator.generate (full report.csv)", () => {
  const generator = new CsvReportGenerator();

  it("appends report_group column populated per row", () => {
    const allJobs = [
      ...CANONICAL_GROUPS.junior,
      ...CANONICAL_GROUPS.devops,
      ...CANONICAL_GROUPS.arq,
    ];
    const csv = generator.generate(allJobs);
    const [header, ...rows] = csv.split("\n");

    expect(header.endsWith(",report_group")).toBe(true);
    expect(rows).toHaveLength(allJobs.length);

    const groupsInOrder = rows.map((row) => {
      const cells = row.split(",");
      return cells.at(-1);
    });
    expect(groupsInOrder).toStrictEqual([
      "junior",
      "junior",
      "junior",
      "devops",
      "devops",
      "devops",
      "arq",
      "arq",
      "arq",
    ]);
  });

  it("snapshot: full report.csv with mixed groups", () => {
    const mixed = [
      CANONICAL_GROUPS.senior[0],
      CANONICAL_GROUPS.pleno[0],
      CANONICAL_GROUPS.qa[0],
      CANONICAL_GROUPS.devops[0],
      CANONICAL_GROUPS.arq[0],
    ];
    expect(generator.generate(mixed)).toMatchInlineSnapshot(`
      "rank,fit,score,company,title,url,source,location,fit_reason,job_market,seniority,stack_signals,published_at,report_group
      1,Excelente,100,EtaCo,Senior Software Engineer,<https://example.com/jobs/sen-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Senior,typescript; node,2026-05-01T00:00:00.000Z,senior
      2,Excelente,90,DeltaCo,Pleno Software Engineer,<https://example.com/jobs/ple-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Pleno,typescript; node,2026-05-01T00:00:00.000Z,pleno
      3,Excelente,95,PiCo,Senior QA Engineer,<https://example.com/jobs/qa-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Senior,typescript; node,2026-05-01T00:00:00.000Z,qa
      4,Excelente,100,TauCo,Senior DevOps Engineer,<https://example.com/jobs/dev-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Senior,typescript; node,2026-05-01T00:00:00.000Z,devops
      5,Excelente,115,NuCo,Software Architect,<https://example.com/jobs/arq-1>,linkedin,Remote,Brazil-based or Remote Brazil,brazil,Architect,typescript; node,2026-05-01T00:00:00.000Z,arq"
    `);
  });
});


// Feature: browsermcp-job-search-engine, Property 6: Bound e monotonicidade por grupo no CSV V2
describe("Property 6 — bound + monotonicity", () => {
  const generator = new CsvReportGenerator();
  const seniorityReportTargetJobs = 50;

  // **Validates: Requirements 10.3, 15.6, 15.8**
  it("each group CSV has at most seniorityReportTargetJobs rows and scores are monotonically decreasing", { timeout: 30_000 }, () => {
    const groupKeys: Array<keyof CsvSeniorityJobGroupsV2> = [
      "junior",
      "pleno",
      "senior",
      "staff",
      "arq",
      "qa",
      "devops",
      "management",
    ];

    // Generate an arbitrary for CsvSeniorityJobGroupsV2 where each group
    // contains jobs sorted by score descending and limited to seniorityReportTargetJobs,
    // simulating what the pipeline does before calling the generator.
    const groupsArb = fc
      .record({
        junior: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
        pleno: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
        senior: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
        staff: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
        arq: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
        qa: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
        devops: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
        management: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
      })
      .map((groups) => {
        // Simulate pipeline: sort by score descending, limit to seniorityReportTargetJobs
        const result: CsvSeniorityJobGroupsV2 = {
          junior: [],
          pleno: [],
          senior: [],
          staff: [],
          arq: [],
          qa: [],
          devops: [],
          management: [],
        };
        for (const key of groupKeys) {
          result[key] = groups[key]
            .sort((a, b) => b.score - a.score)
            .slice(0, seniorityReportTargetJobs);
        }
        return result;
      });

    fc.assert(
      fc.property(groupsArb, (groups) => {
        const csvReports = generator.generateFromSeniorityGroupsV2(groups);

        for (const key of groupKeys) {
          const csv = csvReports[key];
          if (csv === null) {
            // Empty group produces null — no rows to check.
            continue;
          }

          const lines = csv.split("\n");
          const [_header, ...dataRows] = lines;

          // (a) Bound: number of data rows <= seniorityReportTargetJobs (default 50)
          expect(dataRows.length).toBeLessThanOrEqual(seniorityReportTargetJobs);

          // (b) Monotonicity: scores in consecutive rows are non-increasing
          const scores = dataRows.map((row) => {
            const cells = row.split(",");
            return Number(cells[2]); // score is the 3rd column (index 2)
          });

          for (let i = 0; i < scores.length - 1; i++) {
            expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: browsermcp-job-search-engine, Property 7: Invariante de score mínimo por grupo
describe("Property 7 — min score invariant", () => {
  const generator = new CsvReportGenerator();

  // **Validates: Requirements 11.5, 15.7**
  it("every row in every group CSV has score >= minReportScore", { timeout: 30_000 }, () => {
    const groupKeys: Array<keyof CsvSeniorityJobGroupsV2> = [
      "junior",
      "pleno",
      "senior",
      "staff",
      "arq",
      "qa",
      "devops",
      "management",
    ];

    // minReportScore varies between 0 and 100
    const minReportScoreArb = fc.integer({ min: 0, max: 100 });

    const groupsArb = fc.record({
      junior: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
      pleno: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
      senior: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
      staff: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
      arq: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
      qa: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
      devops: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
      management: fc.array(jobOpportunityArb, { minLength: 0, maxLength: 8 }),
    });

    fc.assert(
      fc.property(groupsArb, minReportScoreArb, (groups, minReportScore) => {
        // Simulate pipeline: filter each group to only include jobs with score >= minReportScore
        const filteredGroups: CsvSeniorityJobGroupsV2 = {
          junior: [],
          pleno: [],
          senior: [],
          staff: [],
          arq: [],
          qa: [],
          devops: [],
          management: [],
        };
        for (const key of groupKeys) {
          filteredGroups[key] = groups[key].filter((job) => job.score >= minReportScore);
        }

        const csvReports = generator.generateFromSeniorityGroupsV2(filteredGroups);

        for (const key of groupKeys) {
          const csv = csvReports[key];
          if (csv === null) {
            // Empty group produces null — no rows to check.
            continue;
          }

          const lines = csv.split("\n");
          const [_header, ...dataRows] = lines;

          for (const row of dataRows) {
            const cells = row.split(",");
            const score = Number(cells[2]); // score is the 3rd column (index 2)
            expect(score).toBeGreaterThanOrEqual(minReportScore);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
