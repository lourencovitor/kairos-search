// Reusable fast-check arbitraries for Browser MCP feature tests.
// Feature: browsermcp-job-search-engine
//
// These generators produce shapes compatible with the domain types in
// src/job-research-agent/domain/job.types.ts, and always yield values that
// flow through slugify() and normalizeJobUrl() without throwing.

import fc from "fast-check";

import type {
  JobMarket,
  JobOpportunity,
  JobSourceFocus,
  JobSourceName,
  JobSourceTier,
  JobSourceType,
  RawJobPosting,
  RemotePolicy,
  RoleCategory,
  SeniorityLevel,
} from "../../src/job-research-agent/domain/job.types.js";
import type { JobScoreBreakdown } from "../../src/job-research-agent/domain/job-score.types.js";

// ---------------------------------------------------------------------------
// Unions
// ---------------------------------------------------------------------------

export const seniorityLevelArb: fc.Arbitrary<SeniorityLevel> = fc.constantFrom<SeniorityLevel>(
  "architect",
  "principal",
  "staff",
  "lead",
  "staff_or_principal",
  "senior",
  "mid_level",
  "junior",
  "unknown",
);

// RoleCategory always yields the full V2 set (including "qa") — tests on the
// pre-V2 type must filter the output instead of depending on a narrow arb.
export const roleCategoryArb: fc.Arbitrary<RoleCategory> = fc.constantFrom<RoleCategory>(
  "software_engineering",
  "tech_lead",
  "devops",
  "software_architecture",
  "solutions_architecture",
  "cloud_architecture",
  // The V2 extension adds "qa"; legacy-typed tests filter this out at the
  // caller, e.g. `.filter((c) => c !== "qa")`.
  // Cast is required because the canonical type in this branch is pre-V2.
  "qa" as RoleCategory,
);

export const jobMarketArb: fc.Arbitrary<JobMarket> = fc.constantFrom<JobMarket>(
  "brazil",
  "brazil_friendly",
  "latam",
  "international",
  "unclear",
);

export const remotePolicyArb: fc.Arbitrary<RemotePolicy> = fc.constantFrom<RemotePolicy>(
  "remote",
  "hybrid",
  "onsite",
  "unknown",
);

export const jobSourceNameArb: fc.Arbitrary<JobSourceName> = fc.constantFrom<JobSourceName>(
  "linkedin",
  "programathor",
  "greenhouse",
  "lever",
  "himalayas",
  "getonboard",
  "gupy",
  "ashby",
  "remotive",
  "remoteok",
  "manual",
  // V2 adds "browser_mcp".
  "browser_mcp" as JobSourceName,
);

export const jobSourceTypeArb: fc.Arbitrary<JobSourceType> = fc.constantFrom<JobSourceType>(
  "direct_company_board",
  "aggregator",
  "manual",
);

export const jobSourceFocusArb: fc.Arbitrary<JobSourceFocus> = fc.constantFrom<JobSourceFocus>(
  "brazil",
  "latam",
  "global",
  "mixed",
);

export const jobSourceTierArb: fc.Arbitrary<JobSourceTier> = fc.constantFrom<JobSourceTier>(
  "manual_curated",
  "brazil_public_api",
  "direct_company_board",
  "global_aggregator",
);

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

// Short, slugify-safe tokens (ASCII letters/digits/spaces only).
const slugSafeTokenArb = fc
  .stringMatching(/^[a-zA-Z0-9 ]{1,16}$/)
  .filter((value) => value.trim().length > 0);

const companyNameArb = slugSafeTokenArb.map((value) => `Company ${value.trim()}`);
const titleArb = slugSafeTokenArb.map((value) => `${value.trim()} Engineer`);

const locationTextArb = fc.constantFrom(
  "Remote",
  "Remoto",
  "Brasil",
  "São Paulo",
  "Rio de Janeiro",
  "Worldwide",
  "Europe",
  "United States",
);

const scoreArb = fc.integer({ min: 0, max: 120 });

// Always-valid absolute URLs. We intentionally hand-build them rather than
// letting fast-check's webUrl() produce host-only URLs that omit the path.
const absoluteUrlArb = fc
  .tuple(
    fc.constantFrom("https", "http"),
    fc.constantFrom("example.com", "jobs.example.com", "boards.example.com"),
    fc.integer({ min: 1, max: 999999 }),
  )
  .map(([scheme, host, id]) => `${scheme}://${host}/jobs/${id}`);

const isoDateArb = fc
  .integer({
    min: new Date("2020-01-01T00:00:00.000Z").getTime(),
    max: new Date("2030-12-31T23:59:59.000Z").getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

const tagsArb = fc.array(slugSafeTokenArb.map((t) => t.trim().toLowerCase()), { maxLength: 6 });

// ---------------------------------------------------------------------------
// RawJobPosting
// ---------------------------------------------------------------------------

export const rawJobPostingArb: fc.Arbitrary<RawJobPosting> = fc
  .record({
    source: jobSourceNameArb,
    sourceId: fc
      .stringMatching(/^[a-zA-Z0-9:_-]{4,24}$/)
      .filter((v) => v.length >= 4),
    sourceBoard: fc.option(slugSafeTokenArb, { nil: undefined }),
    sourceType: jobSourceTypeArb,
    sourceFocus: jobSourceFocusArb,
    sourceTier: jobSourceTierArb,
    sourceQualityRank: fc.option(fc.integer({ min: 1, max: 20 }), { nil: undefined }),
    companyName: companyNameArb,
    title: titleArb,
    url: absoluteUrlArb,
    locationText: locationTextArb,
    descriptionText: fc.string({ maxLength: 120 }),
    employmentType: fc.option(fc.constantFrom("full-time", "part-time", "contract"), { nil: undefined }),
    publishedAt: fc.option(isoDateArb, { nil: undefined }),
    updatedAt: fc.option(isoDateArb, { nil: undefined }),
    salaryText: fc.option(fc.constantFrom("R$ 12k-18k", "USD 100k-150k", undefined), { nil: undefined }),
    tags: tagsArb,
    marketHint: fc.option(jobMarketArb, { nil: undefined }),
    remotePolicyHint: fc.option(remotePolicyArb, { nil: undefined }),
    regionHints: fc.array(locationTextArb, { maxLength: 3 }),
    restrictionHints: fc.array(fc.constantFrom("US-only", "EU-only", "Visa sponsorship"), { maxLength: 2 }),
    curationNotes: fc.array(slugSafeTokenArb, { maxLength: 2 }),
    metadata: fc.constant({} as Record<string, unknown>),
    raw: fc.constant(null),
  })
  .map((partial) => partial as RawJobPosting);

// ---------------------------------------------------------------------------
// JobScoreBreakdown (full shape matching domain type)
// ---------------------------------------------------------------------------

const jobScoreBreakdownArb: fc.Arbitrary<JobScoreBreakdown> = fc.record({
  titleMatch: fc.integer({ min: 0, max: 30 }),
  seniorityFit: fc.integer({ min: 0, max: 20 }),
  marketFit: fc.integer({ min: 0, max: 20 }),
  locationBoost: fc.integer({ min: 0, max: 10 }),
  stackMatch: fc.integer({ min: 0, max: 20 }),
  preferredPlatformBoost: fc.integer({ min: 0, max: 10 }),
  sourceQuality: fc.integer({ min: 0, max: 10 }),
  recency: fc.integer({ min: 0, max: 10 }),
  compensation: fc.integer({ min: 0, max: 10 }),
  restrictionsPenalty: fc.integer({ min: -20, max: 0 }),
  clarityPenalty: fc.integer({ min: -10, max: 0 }),
  stackPenalty: fc.integer({ min: -10, max: 0 }),
  total: fc.integer({ min: 0, max: 120 }),
});

// ---------------------------------------------------------------------------
// JobOpportunity
// ---------------------------------------------------------------------------

export const jobOpportunityArb: fc.Arbitrary<JobOpportunity> = rawJobPostingArb.chain((raw) =>
  fc
    .record({
      id: fc.stringMatching(/^[a-f0-9]{16}$/),
      score: scoreArb,
      scoreBreakdown: jobScoreBreakdownArb,
      seniority: seniorityLevelArb,
      roleCategory: roleCategoryArb,
      jobMarket: jobMarketArb,
      remotePolicy: remotePolicyArb,
      remoteConfidence: fc.float({ min: 0, max: 1, noNaN: true }),
      remoteRegions: fc.array(locationTextArb, { maxLength: 3 }),
      regionFit: fc.constantFrom<JobOpportunity["regionFit"]>(
        "worldwide",
        "brazil_or_latam",
        "partial_latam",
        "unknown",
        "incompatible",
      ),
      brazilLocationPriority: fc.constantFrom<JobOpportunity["brazilLocationPriority"]>(
        "sao_paulo",
        "rio_de_janeiro",
        "major_city",
        "none",
      ),
      marketSignals: fc.array(slugSafeTokenArb, { maxLength: 3 }),
      visaSignal: fc.constantFrom<JobOpportunity["visaSignal"]>(
        "supports",
        "not_mentioned",
        "not_supported",
        "requires_work_authorization",
      ),
      restrictionSignals: fc.array(slugSafeTokenArb, { maxLength: 2 }),
      stackSignals: fc.array(slugSafeTokenArb, { maxLength: 4 }),
      sourceQualityRank: fc.integer({ min: 1, max: 20 }),
      isRelevant: fc.boolean(),
      rejectionReasons: fc.array(slugSafeTokenArb, { maxLength: 2 }),
      notes: fc.array(slugSafeTokenArb, { maxLength: 2 }),
      roleMatches: fc.array(slugSafeTokenArb, { maxLength: 3 }),
      discoveredAt: isoDateArb,
    })
    .map((core) => {
      const opp: JobOpportunity = {
        id: core.id,
        source: raw.source,
        sourceId: raw.sourceId,
        sourceBoard: raw.sourceBoard,
        sourceType: raw.sourceType,
        sourceFocus: raw.sourceFocus,
        sourceTier: raw.sourceTier,
        companyName: raw.companyName,
        normalizedCompanyName: raw.companyName.toLowerCase(),
        title: raw.title,
        normalizedTitle: raw.title.toLowerCase(),
        url: raw.url,
        locationText: raw.locationText,
        descriptionText: raw.descriptionText,
        employmentType: raw.employmentType,
        publishedAt: raw.publishedAt,
        updatedAt: raw.updatedAt,
        discoveredAt: core.discoveredAt,
        salaryText: raw.salaryText,
        tags: raw.tags,
        metadata: raw.metadata,
        roleMatches: core.roleMatches,
        remotePolicy: core.remotePolicy,
        remoteConfidence: core.remoteConfidence,
        remoteRegions: core.remoteRegions,
        regionFit: core.regionFit,
        jobMarket: core.jobMarket,
        brazilLocationPriority: core.brazilLocationPriority,
        marketSignals: core.marketSignals,
        visaSignal: core.visaSignal,
        restrictionSignals: core.restrictionSignals,
        seniority: core.seniority,
        roleCategory: core.roleCategory,
        stackSignals: core.stackSignals,
        sourceQualityRank: core.sourceQualityRank,
        isRelevant: core.isRelevant,
        rejectionReasons: core.rejectionReasons,
        notes: core.notes,
        score: core.score,
        scoreBreakdown: core.scoreBreakdown,
        rawJob: raw,
      };
      return opp;
    }),
);

// ---------------------------------------------------------------------------
// Composed helpers
// ---------------------------------------------------------------------------

export function jobOpportunityWithScoreAtLeast(min: number): fc.Arbitrary<JobOpportunity> {
  return jobOpportunityArb.map((opp) => ({
    ...opp,
    score: Math.max(min, opp.score),
  }));
}

// Group selector mirrors the V2 precedence rules (the actual mapping lives
// in shared/job-taxonomy.util.ts once task 2.2 lands).
export type SeniorityGroupLabel =
  | "junior"
  | "pleno"
  | "senior"
  | "staff"
  | "arq"
  | "qa"
  | "devops";

export function jobOpportunityWithSeniorityGroup(
  group: SeniorityGroupLabel,
): fc.Arbitrary<JobOpportunity> {
  const roleCategoryForGroup: Record<SeniorityGroupLabel, RoleCategory> = {
    devops: "devops",
    arq: "software_architecture",
    qa: "qa" as RoleCategory,
    junior: "software_engineering",
    pleno: "software_engineering",
    senior: "software_engineering",
    staff: "software_engineering",
  };
  const seniorityForGroup: Record<SeniorityGroupLabel, SeniorityLevel> = {
    devops: "senior",
    arq: "architect",
    qa: "senior",
    junior: "junior",
    pleno: "mid_level",
    senior: "senior",
    staff: "staff",
  };
  return jobOpportunityArb.map((opp) => ({
    ...opp,
    roleCategory: roleCategoryForGroup[group],
    seniority: seniorityForGroup[group],
  }));
}

// ---------------------------------------------------------------------------
// Browser MCP config arbitraries
// ---------------------------------------------------------------------------
//
// The concrete shapes for BrowserMcpSiteConfig and BrowserMcpConfig land in
// task 3.1. We expose generic arbitraries here so Phase B tests can import
// them; consumers cast to the concrete type once available.

export interface GenericBrowserMcpSiteConfigShape {
  enabled: boolean;
  searchQueries: string[];
  maxPagesPerQuery: number;
  rateLimitMs: number;
  maxJobs: number;
  location?: string;
}

export interface GenericBrowserMcpConfigShape {
  enabled: boolean;
  connectTimeoutMs: number;
  parallelSites: boolean;
  globalMaxPages: number;
  sites: Record<string, GenericBrowserMcpSiteConfigShape>;
}

export const browserMcpSiteConfigArb: fc.Arbitrary<GenericBrowserMcpSiteConfigShape> = fc.record({
  enabled: fc.boolean(),
  searchQueries: fc.array(slugSafeTokenArb, { minLength: 1, maxLength: 4 }),
  maxPagesPerQuery: fc.integer({ min: 1, max: 5 }),
  rateLimitMs: fc.integer({ min: 1000, max: 10_000 }),
  maxJobs: fc.integer({ min: 10, max: 500 }),
  location: fc.option(locationTextArb, { nil: undefined }),
});

const siteIdArb = fc.constantFrom(
  "linkedin",
  "programathor",
  "glassdoor",
  "vagas_com",
  "catho",
  "infojobs_br",
  "gupy_public",
  "trampos_co",
  "revelo",
);

export const browserMcpConfigArb: fc.Arbitrary<GenericBrowserMcpConfigShape> = fc
  .record({
    enabled: fc.boolean(),
    connectTimeoutMs: fc.integer({ min: 1000, max: 60_000 }),
    parallelSites: fc.boolean(),
    globalMaxPages: fc.integer({ min: 1, max: 500 }),
    sitesList: fc.array(
      fc.tuple(siteIdArb, browserMcpSiteConfigArb),
      { minLength: 1, maxLength: 9 },
    ),
  })
  .map(({ sitesList, ...rest }) => {
    const sites: Record<string, GenericBrowserMcpSiteConfigShape> = {};
    for (const [id, cfg] of sitesList) {
      sites[id] = cfg;
    }
    return { ...rest, sites };
  });
