import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rawJobPostingArb } from '../../test-fixtures/browser-mcp/generators.js';
import type { JobResearchConfig } from './config/job-research.config.js';
import { defaultJobResearchConfig } from './config/job-research.config.js';
import type { JobScoreBreakdown } from './domain/job-score.types.js';
import type {
  JobOpportunity,
  RawJobPosting,
  RoleCategory,
  SeniorityLevel,
} from './domain/job.types.js';
import {
  JobResearchAgent,
  buildValidatedSeniorityReportGroupsV2,
  createDefaultBrowserMcpEngine,
  selectReportJobs,
} from './index.js';
import type { JobSource, JobSourceFetchResult } from './sources/job-source.interface.js';
import { type FileJobStorage, type PersistedRunArtifacts } from './storage/file-job-storage.js';

// Prevent real Playwright browser from launching in unit tests.
// The connect-failure test provides its own hanging stub via connectTimeoutMs.
vi.mock('./sources/browser-mcp/browser-mcp-transport.real.js', () => ({
  createRealBrowserMcpTransport: vi.fn(() => ({
    invoke: () => new Promise(() => {}),
    close: async () => {},
  })),
}));

// ---------------------------------------------------------------------------
// Fixture helpers — testes focam em particionamento determinístico no V2,
// não em I/O de rede. Pré-populamos o `urlValidationCache` com Promise.resolve(true)
// para cada URL para que `selectValidJobsForGroup` aceite todos os jobs sem fetch.
// ---------------------------------------------------------------------------

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
    source: 'linkedin',
    sourceId: 'raw-1',
    sourceType: 'aggregator',
    sourceFocus: 'brazil',
    sourceTier: 'brazil_public_api',
    companyName: 'Acme',
    title: 'Software Engineer',
    url: 'https://example.com/jobs/1',
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

interface BuildJobOptions {
  id: string;
  seniority: SeniorityLevel;
  roleCategory: RoleCategory;
  score: number;
  company?: string;
  title?: string;
  url?: string;
}

function buildJob(options: BuildJobOptions): JobOpportunity {
  const company = options.company ?? `Company ${options.id}`;
  const title = options.title ?? `Engineer ${options.id}`;
  const url = options.url ?? `https://example.com/jobs/${options.id}`;

  const raw = buildRawJob({
    sourceId: options.id,
    url,
    companyName: company,
    title,
  });

  return {
    id: options.id,
    source: 'linkedin',
    sourceId: options.id,
    sourceType: 'aggregator',
    sourceFocus: 'brazil',
    sourceTier: 'brazil_public_api',
    companyName: company,
    normalizedCompanyName: company.toLowerCase(),
    title,
    normalizedTitle: title.toLowerCase(),
    url,
    locationText: 'Remote',
    descriptionText: '',
    discoveredAt: '2026-05-05T00:00:00.000Z',
    tags: [],
    metadata: {},
    roleMatches: [],
    remotePolicy: 'remote',
    remoteConfidence: 1,
    remoteRegions: [],
    regionFit: 'brazil_or_latam',
    jobMarket: 'brazil',
    brazilLocationPriority: 'none',
    marketSignals: [],
    visaSignal: 'not_mentioned',
    restrictionSignals: [],
    seniority: options.seniority,
    roleCategory: options.roleCategory,
    stackSignals: [],
    sourceQualityRank: 10,
    isRelevant: true,
    rejectionReasons: [],
    notes: [],
    score: options.score,
    scoreBreakdown: buildScoreBreakdown(options.score),
    rawJob: raw,
  };
}

/**
 * Cria um cache que resolve toda URL como alcançável. Isso evita qualquer
 * tráfego de rede durante o teste — o foco é a lógica de particionamento V2.
 */
function buildAcceptAllUrlCache(jobs: JobOpportunity[]): Map<string, Promise<boolean>> {
  const cache = new Map<string, Promise<boolean>>();
  for (const job of jobs) {
    cache.set(job.url, Promise.resolve(true));
  }
  return cache;
}

function buildTestConfig(
  overrides: Partial<JobResearchConfig> = {},
): Pick<
  JobResearchConfig,
  | 'minReportScore'
  | 'seniorityReportTargetJobs'
  | 'seniorityReportTargetJobsByGroup'
  | 'requestTimeoutMs'
  | 'userAgent'
> {
  return {
    minReportScore: 50,
    seniorityReportTargetJobs: 50,
    seniorityReportTargetJobsByGroup: {},
    requestTimeoutMs: defaultJobResearchConfig.requestTimeoutMs,
    userAgent: defaultJobResearchConfig.userAgent,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixtures: 50+ synthetic jobs cobrindo todos os 7 grupos + casos "other" e
// de score < minReportScore.
// ---------------------------------------------------------------------------

function buildFixtureJobs(): JobOpportunity[] {
  const jobs: JobOpportunity[] = [];

  // Junior (8) — scores 80, 75, 70, 65, 60, 55, 52, 51.
  const juniorScores = [80, 75, 70, 65, 60, 55, 52, 51];
  juniorScores.forEach((score, i) => {
    jobs.push(
      buildJob({
        id: `junior-${i}`,
        seniority: 'junior',
        roleCategory: 'software_engineering',
        score,
      }),
    );
  });

  // Pleno (8) — scores 90, 85, 80, 75, 70, 65, 60, 55.
  const plenoScores = [90, 85, 80, 75, 70, 65, 60, 55];
  plenoScores.forEach((score, i) => {
    jobs.push(
      buildJob({
        id: `pleno-${i}`,
        seniority: 'mid_level',
        roleCategory: 'software_engineering',
        score,
      }),
    );
  });

  // Senior (8) — mix de `senior` e `lead`. Scores decrescentes.
  const seniorSeniorities: SeniorityLevel[] = [
    'senior',
    'senior',
    'lead',
    'senior',
    'lead',
    'senior',
    'senior',
    'lead',
  ];
  seniorSeniorities.forEach((seniority, i) => {
    jobs.push(
      buildJob({
        id: `senior-${i}`,
        seniority,
        roleCategory: 'software_engineering',
        score: 95 - i * 4,
      }),
    );
  });

  // Staff (4) — mix de staff/principal/staff_or_principal.
  const staffSeniorities: SeniorityLevel[] = ['staff', 'principal', 'staff_or_principal', 'staff'];
  staffSeniorities.forEach((seniority, i) => {
    jobs.push(
      buildJob({
        id: `staff-${i}`,
        seniority,
        roleCategory: 'software_engineering',
        score: 100 - i * 5,
      }),
    );
  });

  // Arquitetura (6): architect por seniority, e também por roleCategory.
  jobs.push(
    buildJob({
      id: 'arq-architect-senior',
      seniority: 'architect',
      roleCategory: 'software_engineering',
      score: 92,
    }),
    buildJob({
      id: 'arq-sw-arch-any',
      seniority: 'senior',
      roleCategory: 'software_architecture',
      score: 88,
    }),
    buildJob({
      id: 'arq-solutions-arch',
      seniority: 'staff',
      roleCategory: 'solutions_architecture',
      score: 84,
    }),
    buildJob({
      id: 'arq-cloud-arch',
      seniority: 'senior',
      roleCategory: 'cloud_architecture',
      score: 80,
    }),
    // Arquiteto com seniority baixa: vai para "arq" pela roleCategory.
    buildJob({
      id: 'arq-junior-arch',
      seniority: 'junior',
      roleCategory: 'software_architecture',
      score: 76,
    }),
    // Architect sem roleCategory específica também vai para "arq".
    buildJob({
      id: 'arq-architect-devops-not',
      seniority: 'architect',
      roleCategory: 'software_engineering',
      score: 72,
    }),
  );

  // QA (4): qa com seniority variada, não deve ir para junior/pleno/senior.
  const qaSeniorities: SeniorityLevel[] = ['junior', 'mid_level', 'senior', 'staff'];
  qaSeniorities.forEach((seniority, i) => {
    jobs.push(
      buildJob({
        id: `qa-${i}`,
        seniority,
        roleCategory: 'qa',
        score: 82 - i * 3,
      }),
    );
  });

  // DevOps (6): devops com variadas seniorities — incluindo SENIOR (invariant i).
  const devopsSeniorities: SeniorityLevel[] = [
    'senior', // teste-alvo (i)
    'lead',
    'staff',
    'mid_level',
    'junior',
    'senior',
  ];
  devopsSeniorities.forEach((seniority, i) => {
    jobs.push(
      buildJob({
        id: `devops-${i}`,
        seniority,
        roleCategory: 'devops',
        score: 88 - i * 3,
      }),
    );
  });

  // "Other" bucket: unknown seniority + roleCategory neutro — deve ser omitido.
  jobs.push(
    buildJob({
      id: 'other-unknown-swe',
      seniority: 'unknown',
      roleCategory: 'software_engineering',
      score: 85,
    }),
    buildJob({
      id: 'other-unknown-swe-2',
      seniority: 'unknown',
      roleCategory: 'software_engineering',
      score: 70,
    }),
  );

  // Jobs abaixo de minReportScore (50) — nunca podem aparecer nos CSVs.
  jobs.push(
    buildJob({
      id: 'lowscore-junior',
      seniority: 'junior',
      roleCategory: 'software_engineering',
      score: 40,
    }),
    buildJob({
      id: 'lowscore-devops',
      seniority: 'senior',
      roleCategory: 'devops',
      score: 30,
    }),
    buildJob({
      id: 'lowscore-qa',
      seniority: 'senior',
      roleCategory: 'qa',
      score: 49, // borderline — mas ainda < 50.
    }),
    buildJob({
      id: 'lowscore-arq',
      seniority: 'architect',
      roleCategory: 'software_engineering',
      score: 10,
    }),
  );

  return jobs;
}

describe('buildValidatedSeniorityReportGroupsV2 — particionamento V2', () => {
  it('mantém DevOps senior em report-devops, NÃO em report-senior (precedência devops)', async () => {
    const jobs = buildFixtureJobs();
    expect(jobs.length).toBeGreaterThanOrEqual(50);

    const cache = buildAcceptAllUrlCache(jobs);
    const groups = await buildValidatedSeniorityReportGroupsV2(jobs, buildTestConfig(), cache);

    // (i) DevOps senior aparece apenas em devops.
    const seniorDevopsInDevops = groups.devops.find((j) => j.id === 'devops-0');
    const seniorDevopsInSenior = groups.senior.find((j) => j.id === 'devops-0');
    expect(seniorDevopsInDevops).toBeDefined();
    expect(seniorDevopsInSenior).toBeUndefined();

    // Nenhum job de roleCategory=devops pode vazar para outros grupos.
    const devopsJobIds = jobs
      .filter((j) => j.roleCategory === 'devops' && j.score >= 50)
      .map((j) => j.id);
    for (const devopsId of devopsJobIds) {
      for (const groupKey of ['junior', 'pleno', 'senior', 'staff', 'arq', 'qa'] as const) {
        expect(groups[groupKey].find((j) => j.id === devopsId)).toBeUndefined();
      }
    }
  });

  it('mapeia jobs de roleCategory=software_architecture para report-arq independente da seniority', async () => {
    const jobs = buildFixtureJobs();
    const cache = buildAcceptAllUrlCache(jobs);
    const groups = await buildValidatedSeniorityReportGroupsV2(jobs, buildTestConfig(), cache);

    // (ii) Jobs de arquitetura (por roleCategory ou seniority=architect) vão para arq.
    const expectedArqIds = [
      'arq-architect-senior',
      'arq-sw-arch-any',
      'arq-solutions-arch',
      'arq-cloud-arch',
      'arq-junior-arch',
      'arq-architect-devops-not',
    ];
    const arqIds = groups.arq.map((j) => j.id);
    for (const id of expectedArqIds) {
      expect(arqIds).toContain(id);
    }

    // Nenhum desses arqs vaza para os outros buckets.
    for (const arqId of expectedArqIds) {
      for (const groupKey of ['junior', 'pleno', 'senior', 'staff', 'qa', 'devops'] as const) {
        expect(groups[groupKey].find((j) => j.id === arqId)).toBeUndefined();
      }
    }
  });

  it('mapeia jobs de roleCategory=qa para report-qa independente da seniority', async () => {
    const jobs = buildFixtureJobs();
    const cache = buildAcceptAllUrlCache(jobs);
    const groups = await buildValidatedSeniorityReportGroupsV2(jobs, buildTestConfig(), cache);

    // (iii) Todos os jobs QA (4) devem estar no grupo qa; nenhum deve vazar.
    const qaIds = groups.qa.map((j) => j.id).sort();
    expect(qaIds).toEqual(['qa-0', 'qa-1', 'qa-2', 'qa-3']);

    for (const qaId of qaIds) {
      for (const groupKey of ['junior', 'pleno', 'senior', 'staff', 'arq', 'devops'] as const) {
        expect(groups[groupKey].find((j) => j.id === qaId)).toBeUndefined();
      }
    }
  });

  it('omite jobs com seniority=unknown e roleCategory neutro dos 7 CSVs (bucket other)', async () => {
    const jobs = buildFixtureJobs();
    const cache = buildAcceptAllUrlCache(jobs);
    const groups = await buildValidatedSeniorityReportGroupsV2(jobs, buildTestConfig(), cache);

    // (iv) Os "other" jobs não aparecem em nenhum dos 7 grupos exportáveis.
    const otherIds = ['other-unknown-swe', 'other-unknown-swe-2'];
    for (const otherId of otherIds) {
      for (const groupKey of [
        'junior',
        'pleno',
        'senior',
        'staff',
        'arq',
        'qa',
        'devops',
      ] as const) {
        expect(groups[groupKey].find((j) => j.id === otherId)).toBeUndefined();
      }
    }
  });

  it('exclui jobs com score < minReportScore de TODOS os grupos (invariant)', async () => {
    const jobs = buildFixtureJobs();
    const cache = buildAcceptAllUrlCache(jobs);
    const groups = await buildValidatedSeniorityReportGroupsV2(jobs, buildTestConfig(), cache);

    // (v) Jobs com score abaixo de 50 nunca aparecem.
    const lowScoreIds = ['lowscore-junior', 'lowscore-devops', 'lowscore-qa', 'lowscore-arq'];
    for (const lowId of lowScoreIds) {
      for (const groupKey of [
        'junior',
        'pleno',
        'senior',
        'staff',
        'arq',
        'qa',
        'devops',
      ] as const) {
        expect(groups[groupKey].find((j) => j.id === lowId)).toBeUndefined();
      }
    }
  });

  it('ordena cada grupo por score decrescente', async () => {
    const jobs = buildFixtureJobs();
    const cache = buildAcceptAllUrlCache(jobs);
    const groups = await buildValidatedSeniorityReportGroupsV2(jobs, buildTestConfig(), cache);

    // (vi) Ordem por score descendente dentro de cada grupo.
    for (const groupKey of ['junior', 'pleno', 'senior', 'staff', 'arq', 'qa', 'devops'] as const) {
      const groupJobs = groups[groupKey];
      for (let i = 1; i < groupJobs.length; i += 1) {
        expect(groupJobs[i - 1].score).toBeGreaterThanOrEqual(groupJobs[i].score);
      }
    }
  });

  it('respeita seniorityReportTargetJobsByGroup quando definido', async () => {
    const jobs = buildFixtureJobs();
    const cache = buildAcceptAllUrlCache(jobs);
    const config = buildTestConfig({
      seniorityReportTargetJobsByGroup: {
        devops: 2, // limita devops a 2 vagas
        qa: 1, // limita qa a 1 vaga
      },
    });

    const groups = await buildValidatedSeniorityReportGroupsV2(jobs, config, cache);

    expect(groups.devops.length).toBe(2);
    expect(groups.qa.length).toBe(1);

    // Top scores mantidos (3 devops com >=50: devops-0 score 88, devops-1 85, devops-2 82…).
    expect(groups.devops[0].score).toBeGreaterThanOrEqual(groups.devops[1].score);
  });

  it('retorna objeto com exatamente as 8 chaves canônicas e tipo array', async () => {
    const jobs = buildFixtureJobs();
    const cache = buildAcceptAllUrlCache(jobs);
    const groups = await buildValidatedSeniorityReportGroupsV2(jobs, buildTestConfig(), cache);

    expect(Object.keys(groups).sort()).toEqual(
      ['arq', 'devops', 'junior', 'management', 'pleno', 'qa', 'senior', 'staff'].sort(),
    );
    for (const groupKey of [
      'junior',
      'pleno',
      'senior',
      'staff',
      'arq',
      'qa',
      'devops',
      'management',
    ] as const) {
      expect(Array.isArray(groups[groupKey])).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: BrowserMcpEngine disabled (default) produces no jobs/summaries
// — regression test ensuring Phase B integration doesn't alter pre-existing
// pipeline outputs when browserMcp.enabled=false.
// ---------------------------------------------------------------------------

describe('createDefaultBrowserMcpEngine — browserMcp.enabled=false regression', () => {
  it('returns empty jobs and summaries without invoking the transport factory', async () => {
    const config: JobResearchConfig = {
      ...defaultJobResearchConfig,
      browserMcp: {
        ...defaultJobResearchConfig.browserMcp,
        enabled: false,
      },
    };

    const engine = createDefaultBrowserMcpEngine(config);

    // The engine should implement the JobSource interface
    expect(engine.name).toBe('browser_mcp');

    // With enabled=false, fetchJobs must short-circuit and return empty results
    // without ever calling the transport factory (which would throw).
    const result = await engine.fetchJobs(config);

    expect(result.jobs).toEqual([]);
    expect(result.summaries).toEqual([]);
  });

  it(
    'reports connection error in summary when real transport cannot connect',
    async () => {
      const config: JobResearchConfig = {
        ...defaultJobResearchConfig,
        browserMcp: {
          ...defaultJobResearchConfig.browserMcp,
          enabled: true,
          connectTimeoutMs: 2000,
          sites: {
            ...defaultJobResearchConfig.browserMcp.sites,
            linkedin: {
              ...defaultJobResearchConfig.browserMcp.sites.linkedin,
              enabled: true,
            },
          },
        },
      };

      const engine = createDefaultBrowserMcpEngine(config);

      // When enabled=true but no Browser MCP server is running, the engine
      // gracefully captures the connection error in the summary.
      const result = await engine.fetchJobs(config);

      expect(result.jobs).toEqual([]);
      expect(result.summaries.length).toBeGreaterThan(0);
      expect(result.summaries[0].error).toBeDefined();
    },
    { timeout: 15_000 },
  );
});

// Feature: browsermcp-job-search-engine, Property 5: Brazil-first ratio respeitado
describe('Property 5 — Brazil-first ratio', () => {
  /**
   * Validates: Requirements 15.5
   *
   * For any brazilPrioritySelectionRatio = r and reportTopJobs = limit,
   * given sufficient primary and international pools,
   * |selectedPrimaryJobs / limit - r| <= 1 / limit.
   */
  it('ratio of primary jobs is within 1/limit of configured ratio', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 10, max: 60 }),
        (ratio, limit) => {
          // Build pools with enough primary (brazil market) and international jobs
          // to satisfy the ratio. We need at least `limit` jobs in each pool.
          const primaryJobs: JobOpportunity[] = [];
          const internationalJobs: JobOpportunity[] = [];

          for (let i = 0; i < limit; i++) {
            primaryJobs.push(buildPrimaryJob(`primary-${i}`, 100 - i));
          }
          for (let i = 0; i < limit; i++) {
            internationalJobs.push(buildInternationalJob(`intl-${i}`, 100 - i));
          }

          const allJobs = [...primaryJobs, ...internationalJobs];
          const minScore = 0; // no threshold filtering

          const { selectionSummary } = selectReportJobs(allJobs, limit, minScore, ratio);

          const selectedPrimary = selectionSummary.selectedPrimaryJobs;
          const deviation = Math.abs(selectedPrimary / limit - ratio);
          const tolerance = 1 / limit;

          return deviation <= tolerance;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers for Property 5
// ---------------------------------------------------------------------------

function buildPrimaryJob(id: string, score: number): JobOpportunity {
  return {
    id,
    source: 'linkedin',
    sourceId: id,
    sourceType: 'aggregator',
    sourceFocus: 'brazil',
    sourceTier: 'brazil_public_api',
    companyName: `Company ${id}`,
    normalizedCompanyName: `company ${id}`,
    title: `Engineer ${id}`,
    normalizedTitle: `engineer ${id}`,
    url: `https://example.com/jobs/${id}`,
    locationText: 'Remote',
    descriptionText: '',
    discoveredAt: '2026-05-05T00:00:00.000Z',
    tags: [],
    metadata: {},
    roleMatches: [],
    remotePolicy: 'remote',
    remoteConfidence: 1,
    remoteRegions: [],
    regionFit: 'brazil_or_latam',
    jobMarket: 'brazil',
    brazilLocationPriority: 'none',
    marketSignals: [],
    visaSignal: 'not_mentioned',
    restrictionSignals: [],
    seniority: 'senior',
    roleCategory: 'software_engineering',
    stackSignals: [],
    sourceQualityRank: 10,
    isRelevant: true,
    rejectionReasons: [],
    notes: [],
    score,
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
      total: score,
    },
    rawJob: {
      source: 'linkedin',
      sourceId: id,
      sourceType: 'aggregator',
      sourceFocus: 'brazil',
      sourceTier: 'brazil_public_api',
      companyName: `Company ${id}`,
      title: `Engineer ${id}`,
      url: `https://example.com/jobs/${id}`,
      locationText: 'Remote',
      descriptionText: '',
      tags: [],
      regionHints: [],
      restrictionHints: [],
      curationNotes: [],
      metadata: {},
      raw: null,
    },
  };
}

function buildInternationalJob(id: string, score: number): JobOpportunity {
  return {
    id,
    source: 'linkedin',
    sourceId: id,
    sourceType: 'aggregator',
    sourceFocus: 'global',
    sourceTier: 'global_aggregator',
    companyName: `Intl Company ${id}`,
    normalizedCompanyName: `intl company ${id}`,
    title: `Engineer ${id}`,
    normalizedTitle: `engineer ${id}`,
    url: `https://intl-example.com/jobs/${id}`,
    locationText: 'United States',
    descriptionText: '',
    discoveredAt: '2026-05-05T00:00:00.000Z',
    tags: [],
    metadata: {},
    roleMatches: [],
    remotePolicy: 'remote',
    remoteConfidence: 0.5,
    remoteRegions: ['United States'],
    regionFit: 'incompatible',
    jobMarket: 'international',
    brazilLocationPriority: 'none',
    marketSignals: ['usa'],
    visaSignal: 'not_mentioned',
    restrictionSignals: [],
    seniority: 'senior',
    roleCategory: 'software_engineering',
    stackSignals: [],
    sourceQualityRank: 10,
    isRelevant: true,
    rejectionReasons: [],
    notes: [],
    score,
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
      total: score,
    },
    rawJob: {
      source: 'linkedin',
      sourceId: id,
      sourceType: 'aggregator',
      sourceFocus: 'global',
      sourceTier: 'global_aggregator',
      companyName: `Intl Company ${id}`,
      title: `Engineer ${id}`,
      url: `https://intl-example.com/jobs/${id}`,
      locationText: 'United States',
      descriptionText: '',
      tags: [],
      regionHints: [],
      restrictionHints: [],
      curationNotes: [],
      metadata: {},
      raw: null,
    },
  };
}

// Feature: browsermcp-job-search-engine, Property 3: Determinismo do pipeline
// **Validates: Requirements 15.3**
describe('Property 3 — pipeline determinism', () => {
  const FIXED_NOW = new Date('2026-05-10T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    // Mock isUrlReachable to always return true (avoid network I/O)
    vi.mock('./shared/http.util.js', () => ({
      isUrlReachable: () => Promise.resolve(true),
      fetchJson: () => Promise.reject(new Error('no network in test')),
      fetchText: () => Promise.reject(new Error('no network in test')),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Creates a mock FileJobStorage that captures saveRun arguments without I/O.
   */
  function createMockStorage(): {
    storage: FileJobStorage;
    getCapturedArtifacts: () => PersistedRunArtifacts | undefined;
  } {
    let captured: PersistedRunArtifacts | undefined;

    const storage = {
      loadRecentSelectionHistory: () => Promise.resolve(new Map<string, number>()),
      saveRun: (artifacts: PersistedRunArtifacts) => {
        captured = artifacts;
        return Promise.resolve({
          runDirectory: '/tmp/test-run',
          latestDirectory: '/tmp/test-latest',
          rawJobsPath: '/tmp/test-run/raw-jobs.json',
          rankedJobsPath: '/tmp/test-run/ranked-jobs.json',
          rejectedJobsPath: '/tmp/test-run/rejected-jobs.json',
          summaryPath: '/tmp/test-run/summary.json',
          markdownReportPath: '/tmp/test-run/report.md',
          csvReportPath: '/tmp/test-run/report.csv',
          csvReportBySeniorityPaths: {
            junior: '/tmp/test-run/report-junior.csv',
            pleno: '/tmp/test-run/report-pleno.csv',
            senior: '/tmp/test-run/report-senior.csv',
            staff: '/tmp/test-run/report-staff.csv',
            arq: '/tmp/test-run/report-arq.csv',
            qa: '/tmp/test-run/report-qa.csv',
            devops: '/tmp/test-run/report-devops.csv',
          },
          browserMcpTracePath: null,
        });
      },
    } as unknown as FileJobStorage;

    return { storage, getCapturedArtifacts: () => captured };
  }

  /**
   * Creates a mock JobSource that returns the given raw jobs.
   */
  function createMockSource(rawJobs: RawJobPosting[]): JobSource {
    return {
      name: 'linkedin' as const,
      fetchJobs: (): Promise<JobSourceFetchResult> =>
        Promise.resolve({
          jobs: rawJobs,
          summaries: [
            {
              source: 'linkedin' as const,
              label: 'LinkedIn',
              focus: 'brazil' as const,
              tier: 'brazil_public_api' as const,
              fetchedJobs: rawJobs.length,
            },
          ],
        }),
    };
  }

  /**
   * Builds a minimal config that disables network-dependent features and
   * keeps the pipeline fast for property testing.
   */
  function buildDeterministicConfig(): JobResearchConfig {
    return {
      ...defaultJobResearchConfig,
      searchExpansionMaxAttempts: 1,
      dailyVarietyEnabled: false,
      browserMcp: {
        ...defaultJobResearchConfig.browserMcp,
        enabled: false,
      },
    };
  }

  it(
    'same RawJobPosting[] input produces identical selectedJobs ids and csvReportsBySeniority',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(rawJobPostingArb, { minLength: 1, maxLength: 30 }),
          async (rawJobs) => {
            const config = buildDeterministicConfig();

            // Deep clone the input for the second run
            const rawJobsClone = structuredClone(rawJobs);

            // --- First run ---
            const mock1 = createMockStorage();
            const agent1 = new JobResearchAgent(config, [createMockSource(rawJobs)], mock1.storage);
            const result1 = await agent1.run();
            const artifacts1 = mock1.getCapturedArtifacts()!;

            // --- Second run (with deep-cloned input) ---
            const mock2 = createMockStorage();
            const agent2 = new JobResearchAgent(
              config,
              [createMockSource(rawJobsClone)],
              mock2.storage,
            );
            const result2 = await agent2.run();
            const artifacts2 = mock2.getCapturedArtifacts()!;

            // Assert selectedJobs ids are identical (same order)
            const ids1 = result1.selectedJobs.map((j) => j.id);
            const ids2 = result2.selectedJobs.map((j) => j.id);
            expect(ids1).toEqual(ids2);

            // Assert csvReportsBySeniority V2 strings are identical per group
            const csv1 = artifacts1.csvReportsBySeniority;
            const csv2 = artifacts2.csvReportsBySeniority;
            expect(csv1.junior).toEqual(csv2.junior);
            expect(csv1.pleno).toEqual(csv2.pleno);
            expect(csv1.senior).toEqual(csv2.senior);
            expect(csv1.staff).toEqual(csv2.staff);
            expect(csv1.arq).toEqual(csv2.arq);
            expect(csv1.qa).toEqual(csv2.qa);
            expect(csv1.devops).toEqual(csv2.devops);
          },
        ),
        { numRuns: 50 },
      );
    },
    { timeout: 60_000 },
  );
});
