import type { JobResearchConfig } from '../config/job-research.config.js';
import type { JobOpportunity } from '../domain/job.types.js';
import { freshestAgeInDays, normalizeForComparison } from '../shared/job.util.js';
import { toSeniorityReportGroupV2 } from '../shared/job-taxonomy.util.js';
import { isPrimaryBrazilMarket } from './job-market-classifier.skill.js';
import {
  hasHardRestriction,
  isVisaClearlyCompatibleForBrazilSelection,
  isWorldwideRemoteClearlyCompatibleWithBrazil,
} from './job-selection-policy.skill.js';

export function applyJobFilters(
  job: JobOpportunity,
  config: JobResearchConfig,
): JobOpportunity {
  const rejectionReasons: string[] = [];
  const normalizedTitle = normalizeForComparison(job.title);

  if (!job.companyName || !job.title || !job.url) {
    rejectionReasons.push('Missing core job fields');
  }

  if (
    config.excludedTitleKeywords.some((keyword) => {
      const escaped = normalizeForComparison(keyword).replace(/\s+/g, '\\s+');
      return new RegExp(`\\b${escaped}\\b`).test(normalizedTitle);
    })
  ) {
    rejectionReasons.push('Excluded title category');
  }

  if (job.roleMatches.length === 0) {
    rejectionReasons.push('Title does not match the target role families');
  }

  const jobAgeInDays = freshestAgeInDays(
    new Date(job.discoveredAt),
    job.updatedAt,
    job.publishedAt,
  );

  const maxJobAgeDays = getMaxJobAgeDays(job, config);

  if (jobAgeInDays !== undefined && jobAgeInDays > maxJobAgeDays) {
    rejectionReasons.push(`Job is older than ${maxJobAgeDays} days`);
  }

  if (
    config.restrictToBrazilPriorityMarkets &&
    !isPrimaryBrazilMarket(job.jobMarket) &&
    !isAllowedNonPrimaryMarketJob(job, config)
  ) {
    rejectionReasons.push('Only Brazil-priority markets are allowed in the current mode');
  }

  if (job.stackSignals.length < config.minimumStackSignalCount) {
    rejectionReasons.push('Job does not meet the minimum stack match threshold');
  }

  if (
    job.remotePolicy === 'onsite' &&
    !config.includeOnsite &&
    job.jobMarket !== 'brazil'
  ) {
    rejectionReasons.push('Onsite roles are only considered when they are Brazil-based');
  }

  if (
    job.remotePolicy === 'hybrid' &&
    !config.includeHybrid &&
    job.jobMarket !== 'brazil'
  ) {
    rejectionReasons.push('Hybrid roles are only considered when they are Brazil-based');
  }

  job.rejectionReasons = rejectionReasons;
  job.isRelevant = rejectionReasons.length === 0;

  return job;
}

function isJuniorOrPleno(job: JobOpportunity): boolean {
  const reportGroup = toSeniorityReportGroupV2(job);
  return reportGroup === 'junior' || reportGroup === 'pleno';
}

function getMaxJobAgeDays(job: JobOpportunity, config: JobResearchConfig): number {
  return config.maxJobAgeDaysBySourceTier[job.sourceTier] ?? config.maxJobAgeDays;
}

function isAllowedNonPrimaryMarketJob(job: JobOpportunity, config: JobResearchConfig): boolean {
  const reportGroup = toSeniorityReportGroupV2(job);

  if (!config.globalFallbackReportGroups.includes(reportGroup)) {
    return false;
  }

  if (reportGroup === 'junior' || reportGroup === 'pleno' || reportGroup === 'other') {
    return false;
  }

  if (isWorldwideRemoteClearlyCompatibleWithBrazil(job)) {
    return true;
  }

  if (job.remotePolicy !== 'remote') {
    return false;
  }

  if (job.jobMarket !== 'international') {
    return false;
  }

  return (
    job.regionFit !== 'incompatible' &&
    !hasHardRestriction(job) &&
    isVisaClearlyCompatibleForBrazilSelection(job.visaSignal)
  );
}
