import type {
  JobOpportunity,
  RegionFit,
  ReportSelectionBucket,
  VisaSignal,
} from '../domain/job.types.js';
import { isPrimaryBrazilMarket } from './job-market-classifier.skill.js';

const HARD_RESTRICTION_SIGNALS = new Set([
  'US-only restriction',
  'Canada-only restriction',
  'Europe restriction',
  'EMEA restriction',
  'UK-only restriction',
  'Australia-only restriction',
  'Citizenship required',
  'Security clearance required',
]);

const BRAZIL_COMPATIBLE_GLOBAL_SIGNALS = new Set([
  'worldwide',
  'americas',
  'south_america',
  'latam',
  'brazil',
]);

const FOREIGN_LIMITING_SIGNALS = new Set([
  'usa',
  'canada',
  'europe',
  'emea',
  'uk',
  'apac',
  'asia',
  'oceania',
  'india',
  'turkiye',
  'australia',
  'philippines',
  'singapore',
  'japan',
  'germany',
  'poland',
  'spain',
  'portugal',
  'france',
  'netherlands',
  'china',
  'taiwan',
]);

export function hasHardRestriction(
  job: Pick<JobOpportunity, 'restrictionSignals'>,
): boolean {
  return job.restrictionSignals.some((signal) => HARD_RESTRICTION_SIGNALS.has(signal));
}

export function isVisaClearlyCompatibleForBrazilSelection(
  visaSignal: VisaSignal,
): boolean {
  return visaSignal !== 'not_supported' && visaSignal !== 'requires_work_authorization';
}

export function isWorldwideRemoteClearlyCompatibleWithBrazil(
  job: Pick<
    JobOpportunity,
    'jobMarket' | 'remotePolicy' | 'regionFit' | 'marketSignals' | 'restrictionSignals' | 'visaSignal'
  >,
): boolean {
  if (job.jobMarket !== 'international' || job.remotePolicy !== 'remote') {
    return false;
  }

  if (hasHardRestriction(job) || !isVisaClearlyCompatibleForBrazilSelection(job.visaSignal)) {
    return false;
  }

  if (job.regionFit === 'incompatible') {
    return false;
  }

  const hasBroadBrazilCompatibleSignal = job.marketSignals.some((signal) =>
    BRAZIL_COMPATIBLE_GLOBAL_SIGNALS.has(signal),
  );
  const hasForeignLimitingSignal = job.marketSignals.some((signal) =>
    FOREIGN_LIMITING_SIGNALS.has(signal),
  );
  const hasLatamOrBrazilSignal = job.marketSignals.some((signal) =>
    ['brazil', 'latam', 'south_america', 'americas'].includes(signal),
  );

  if (hasForeignLimitingSignal && !hasLatamOrBrazilSignal) {
    return false;
  }

  // No geographic restriction signals at all → open worldwide remote, compatible
  if (!hasForeignLimitingSignal) {
    return true;
  }

  // Has both foreign and Brazil/LATAM signals — require an explicit compatible region/signal
  return (
    isBroadBrazilCompatibleRegion(job.regionFit) ||
    hasBroadBrazilCompatibleSignal
  );
}

export function isPrimaryReportJob(
  job: Pick<
    JobOpportunity,
    'jobMarket' | 'remotePolicy' | 'regionFit' | 'marketSignals' | 'restrictionSignals' | 'visaSignal'
  >,
): boolean {
  return (
    isPrimaryBrazilMarket(job.jobMarket) ||
    isWorldwideRemoteClearlyCompatibleWithBrazil(job)
  );
}

export function getReportSelectionBucket(
  job: Pick<
    JobOpportunity,
    'jobMarket' | 'remotePolicy' | 'regionFit' | 'marketSignals' | 'restrictionSignals' | 'visaSignal'
  >,
): ReportSelectionBucket {
  return isPrimaryReportJob(job) ? 'primary' : 'international_fallback';
}

function isBroadBrazilCompatibleRegion(regionFit: RegionFit): boolean {
  return regionFit === 'worldwide' || regionFit === 'brazil_or_latam';
}
