import { describe, expect, it } from 'vitest';

import type { JobOpportunity } from '../../domain/job.types.js';
import { filterStaleJobs } from './stale-jobs-filter.service.js';

function makeJob(overrides: Partial<JobOpportunity> = {}): JobOpportunity {
  return {
    id: Math.random().toString(36).slice(2),
    companyName: 'ACME',
    title: 'Engineer',
    url: `https://example.com/job/${Math.random()}`,
    source: 'test',
    locationText: 'Remote',
    jobMarket: 'brazil',
    seniority: 'pleno',
    roleCategory: 'fullstack',
    remotePolicy: 'remote',
    stackSignals: [],
    score: 80,
    ...overrides,
  } as JobOpportunity;
}

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe('filterStaleJobs', () => {
  it('keeps jobs with no date', () => {
    const job = makeJob({ publishedAt: undefined, updatedAt: undefined, discoveredAt: undefined });
    expect(filterStaleJobs([job], 14)).toHaveLength(1);
  });

  it('keeps jobs published within maxAgeDays', () => {
    const job = makeJob({ publishedAt: daysAgo(10) });
    expect(filterStaleJobs([job], 14)).toHaveLength(1);
  });

  it('drops jobs older than maxAgeDays', () => {
    const job = makeJob({ publishedAt: daysAgo(20) });
    expect(filterStaleJobs([job], 14)).toHaveLength(0);
  });

  it('uses updatedAt over publishedAt when both are present', () => {
    const job = makeJob({ publishedAt: daysAgo(20), updatedAt: daysAgo(5) });
    expect(filterStaleJobs([job], 14)).toHaveLength(1);
  });

  it('deduplicates jobs with same URL', () => {
    const url = 'https://example.com/job/42';
    const job1 = makeJob({ url });
    const job2 = makeJob({ url });
    expect(filterStaleJobs([job1, job2], 14)).toHaveLength(1);
  });

  it('deduplicates URLs with trailing slash', () => {
    const job1 = makeJob({ url: 'https://example.com/job/42' });
    const job2 = makeJob({ url: 'https://example.com/job/42/' });
    expect(filterStaleJobs([job1, job2], 14)).toHaveLength(1);
  });

  it('keeps jobs with different URLs', () => {
    const job1 = makeJob({ url: 'https://example.com/job/1' });
    const job2 = makeJob({ url: 'https://example.com/job/2' });
    expect(filterStaleJobs([job1, job2], 14)).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(filterStaleJobs([], 14)).toHaveLength(0);
  });
});
