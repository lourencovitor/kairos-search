import { useDeferredValue, useMemo } from 'react';

import type { JobOpportunity } from '../api/types.js';
import { unique } from '../utils/format-helpers.js';
import { reportGroup } from '../utils/report-group.js';

export interface FilterState {
  query: string;
  groups: string[];
  marketFilter: string[];
  score: number;
  remotePolicies: string[];
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
        (!filters.groups.length || filters.groups.includes(reportGroup(job))) &&
        (!filters.marketFilter.length ||
          filters.marketFilter.some((m) =>
            m === 'brazil'
              ? job.jobMarket === 'brazil' || job.jobMarket === 'brazil_friendly'
              : job.jobMarket === m,
          )) &&
        job.score >= filters.score &&
        (!filters.remotePolicies.length ||
          filters.remotePolicies.length >= 3 ||
          filters.remotePolicies.includes(job.remotePolicy))
      );
    });
  }, [
    deferredQuery,
    filters.groups,
    filters.marketFilter,
    jobs,
    filters.remotePolicies,
    filters.score,
  ]);

  return { filteredJobs, markets };
}
