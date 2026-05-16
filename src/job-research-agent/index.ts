import { createHash } from 'node:crypto';
import type { JobResearchConfig } from './config/job-research.config.js';
import { defaultJobResearchConfig } from './config/job-research.config.js';
import type {
  JobFilterFunnelSummary,
  JobMarket,
  JobOpportunity,
  JobResearchRunResult,
  JobSelectionSummary,
  JobSourceFocus,
  JobSourceSummary,
  JobSourceTier,
  RawJobPosting,
  SeniorityLevel,
  SeniorityReportGroupV2,
} from './domain/job.types.js';
import { SENIORITY_REPORT_GROUP_V2_ORDER } from './domain/job.types.js';
import {
  CsvReportGenerator,
  type CsvSeniorityJobGroups,
  type CsvSeniorityJobGroupsV2,
} from './report/csv-report.generator.js';
import { MarkdownReportGenerator } from './report/markdown-report.generator.js';
import { isUrlReachable } from './shared/http.util.js';
import {
  getSeniorityReportGroup,
  toSeniorityReportGroupV2,
} from './shared/job-taxonomy.util.js';
import { AshbySource } from './sources/ashby.source.js';
import { GetOnBoardSource } from './sources/getonboard.source.js';
import { GreenhouseSource } from './sources/greenhouse.source.js';
import { GupySource } from './sources/gupy.source.js';
import { HimalayasSource } from './sources/himalayas.source.js';
import { LeverSource } from './sources/lever.source.js';
import { LinkedInSource } from './sources/linkedin.source.js';
import { ManualJobInputSource } from './sources/manual-job-input.source.js';
import { ProgramaThorSource } from './sources/programathor.source.js';
import type { JobSource } from './sources/job-source.interface.js';
import { RemotiveSource } from './sources/remotive.source.js';
import { RemoteOkSource } from './sources/remoteok.source.js';
import { BrowserMcpEngine } from './sources/browser-mcp/browser-mcp.engine.js';
import { BrowserMcpTraceWriter } from './sources/browser-mcp/browser-mcp-trace.writer.js';
import { getSiteAdapters } from './sources/browser-mcp/site-adapters/index.js';
import type { BrowserMcpTransport } from './sources/browser-mcp/browser-mcp.types.js';
import { createRealBrowserMcpTransport } from './sources/browser-mcp/browser-mcp-transport.real.js';
import { FileJobStorage } from './storage/file-job-storage.js';
import { deduplicateJobs } from './skills/duplicate-detector.skill.js';
import { applyJobFilters } from './skills/job-filter.skill.js';
import { normalizeJob } from './skills/job-normalizer.skill.js';
import { rankJob } from './skills/job-ranker.skill.js';
import { isPrimaryBrazilMarket } from './skills/job-market-classifier.skill.js';
import {
  isPrimaryReportJob,
  isWorldwideRemoteClearlyCompatibleWithBrazil,
} from './skills/job-selection-policy.skill.js';
import { normalizeJobUrl } from './shared/job.util.js';

const PRIMARY_SENIORITY_TARGET_RATIOS: Array<{
  seniority: SeniorityLevel;
  ratio: number;
}> = [
  { seniority: 'junior', ratio: 0.05 },
  { seniority: 'mid_level', ratio: 0.2 },
  { seniority: 'senior', ratio: 0.25 },
  { seniority: 'lead', ratio: 0.15 },
  { seniority: 'staff', ratio: 0.1 },
  { seniority: 'principal', ratio: 0.1 },
  { seniority: 'architect', ratio: 0.15 },
];

const MAX_SOURCE_SHARE_RATIO = 0.3;
const SEARCH_EXPANSION_PAGE_CAPS = {
  linkedIn: 5,
  himalayas: 6,
  getOnBoard: 6,
  browserMcpSite: 5,
} as const;

interface DailyVarietyContext {
  dayKey: string;
  recentSelectionHistory: Map<string, number>;
  repeatPenalty: number;
  scoreBandSize: number;
}

export class JobResearchAgent {
  private readonly markdownReportGenerator = new MarkdownReportGenerator();
  private readonly csvReportGenerator = new CsvReportGenerator();

  constructor(
    private readonly config: JobResearchConfig,
    private readonly sources: JobSource[],
    private readonly storage: FileJobStorage,
  ) {}

  async run(): Promise<JobResearchRunResult> {
    const now = new Date();
    const runId = now.toISOString().replaceAll(/[:.]/g, '-');
    const generatedAt = now.toISOString();
    let lastAttemptResult:
      | {
          rawJobs: RawJobPosting[];
          sourceSummaries: JobSourceSummary[];
          rankedJobs: JobOpportunity[];
          rejectedJobs: JobOpportunity[];
        }
      | undefined;

    let bestCounts: Record<SeniorityReportGroupV2, number> | undefined;

    for (let attempt = 0; attempt < this.config.searchExpansionMaxAttempts; attempt += 1) {
      const attemptConfig = expandSearchConfig(this.config, attempt);
      const attemptResult = await this.prepareRunData(attemptConfig, now);
      lastAttemptResult = attemptResult;
      const counts = countRankedJobsByReportGroupV2(attemptResult.rankedJobs, attemptConfig);

      if (hasEnoughSeniorityReportJobs(counts, this.config)) {
        break;
      }

      const previousBestCounts = bestCounts;
      if (
        previousBestCounts &&
        SENIORITY_REPORT_GROUP_V2_ORDER.every((group) => counts[group] <= previousBestCounts[group])
      ) {
        break;
      }

      bestCounts = counts;
    }

    const { rawJobs, sourceSummaries, rankedJobs: baseRankedJobs, rejectedJobs } = lastAttemptResult!;
    const recentSelectionHistory = await this.storage.loadRecentSelectionHistory(
      now,
      this.config.dailyVarietyLookbackDays,
    );
    const freshJobs = this.config.dailyVarietyExcludeRecentSelections
      ? baseRankedJobs.filter((job) => !wasRecentlySelected(job, recentSelectionHistory))
      : baseRankedJobs;
    const dailyContext = buildDailyVarietyContext(now, recentSelectionHistory, this.config);
    const rankedJobs = this.config.dailyVarietyEnabled
      ? applyDailyVarietyOrdering(freshJobs, dailyContext)
      : freshJobs;
    const { selectedJobs: initiallySelectedJobs, selectionSummary } = selectReportJobs(
      rankedJobs,
      this.config.reportTopJobs,
      this.config.minReportScore,
      this.config.brazilPrioritySelectionRatio,
    );
    const urlValidationCache = new Map<string, Promise<boolean>>();
    const selectedJobs = await ensureReportJobsHaveWorkingUrls(
      initiallySelectedJobs,
      rankedJobs.filter((job) => !initiallySelectedJobs.some((selectedJob) => selectedJob.id === job.id)),
      this.config.reportTopJobs,
      this.config,
      urlValidationCache,
    );
    const seniorityReportGroupsV2 = await buildValidatedSeniorityReportGroupsV2(
      rankedJobs,
      this.config,
      urlValidationCache,
    );
    const filterFunnel = buildFilterFunnelSummary(rawJobs.length, rankedJobs, rejectedJobs);

    const markdownReport = this.markdownReportGenerator.generate({
      generatedAt,
      totalRawJobs: rawJobs.length,
      selectionSummary,
      selectedJobs,
      rankedJobs,
      rejectedJobs,
      sourceSummaries,
      config: this.config,
    });
    const csvReport = this.csvReportGenerator.generate(selectedJobs);
    const csvReportsBySeniority = this.csvReportGenerator.generateFromSeniorityGroupsV2(
      seniorityReportGroupsV2,
    );

    const output = await this.storage.saveRun({
      runId,
      generatedAt,
      totalRawJobs: rawJobs.length,
      selectionSummary,
      rawJobs,
      rankedJobs,
      selectedJobs,
      rejectedJobs,
      filterFunnel,
      sourceSummaries,
      markdownReport,
      csvReport,
      csvReportsBySeniority,
    });

    return {
      runId,
      generatedAt,
      totalRawJobs: rawJobs.length,
      sourceSummaries,
      selectionSummary,
      selectedJobs,
      rankedJobs,
      rejectedJobs,
      output,
    };
  }

  private async prepareRunData(config: JobResearchConfig, now: Date): Promise<{
    rawJobs: RawJobPosting[];
    sourceSummaries: JobSourceSummary[];
    rankedJobs: JobOpportunity[];
    rejectedJobs: JobOpportunity[];
  }> {
    const sourceResults = await Promise.allSettled(
      this.sources.map((source) => source.fetchJobs(config)),
    );

    const rawJobs: RawJobPosting[] = [];
    const sourceSummaries: JobSourceSummary[] = [];

    sourceResults.forEach((result, index) => {
      const source = this.sources[index];

      if (result.status === 'fulfilled') {
        rawJobs.push(...result.value.jobs);
        sourceSummaries.push(...result.value.summaries);
        return;
      }

      sourceSummaries.push({
        source: source.name,
        label: defaultSourceSummaryLabel(source.name),
        focus: defaultSourceSummaryFocus(source.name),
        tier: defaultSourceSummaryTier(source.name),
        fetchedJobs: 0,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown source error',
      });
    });

    const normalizedJobs = rawJobs.map((rawJob) => normalizeJob(rawJob, config, now));
    const filteredJobs = normalizedJobs.map((job) => applyJobFilters(job, config));
    const relevantJobs = filteredJobs
      .filter((job) => job.isRelevant)
      .map((job) => rankJob(job, now, config));
    const rejectedJobs = filteredJobs.filter((job) => !job.isRelevant);
    const rankedJobs = deduplicateJobs(relevantJobs, now);

    return {
      rawJobs,
      sourceSummaries,
      rankedJobs,
      rejectedJobs,
    };
  }
}

function expandSearchConfig(config: JobResearchConfig, attempt: number): JobResearchConfig {
  if (attempt <= 0) {
    return config;
  }

  return {
    ...config,
    linkedIn: {
      ...config.linkedIn,
      maxPagesPerQuery: Math.min(
        SEARCH_EXPANSION_PAGE_CAPS.linkedIn,
        config.linkedIn.maxPagesPerQuery + attempt,
      ),
    },
    himalayas: {
      ...config.himalayas,
      maxPagesPerQuery: Math.min(
        SEARCH_EXPANSION_PAGE_CAPS.himalayas,
        config.himalayas.maxPagesPerQuery + attempt,
      ),
    },
    getOnBoard: {
      ...config.getOnBoard,
      maxPagesPerQuery: Math.min(
        SEARCH_EXPANSION_PAGE_CAPS.getOnBoard,
        config.getOnBoard.maxPagesPerQuery + attempt,
      ),
    },
    browserMcp: {
      ...config.browserMcp,
      globalMaxPages: config.browserMcp.globalMaxPages + attempt * 60,
      sites: Object.fromEntries(
        Object.entries(config.browserMcp.sites).map(([siteId, siteConfig]) => [
          siteId,
          {
            ...siteConfig,
            maxPagesPerQuery: Math.min(
              SEARCH_EXPANSION_PAGE_CAPS.browserMcpSite,
              siteConfig.maxPagesPerQuery + attempt,
            ),
            maxJobs: siteConfig.maxJobs + attempt * 100,
          },
        ]),
      ) as JobResearchConfig['browserMcp']['sites'],
    },
  };
}

function hasEnoughSeniorityReportJobs(
  counts: Record<SeniorityReportGroupV2, number>,
  config: Pick<
    JobResearchConfig,
    'minReportScore' | 'seniorityReportTargetJobs' | 'seniorityReportTargetJobsByGroup'
  >,
): boolean {
  return SENIORITY_REPORT_GROUP_V2_ORDER.every((group) => {
    const target = config.seniorityReportTargetJobsByGroup[group] ?? config.seniorityReportTargetJobs;
    return counts[group] >= target;
  });
}

function countRankedJobsByReportGroupV2(
  jobs: JobOpportunity[],
  config: Pick<
    JobResearchConfig,
    'minReportScore' | 'seniorityReportTargetJobs' | 'seniorityReportTargetJobsByGroup'
  >,
): Record<SeniorityReportGroupV2, number> {
  const counts = buildEmptyReportGroupCounts();

  for (const job of jobs) {
    if (job.score < config.minReportScore) {
      continue;
    }

    counts[toSeniorityReportGroupV2(job)] += 1;
  }

  return counts;
}

function buildFilterFunnelSummary(
  rawJobs: number,
  rankedJobs: JobOpportunity[],
  rejectedJobs: JobOpportunity[],
): JobFilterFunnelSummary {
  const rejectedByReason: Record<string, number> = {};
  const rejectedByReasonCombination: Record<string, number> = {};
  const rankedBySource: Record<string, number> = {};
  const rejectedBySource: Record<string, number> = {};
  const rankedByReportGroup = buildEmptyReportGroupCounts();
  const rejectedByReportGroup = buildEmptyReportGroupCounts();

  for (const job of rankedJobs) {
    incrementCount(rankedBySource, job.source);
    rankedByReportGroup[toSeniorityReportGroupV2(job)] += 1;
  }

  for (const job of rejectedJobs) {
    incrementCount(rejectedBySource, job.source);
    rejectedByReportGroup[toSeniorityReportGroupV2(job)] += 1;

    for (const reason of job.rejectionReasons) {
      incrementCount(rejectedByReason, reason);
    }

    incrementCount(
      rejectedByReasonCombination,
      job.rejectionReasons.length > 0 ? job.rejectionReasons.join(' | ') : 'No reason recorded',
    );
  }

  return {
    rawJobs,
    rankedJobs: rankedJobs.length,
    rejectedJobs: rejectedJobs.length,
    rejectedByReason: sortCountRecord(rejectedByReason),
    rejectedByReasonCombination: sortCountRecord(rejectedByReasonCombination),
    rankedBySource: sortCountRecord(rankedBySource),
    rejectedBySource: sortCountRecord(rejectedBySource),
    rankedByReportGroup,
    rejectedByReportGroup,
  };
}

function buildEmptyReportGroupCounts(): Record<SeniorityReportGroupV2, number> {
  return {
    junior: 0,
    pleno: 0,
    senior: 0,
    staff: 0,
    arq: 0,
    qa: 0,
    devops: 0,
    management: 0,
    other: 0,
  };
}

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function sortCountRecord(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).sort((left, right) => right[1] - left[1]),
  );
}

async function ensureReportJobsHaveWorkingUrls(
  preferredJobs: JobOpportunity[],
  backupJobs: JobOpportunity[],
  desiredCount: number,
  config: Pick<JobResearchConfig, 'requestTimeoutMs' | 'userAgent'>,
  urlValidationCache: Map<string, Promise<boolean>>,
): Promise<JobOpportunity[]> {
  const validatedJobs: JobOpportunity[] = [];
  const seenIds = new Set<string>();

  for (const job of [...preferredJobs, ...backupJobs]) {
    if (validatedJobs.length >= desiredCount || seenIds.has(job.id)) {
      continue;
    }

    seenIds.add(job.id);

    if (await hasWorkingReportUrl(job, config, urlValidationCache)) {
      validatedJobs.push(job);
    }
  }

  return validatedJobs;
}

async function buildValidatedSeniorityReportGroups(
  rankedJobs: JobOpportunity[],
  config: Pick<
    JobResearchConfig,
    'minReportScore' | 'seniorityReportTargetJobs' | 'seniorityReportMinimumJobs' | 'requestTimeoutMs' | 'userAgent'
  >,
  urlValidationCache: Map<string, Promise<boolean>>,
): Promise<CsvSeniorityJobGroups> {
  const filteredJobs = rankedJobs.filter((job) => job.score >= config.minReportScore);

  const junior = await selectValidJobsForGroup(
    filteredJobs.filter((job) => getSeniorityReportGroup(job.seniority) === 'junior'),
    config.seniorityReportTargetJobs,
    1,
    config,
    urlValidationCache,
  );
  const midLevel = await selectValidJobsForGroup(
    filteredJobs.filter((job) => getSeniorityReportGroup(job.seniority) === 'mid_level'),
    config.seniorityReportTargetJobs,
    config.seniorityReportMinimumJobs,
    config,
    urlValidationCache,
  );
  const seniorPlus = await selectValidJobsForGroup(
    filteredJobs.filter((job) => getSeniorityReportGroup(job.seniority) === 'senior_plus'),
    config.seniorityReportTargetJobs,
    config.seniorityReportMinimumJobs,
    config,
    urlValidationCache,
  );
  const techLead = await selectValidJobsForGroup(
    filteredJobs.filter((job) => job.roleCategory === 'tech_lead'),
    config.seniorityReportTargetJobs,
    1,
    config,
    urlValidationCache,
  );
  const devops = await selectValidJobsForGroup(
    filteredJobs.filter((job) => job.roleCategory === 'devops'),
    config.seniorityReportTargetJobs,
    1,
    config,
    urlValidationCache,
  );
  const architect = await selectValidJobsForGroup(
    filteredJobs.filter((job) => job.seniority === 'architect'),
    config.seniorityReportTargetJobs,
    1,
    config,
    urlValidationCache,
  );

  return {
    junior,
    midLevel,
    seniorPlus,
    techLead,
    devops,
    architect,
  };
}

/**
 * V2 partition helper: splits `rankedJobs` into the 7 canonical export groups
 * (`junior`, `pleno`, `senior`, `staff`, `arq`, `qa`, `devops`) using
 * {@link toSeniorityReportGroupV2} precedence, applies `score >= minReportScore`,
 * sorts each group by score descending, caps it at
 * `seniorityReportTargetJobsByGroup[g] ?? seniorityReportTargetJobs`, and
 * validates each job's URL using the same shared `urlValidationCache` as the
 * legacy V1 helper so we don't re-hit the network.
 *
 * Jobs classified as `"other"` (unknown seniority + neutral role category) are
 * intentionally dropped — they have no exportable CSV in V2.
 *
 * Exported for direct testing in `index.test.ts`; the pipeline consumes it via
 * {@link JobResearchAgent.run}.
 */
export async function buildValidatedSeniorityReportGroupsV2(
  rankedJobs: JobOpportunity[],
  config: Pick<
    JobResearchConfig,
    | 'minReportScore'
    | 'seniorityReportTargetJobs'
    | 'seniorityReportTargetJobsByGroup'
    | 'requestTimeoutMs'
    | 'userAgent'
  >,
  urlValidationCache: Map<string, Promise<boolean>>,
): Promise<CsvSeniorityJobGroupsV2> {
  const filteredJobs = rankedJobs.filter((job) => job.score >= config.minReportScore);
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

  for (const group of SENIORITY_REPORT_GROUP_V2_ORDER) {
    // "other" não é exportado como CSV e portanto não entra no shape V2.
    if (group === 'other') {
      continue;
    }

    const target =
      config.seniorityReportTargetJobsByGroup[group] ?? config.seniorityReportTargetJobs;

    // Ordem por score decrescente dentro do grupo; empates preservam a ordem
    // original já estabelecida pelo ranker/daily-variety.
    const jobsForGroup = filteredJobs
      .filter((job) => toSeniorityReportGroupV2(job) === group)
      .slice()
      .sort((left, right) => right.score - left.score);

    // Valida URLs compartilhando o cache com o V1 para evitar refetch.
    // `minimumJobs = 1` preserva semântica do V1 (grupo com 0 jobs retorna []).
    result[group] = await selectValidJobsForGroup(
      jobsForGroup,
      target,
      1,
      config,
      urlValidationCache,
    );
  }

  return result;
}

async function selectValidJobsForGroup(
  jobs: JobOpportunity[],
  targetJobs: number,
  minimumJobs: number,
  config: Pick<JobResearchConfig, 'requestTimeoutMs' | 'userAgent'>,
  urlValidationCache: Map<string, Promise<boolean>>,
): Promise<JobOpportunity[]> {
  const validJobs: JobOpportunity[] = [];

  for (const job of jobs) {
    if (validJobs.length >= targetJobs) {
      break;
    }

    if (await hasWorkingReportUrl(job, config, urlValidationCache)) {
      validJobs.push(job);
    }
  }

  return validJobs.length >= minimumJobs ? validJobs : [];
}

async function hasWorkingReportUrl(
  job: JobOpportunity,
  config: Pick<JobResearchConfig, 'requestTimeoutMs' | 'userAgent'>,
  urlValidationCache: Map<string, Promise<boolean>>,
): Promise<boolean> {
  if (!job.url) {
    return false;
  }

  const cachedResult = urlValidationCache.get(job.url);

  if (cachedResult) {
    return cachedResult;
  }

  const validationPromise = isUrlReachable(job.url, {
    headers: {
      'user-agent': config.userAgent,
    },
    timeoutMs: Math.min(config.requestTimeoutMs, 8_000),
  });
  urlValidationCache.set(job.url, validationPromise);

  return validationPromise;
}

/**
 * Creates the default `BrowserMcpEngine` instance used by the pipeline.
 *
 * The transport factory is intentionally a stub that throws — the real MCP
 * transport is provided by the IDE/agent environment via custom injection or a
 * future patch. When `browserMcp.enabled=false` (the default), the engine
 * short-circuits and never invokes the transport factory, so the stub is safe.
 *
 * Exported to allow override in tests and CLIs (e.g. `--browser-mcp-only`).
 */
export function createDefaultBrowserMcpEngine(config: JobResearchConfig): BrowserMcpEngine {
  const transportFactory = (): BrowserMcpTransport => {
    return createRealBrowserMcpTransport();
  };

  return new BrowserMcpEngine({
    transportFactory,
    traceWriter: new BrowserMcpTraceWriter(),
    adaptersFactory: getSiteAdapters,
  });
}

export function createDefaultJobResearchAgent(
  config: JobResearchConfig = defaultJobResearchConfig,
): JobResearchAgent {
  const sources: JobSource[] = [
    new ManualJobInputSource(),
    new ProgramaThorSource(),
    new LinkedInSource(),
    new HimalayasSource(),
    new GetOnBoardSource(),
    new GupySource(),
    new AshbySource(),
    new GreenhouseSource(),
    new LeverSource(),
    new RemotiveSource(),
    new RemoteOkSource(),
    createDefaultBrowserMcpEngine(config),
  ];

  return new JobResearchAgent(config, sources, new FileJobStorage(config.outputRootDir));
}

export function selectReportJobs(
  jobs: JobResearchRunResult['rankedJobs'],
  limit: number,
  minScore: number,
  brazilPrioritySelectionRatio: number,
) : { selectedJobs: JobResearchRunResult['selectedJobs']; selectionSummary: JobSelectionSummary } {
  const aboveThreshold = jobs.filter((job) => job.score >= minScore);
  const shouldUseThresholdFallback = aboveThreshold.length < limit && jobs.length > aboveThreshold.length;
  const candidatePool = shouldUseThresholdFallback ? jobs : aboveThreshold;
  const desiredPrimaryJobs = Math.floor(limit * brazilPrioritySelectionRatio);
  const desiredInternationalJobs = limit - desiredPrimaryJobs;
  const regionalPrimaryPool = candidatePool.filter((job) => isRegionalBrazilPriorityJob(job));
  const selectedRegionalPrimaryJobs = selectPrimaryJobsWithSeniorityCoverage(
    regionalPrimaryPool,
    desiredPrimaryJobs,
  );
  const selectedRegionalPrimaryIds = new Set(selectedRegionalPrimaryJobs.map((job) => job.id));
  const worldwideCompatiblePrimaryPool = candidatePool.filter(
    (job) =>
      !selectedRegionalPrimaryIds.has(job.id) &&
      isWorldwideRemoteClearlyCompatibleWithBrazil(job),
  );
  const selectedWorldwideCompatiblePrimaryJobs = selectJobsWithSourceDiversity(
    worldwideCompatiblePrimaryPool,
    Math.max(0, desiredPrimaryJobs - selectedRegionalPrimaryJobs.length),
  );
  const selectedPrimaryJobs = sortJobsByOriginalOrder(
    [...selectedRegionalPrimaryJobs, ...selectedWorldwideCompatiblePrimaryJobs],
    candidatePool,
  )
    .map((job) => assignReportBucket(job, 'primary'));
  const selectedPrimaryIds = new Set(selectedPrimaryJobs.map((job) => job.id));
  const fallbackPool = candidatePool.filter(
    (job) => job.jobMarket === 'international' && !selectedPrimaryIds.has(job.id),
  );
  const selectedSecondaryJobs = selectJobsWithSourceDiversity(
    fallbackPool,
    desiredInternationalJobs,
  )
    .map((job) => assignReportBucket(job, 'international_fallback'));
  const selectedIds = new Set(
    [...selectedPrimaryJobs, ...selectedSecondaryJobs].map((job) => job.id),
  );
  const remainingSlots = limit - selectedPrimaryJobs.length - selectedSecondaryJobs.length;
  const fillers =
    remainingSlots > 0
      ? selectJobsWithSourceDiversity(
          prioritizeRemainingJobs(
            candidatePool.filter((job) => !selectedIds.has(job.id)),
          ),
          remainingSlots,
        )
          .map((job) =>
            assignReportBucket(
              job,
              isPrimaryReportJob(job) ? 'primary' : 'international_fallback',
            ),
          )
      : [];
  const selectedJobs = sortJobsByOriginalOrder(
    [...selectedPrimaryJobs, ...selectedSecondaryJobs, ...fillers],
    candidatePool,
  );
  const marketCounts = buildMarketCounts(selectedJobs);

  return {
    selectedJobs,
    selectionSummary: {
      limit,
      minScore,
      desiredPrimaryJobs,
      desiredInternationalJobs,
      usedThresholdFallback: shouldUseThresholdFallback,
      selectedPrimaryJobs: selectedJobs.filter((job) => job.reportBucket === 'primary').length,
      selectedSecondaryJobs: selectedJobs.filter(
        (job) => job.reportBucket === 'international_fallback',
      ).length,
      selectedWorldwideCompatiblePrimaryJobs: selectedJobs.filter((job) =>
        job.reportBucket === 'primary' && isWorldwideRemoteClearlyCompatibleWithBrazil(job),
      ).length,
      filledFromSecondaryBecausePrimaryShortfall: Math.max(
        0,
        desiredPrimaryJobs - selectedPrimaryJobs.length,
      ),
      marketCounts,
    },
  };
}

function buildMarketCounts(
  jobs: JobResearchRunResult['selectedJobs'],
): Record<JobMarket, number> {
  return jobs.reduce<Record<JobMarket, number>>(
    (counts, job) => {
      counts[job.jobMarket] += 1;
      return counts;
    },
    {
      brazil: 0,
      brazil_friendly: 0,
      latam: 0,
      international: 0,
      unclear: 0,
    },
  );
}

function assignReportBucket(
  job: JobResearchRunResult['selectedJobs'][number],
  reportBucket: NonNullable<JobResearchRunResult['selectedJobs'][number]['reportBucket']>,
): JobResearchRunResult['selectedJobs'][number] {
  job.reportBucket = reportBucket;
  return job;
}

function selectPrimaryJobsWithSeniorityCoverage(
  jobs: JobResearchRunResult['rankedJobs'],
  limit: number,
): JobResearchRunResult['rankedJobs'] {
  if (limit <= 0) {
    return [];
  }

  if (jobs.length <= limit) {
    return jobs.slice(0, limit);
  }

  const selectedIds = new Set<string>();
  const seededJobs: JobResearchRunResult['rankedJobs'] = [];

  for (const { seniority, ratio } of PRIMARY_SENIORITY_TARGET_RATIOS) {
    const targetCount = Math.floor(limit * ratio);

    if (targetCount <= 0) {
      continue;
    }

    const matchingJobs = jobs.filter(
      (job) => job.seniority === seniority && !selectedIds.has(job.id),
    );

    for (const job of selectJobsWithSourceDiversity(matchingJobs, targetCount)) {
      selectedIds.add(job.id);
      seededJobs.push(job);
    }
  }

  const remainingJobs = selectJobsWithSourceDiversity(
    jobs.filter((job) => !selectedIds.has(job.id)),
    Math.max(0, limit - seededJobs.length),
  );

  return sortJobsByOriginalOrder([...seededJobs, ...remainingJobs], jobs).slice(0, limit);
}

function selectJobsWithSourceDiversity(
  jobs: JobResearchRunResult['rankedJobs'],
  limit: number,
): JobResearchRunResult['rankedJobs'] {
  if (limit <= 0) {
    return [];
  }

  if (jobs.length <= 1) {
    return jobs.slice(0, limit);
  }

  const jobsBySource = new Map<string, JobResearchRunResult['rankedJobs']>();

  for (const job of jobs) {
    const sourceJobs = jobsBySource.get(job.source) ?? [];
    sourceJobs.push(job);
    jobsBySource.set(job.source, sourceJobs);
  }

  const orderedSources = [...jobsBySource.entries()]
    .sort((left, right) => {
      const leftTopScore = left[1][0]?.score ?? 0;
      const rightTopScore = right[1][0]?.score ?? 0;

      if (leftTopScore !== rightTopScore) {
        return rightTopScore - leftTopScore;
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([source]) => source);

  const nextIndexBySource = new Map(orderedSources.map((source) => [source, 0]));
  const selectedCountBySource = new Map(orderedSources.map((source) => [source, 0]));
  const maxJobsPerSource = Math.max(1, Math.ceil(limit * MAX_SOURCE_SHARE_RATIO));
  const selectedJobs: JobResearchRunResult['rankedJobs'] = [];

  while (selectedJobs.length < limit) {
    let madeProgress = false;

    for (const source of orderedSources) {
      const selectedCount = selectedCountBySource.get(source) ?? 0;

      if (selectedCount >= maxJobsPerSource) {
        continue;
      }

      const sourceJobs = jobsBySource.get(source) ?? [];
      const nextIndex = nextIndexBySource.get(source) ?? 0;

      if (nextIndex >= sourceJobs.length) {
        continue;
      }

      selectedJobs.push(sourceJobs[nextIndex]);
      nextIndexBySource.set(source, nextIndex + 1);
      selectedCountBySource.set(source, selectedCount + 1);
      madeProgress = true;

      if (selectedJobs.length >= limit) {
        break;
      }
    }

    if (!madeProgress) {
      break;
    }
  }

  const selectedIds = new Set(selectedJobs.map((job) => job.id));
  const remainingJobs = jobs.filter((job) => !selectedIds.has(job.id));

  return [...selectedJobs, ...remainingJobs].slice(0, limit);
}

function sortJobsByOriginalOrder(
  jobs: JobResearchRunResult['rankedJobs'],
  orderedPool: JobResearchRunResult['rankedJobs'],
): JobResearchRunResult['rankedJobs'] {
  const orderById = new Map(orderedPool.map((job, index) => [job.id, index]));

  return jobs
    .slice()
    .sort((left, right) => (orderById.get(left.id) ?? 0) - (orderById.get(right.id) ?? 0));
}

function isRegionalBrazilPriorityJob(
  job: Pick<JobOpportunity, 'jobMarket'>,
): boolean {
  return isPrimaryBrazilMarket(job.jobMarket);
}

function prioritizeRemainingJobs(
  jobs: JobResearchRunResult['rankedJobs'],
): JobResearchRunResult['rankedJobs'] {
  const regionalPrimaryJobs = jobs.filter((job) => isRegionalBrazilPriorityJob(job));
  const worldwideCompatibleJobs = jobs.filter((job) =>
    !isRegionalBrazilPriorityJob(job) && isWorldwideRemoteClearlyCompatibleWithBrazil(job),
  );
  const otherJobs = jobs.filter(
    (job) =>
      !isRegionalBrazilPriorityJob(job) &&
      !isWorldwideRemoteClearlyCompatibleWithBrazil(job),
  );

  return [...regionalPrimaryJobs, ...worldwideCompatibleJobs, ...otherJobs];
}

function defaultSourceSummaryLabel(sourceName: JobSourceSummary['source']): string {
  switch (sourceName) {
    case 'manual':
      return 'Manual intake';
    case 'programathor':
      return 'ProgramaThor jobs';
    case 'linkedin':
      return 'LinkedIn public jobs search';
    case 'himalayas':
      return 'Himalayas Brazil search';
    case 'getonboard':
      return 'Get on Board Brazil search';
    case 'gupy':
      return 'Gupy Brasil';
    case 'ashby':
      return 'Ashby';
    case 'greenhouse':
      return 'Greenhouse';
    case 'lever':
      return 'Lever';
    case 'remotive':
      return 'Remotive';
    case 'remoteok':
      return 'RemoteOK';
    case 'browser_mcp':
      // Placeholder até a engine real conectar-se no Phase B (task 3.9).
      return 'Browser MCP';
  }
}

function defaultSourceSummaryFocus(sourceName: JobSourceSummary['source']): JobSourceFocus {
  switch (sourceName) {
    case 'manual':
      return 'mixed';
    case 'programathor':
      return 'brazil';
    case 'linkedin':
      return 'brazil';
    case 'himalayas':
    case 'getonboard':
    case 'gupy':
      return 'brazil';
    case 'ashby':
      return 'global';
    case 'greenhouse':
    case 'lever':
    case 'remotive':
    case 'remoteok':
      return 'global';
    case 'browser_mcp':
      // Placeholder até a engine real conectar-se no Phase B (task 3.9).
      return 'mixed';
  }
}

function defaultSourceSummaryTier(sourceName: JobSourceSummary['source']): JobSourceTier {
  switch (sourceName) {
    case 'manual':
      return 'manual_curated';
    case 'programathor':
      return 'brazil_public_api';
    case 'linkedin':
      return 'brazil_public_api';
    case 'himalayas':
    case 'getonboard':
    case 'gupy':
      return 'brazil_public_api';
    case 'ashby':
      return 'direct_company_board';
    case 'greenhouse':
    case 'lever':
      return 'direct_company_board';
    case 'remotive':
    case 'remoteok':
      return 'global_aggregator';
    case 'browser_mcp':
      // Placeholder até a engine real conectar-se no Phase B (task 3.9).
      return 'global_aggregator';
  }
}

function buildDailyVarietyContext(
  now: Date,
  recentSelectionHistory: Map<string, number>,
  config: Pick<
    JobResearchConfig,
    'dailyVarietyRepeatPenalty' | 'dailyVarietyScoreBandSize'
  >,
): DailyVarietyContext {
  return {
    dayKey: formatLocalDateKey(now),
    recentSelectionHistory,
    repeatPenalty: Math.max(1, config.dailyVarietyRepeatPenalty),
    scoreBandSize: Math.max(1, config.dailyVarietyScoreBandSize),
  };
}

function applyDailyVarietyOrdering(
  jobs: JobResearchRunResult['rankedJobs'],
  context: DailyVarietyContext,
): JobResearchRunResult['rankedJobs'] {
  const originalOrder = new Map(jobs.map((job, index) => [job.id, index]));

  return jobs.slice().sort((left, right) =>
    compareJobsForDailyVariety(left, right, context, originalOrder),
  );
}

function compareJobsForDailyVariety(
  left: JobOpportunity,
  right: JobOpportunity,
  context: DailyVarietyContext,
  originalOrder: Map<string, number>,
): number {
  const leftAdjustedScore = getDailyVarietyAdjustedScore(left, context);
  const rightAdjustedScore = getDailyVarietyAdjustedScore(right, context);
  const leftBand = Math.floor(leftAdjustedScore / context.scoreBandSize);
  const rightBand = Math.floor(rightAdjustedScore / context.scoreBandSize);

  if (leftBand !== rightBand) {
    return rightBand - leftBand;
  }

  const leftAge = getRecentSelectionAge(left, context);
  const rightAge = getRecentSelectionAge(right, context);

  if (leftAge !== rightAge) {
    return compareOptionalNumbers(leftAge, rightAge);
  }

  const leftRotation = getDailyRotationValue(left, context.dayKey);
  const rightRotation = getDailyRotationValue(right, context.dayKey);

  if (leftRotation !== rightRotation) {
    return rightRotation - leftRotation;
  }

  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0);
}

function getDailyVarietyAdjustedScore(job: JobOpportunity, context: DailyVarietyContext): number {
  const recentAge = getRecentSelectionAge(job, context);

  if (recentAge === undefined) {
    return job.score;
  }

  const penalty = Math.max(1, context.repeatPenalty - (recentAge - 1));
  return job.score - penalty;
}

function getRecentSelectionAge(
  job: JobOpportunity,
  context: DailyVarietyContext,
): number | undefined {
  const keys = [
    `id:${job.id}`,
    `url:${normalizeJobUrl(job.url, job.sourceId)}`,
  ];

  return keys.reduce<number | undefined>((bestAge, key) => {
    const age = context.recentSelectionHistory.get(key);

    if (age === undefined) {
      return bestAge;
    }

    return bestAge === undefined ? age : Math.min(bestAge, age);
  }, undefined);
}

function wasRecentlySelected(
  job: JobOpportunity,
  recentSelectionHistory: Map<string, number>,
): boolean {
  // Only hard-block jobs that were selected on PREVIOUS calendar days (age >= 1).
  // Same-day entries (age = 0) are soft-penalized by daily variety ordering instead.
  return [
    `id:${job.id}`,
    `url:${normalizeJobUrl(job.url, job.sourceId)}`,
  ].some((key) => {
    const age = recentSelectionHistory.get(key);
    return age !== undefined && age >= 1;
  });
}

function compareOptionalNumbers(left: number | undefined, right: number | undefined): number {
  if (left === right) {
    return 0;
  }

  if (left === undefined) {
    return -1;
  }

  if (right === undefined) {
    return 1;
  }

  return right - left;
}

function getDailyRotationValue(job: JobOpportunity, dayKey: string): number {
  const hash = createHash('sha1')
    .update(`${dayKey}::${job.id}`)
    .digest('hex')
    .slice(0, 8);

  return Number.parseInt(hash, 16);
}

function formatLocalDateKey(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
