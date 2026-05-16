import type { JobResearchConfig } from '../config/job-research.config.js';
import type { JobOpportunity } from '../domain/job.types.js';
import {
  clamp,
  freshestAgeInDays,
  getHostname,
  normalizeForComparison,
  uniqueStrings,
} from '../shared/job.util.js';
import { toSeniorityReportGroupV2 } from '../shared/job-taxonomy.util.js';
import {
  hasHardRestriction,
  isVisaClearlyCompatibleForBrazilSelection,
  isWorldwideRemoteClearlyCompatibleWithBrazil,
} from './job-selection-policy.skill.js';

const ROLE_SCORES: Record<string, number> = {
  'Cloud Architect': 30,
  'Solutions Architect': 29,
  'Software Architect': 28,
  'Tech Lead': 26,
  'Principal Software Engineer': 25,
  'Staff Software Engineer': 24,
  'Senior Software Engineer': 22,
  'Software Engineer': 18,
};

export function rankJob(
  job: JobOpportunity,
  now: Date,
  config: Pick<
    JobResearchConfig,
    'technicalKeywordProfiles' | 'preferredSourcePlatforms' | 'globalFallbackReportGroups'
  >,
): JobOpportunity {
  const titleMatch = Math.max(
    ...job.roleMatches.map((role) => ROLE_SCORES[role] ?? 0),
    0,
  );

  const seniorityFit = scoreSeniority(job);
  const marketFit = scoreMarket(job, config);
  const locationBoost = scoreBrazilLocation(job);
  const stackMatch = scoreStack(job, config);
  const preferredPlatformBoost = scorePreferredPlatform(job, config.preferredSourcePlatforms);
  const sourceQuality = job.sourceQualityRank;
  const recency = scoreRecency(job, now);
  const compensation = job.salaryText ? 2 : 0;
  const restrictionsPenalty = scoreRestrictionsPenalty(job);
  const clarityPenalty = scoreClarityPenalty(job);
  const stackPenalty = scoreStackPenalty(job);

  const total = clamp(
    titleMatch +
      seniorityFit +
      marketFit +
      locationBoost +
      stackMatch +
      preferredPlatformBoost +
      sourceQuality +
      recency +
      compensation -
      restrictionsPenalty -
      clarityPenalty -
      stackPenalty,
    0,
    100,
  );

  job.scoreBreakdown = {
    titleMatch,
    seniorityFit,
    marketFit,
    locationBoost,
    stackMatch,
    preferredPlatformBoost,
    sourceQuality,
    recency,
    compensation,
    restrictionsPenalty,
    clarityPenalty,
    stackPenalty,
    total,
  };
  job.score = total;

  return job;
}

function scoreSeniority(job: JobOpportunity): number {
  switch (job.seniority) {
    case 'architect':
      return 10;
    case 'principal':
      return 9;
    case 'staff':
      return 8;
    case 'lead':
      return 8;
    case 'staff_or_principal':
      return 9;
    case 'senior':
      return 7;
    case 'mid_level':
      return 5;
    case 'junior':
      return 4;
    case 'unknown':
      return 4;
  }
}

function scoreMarket(
  job: JobOpportunity,
  config: Pick<JobResearchConfig, 'globalFallbackReportGroups'>,
): number {
  if (job.remotePolicy === 'remote') {
    switch (job.jobMarket) {
      case 'brazil':
        return 34;
      case 'brazil_friendly':
        return 29;
      case 'latam':
        return 23;
      case 'international':
        if (isWorldwideRemoteClearlyCompatibleWithBrazil(job)) {
          return 14;
        }
        return isAllowedGlobalFallbackRankingCandidate(job, config) ? 8 : 0;
      case 'unclear':
        return 0;
    }
  }

  if (
    job.jobMarket === 'brazil' &&
    job.brazilLocationPriority !== 'none' &&
    job.remotePolicy === 'hybrid'
  ) {
    return 18;
  }

  if (
    job.jobMarket === 'brazil' &&
    job.brazilLocationPriority !== 'none' &&
    job.remotePolicy === 'onsite'
  ) {
    return 10;
  }

  return 0;
}

function isAllowedGlobalFallbackRankingCandidate(
  job: JobOpportunity,
  config: Pick<JobResearchConfig, 'globalFallbackReportGroups'>,
): boolean {
  const group = toSeniorityReportGroupV2(job);

  return (
    config.globalFallbackReportGroups.includes(group) &&
    group !== 'junior' &&
    group !== 'pleno' &&
    group !== 'other' &&
    job.remotePolicy === 'remote' &&
    job.jobMarket === 'international' &&
    !hasHardRestriction(job) &&
    isVisaClearlyCompatibleForBrazilSelection(job.visaSignal)
  );
}

function scoreBrazilLocation(job: JobOpportunity): number {
  switch (job.brazilLocationPriority) {
    case 'sao_paulo':
      return 12;
    case 'rio_de_janeiro':
      return 11;
    case 'major_city':
      return 9;
    case 'none':
      return 0;
  }
}

function scoreStack(
  job: JobOpportunity,
  config: Pick<JobResearchConfig, 'technicalKeywordProfiles'>,
): number {
  const weightMap = new Map(
    config.technicalKeywordProfiles.map((profile) => [profile.label, profile.weight]),
  );
  const weightedScore = job.stackSignals.reduce(
    (total, signal) => total + (weightMap.get(signal) ?? 1),
    0,
  );
  const baseScore = Math.min(24, weightedScore);
  const preferredStackBonus =
    job.stackSignals.filter((signal) =>
      [
        'aws',
        'terraform',
        'javascript',
        'typescript',
        'nestjs',
        'reactjs',
        'postgres',
        'redis',
        'microservices',
        'micro-frontends',
      ].includes(signal),
    ).length >= 3
      ? 4
      : 0;
  const cloudBonus =
    job.roleMatches.some((role) => role.includes('Architect')) &&
    job.stackSignals.some((signal) =>
      ['aws', 'gcp', 'azure', 'terraform', 'kubernetes', 'cloud'].includes(signal),
    )
      ? 4
      : 0;

  return Math.min(28, baseScore + preferredStackBonus + cloudBonus);
}

function scoreRecency(job: JobOpportunity, now: Date): number {
  const ageInDays = freshestAgeInDays(now, job.updatedAt, job.publishedAt);

  if (ageInDays === undefined) {
    return 1;
  }

  if (ageInDays <= 1) {
    return 10;
  }

  if (ageInDays <= 3) {
    return 8;
  }

  if (ageInDays <= 7) {
    return 7;
  }

  if (ageInDays <= 14) {
    return 4;
  }

  if (ageInDays <= 30) {
    return 1;
  }

  return 0;
}

function scoreRestrictionsPenalty(job: JobOpportunity): number {
  let penalty = 0;

  if (hasHardRestriction(job)) {
    penalty += 40;
  } else if (
    job.remotePolicy === 'remote' &&
    job.jobMarket === 'international' &&
    !isWorldwideRemoteClearlyCompatibleWithBrazil(job)
  ) {
    penalty += 35;
  } else if (job.remotePolicy === 'remote' && job.jobMarket === 'unclear') {
    penalty += 35;
  }

  if (
    (job.remotePolicy === 'hybrid' || job.remotePolicy === 'onsite') &&
    job.jobMarket !== 'brazil'
  ) {
    penalty += 30;
  }

  if (job.visaSignal === 'not_supported' || job.visaSignal === 'requires_work_authorization') {
    penalty += 10;
  }

  return penalty;
}

function scoreClarityPenalty(job: JobOpportunity): number {
  let penalty = 0;

  if (job.remotePolicy === 'unknown') {
    penalty += 25;
  }

  return penalty;
}

function scoreStackPenalty(job: JobOpportunity): number {
  if (job.stackSignals.length >= 2) {
    return 0;
  }

  // QA roles list test tooling (Selenium, Cypress, Playwright) that often
  // doesn't appear in our dev-stack keyword profiles — apply a lighter penalty.
  if (job.roleCategory === 'qa') {
    return job.stackSignals.length === 0 ? 4 : 0;
  }

  if (job.seniority === 'junior') {
    return job.stackSignals.length === 0 ? 10 : 4;
  }

  if (job.seniority === 'mid_level') {
    return job.stackSignals.length === 0 ? 12 : 6;
  }

  if (job.seniority === 'unknown') {
    return 12;
  }

  return 20;
}

function scorePreferredPlatform(job: JobOpportunity, preferredPlatforms: string[]): number {
  const manualSource =
    typeof job.metadata.manualSource === 'string' ? job.metadata.manualSource : undefined;
  const platformSignals = uniqueStrings([
    job.sourceBoard,
    manualSource,
    getHostname(job.url),
    job.source,
  ]).map(toCompactComparable);

  const matchedPreferredPlatformCount = preferredPlatforms.filter((platform) => {
    const normalizedPlatform = toCompactComparable(platform);
    return platformSignals.some((signal) => signal.includes(normalizedPlatform));
  }).length;

  return Math.min(16, matchedPreferredPlatformCount * 8);
}

function toCompactComparable(value: string): string {
  return normalizeForComparison(value).replace(/\s+/g, '');
}
