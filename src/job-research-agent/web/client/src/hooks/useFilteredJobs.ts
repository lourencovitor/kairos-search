import { useDeferredValue, useMemo } from 'react';

import type { JobOpportunity } from '../api/types.js';
import { unique } from '../utils/format-helpers.js';
import { reportGroup } from '../utils/report-group.js';

export interface FilterState {
  query: string;
  group: string;
  market: string;
  score: number;
  remoteOnly: boolean;
}

export function useFilteredJobs(jobs: JobOpportunity[], filters: FilterState) {
  const deferredQuery = useDeferredValue(filters.query);

  const markets = useMemo(() => unique(jobs.map((j) => j.jobMarket)), [jobs]);

  const filteredJobs = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      const hay = [job.companyName, job.title, job.locationText, ...(job.stackSignals ?? [])]
        .join(' ')
        .toLowerCase();
      return (
        (!q || hay.includes(q)) &&
        (!filters.group || reportGroup(job) === filters.group) &&
        (!filters.market || job.jobMarket === filters.market) &&
        job.score >= filters.score &&
        (!filters.remoteOnly || job.remotePolicy === 'remote')
      );
    });
  }, [deferredQuery, filters.group, filters.market, jobs, filters.remoteOnly, filters.score]);

  return { filteredJobs, markets };
}
