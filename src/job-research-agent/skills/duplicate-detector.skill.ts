import type { JobOpportunity } from '../domain/job.types.js';
import { buildLocationBucket } from '../shared/location.util.js';
import { daysSince } from '../shared/job.util.js';

export function deduplicateJobs(jobs: JobOpportunity[], now: Date): JobOpportunity[] {
  const winners = new Map<string, JobOpportunity>();

  for (const job of jobs) {
    const key = buildDeduplicationKey(job);
    const currentWinner = winners.get(key);

    if (!currentWinner || isBetterJob(job, currentWinner, now)) {
      winners.set(key, job);
    }
  }

  return [...winners.values()].sort((left, right) => compareJobs(right, left, now));
}

function buildDeduplicationKey(job: JobOpportunity): string {
  return [
    job.normalizedCompanyName,
    simplifyTitleForDeduplication(job.normalizedTitle),
    buildLocationBucket(job.remoteRegions, job.locationText),
  ].join('::');
}

function simplifyTitleForDeduplication(title: string): string {
  return title.replace(/\bremote\b/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function isBetterJob(candidate: JobOpportunity, current: JobOpportunity, now: Date): boolean {
  return compareJobs(candidate, current, now) > 0;
}

function compareJobs(left: JobOpportunity, right: JobOpportunity, now: Date): number {
  if (left.score !== right.score) {
    return left.score - right.score;
  }

  const leftPriority = left.sourceQualityRank;
  const rightPriority = right.sourceQualityRank;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftAge = daysSince(left.updatedAt ?? left.publishedAt, now) ?? Number.MAX_SAFE_INTEGER;
  const rightAge = daysSince(right.updatedAt ?? right.publishedAt, now) ?? Number.MAX_SAFE_INTEGER;

  if (leftAge !== rightAge) {
    return rightAge - leftAge;
  }

  return left.descriptionText.length - right.descriptionText.length;
}
