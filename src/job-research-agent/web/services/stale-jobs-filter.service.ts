import type { JobOpportunity } from '../../domain/job.types.js';

export function filterStaleJobs(jobs: JobOpportunity[], maxAgeDays: number): JobOpportunity[] {
  const now = Date.now();
  const cutoffMs = maxAgeDays * 86_400_000;
  const seen = new Set<string>();
  const result: JobOpportunity[] = [];

  for (const job of jobs) {
    const bestDate = [job.updatedAt, job.publishedAt, job.discoveredAt]
      .map((d) => (d ? Date.parse(d) : NaN))
      .find((t) => !Number.isNaN(t));
    if (bestDate !== undefined && now - bestDate > cutoffMs) {
      continue;
    }

    const urlKey = (job.url ?? '').toLowerCase().replace(/[/?#]$/, '');
    if (urlKey && seen.has(urlKey)) {
      continue;
    }
    if (urlKey) seen.add(urlKey);

    result.push(job);
  }

  return result;
}
