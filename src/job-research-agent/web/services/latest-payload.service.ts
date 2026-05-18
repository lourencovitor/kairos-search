import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { JobOpportunity } from '../../domain/job.types.js';
import { downloadableFiles, labelDownload } from '../shared/downloadable-files.js';
import { filterStaleJobs } from './stale-jobs-filter.service.js';

export interface LatestPayload {
  summary: { generatedAt?: string } | null;
  jobs: JobOpportunity[];
  downloads: Array<{ name: string; label: string; size: number }>;
  funnel: unknown | null;
}

export async function readLatestPayload(
  latestDir: string,
  maxAgeDays: number,
): Promise<LatestPayload> {
  const [summary, selectedJobs, rankedJobs, funnel] = await Promise.all([
    readJsonOrNull<{ generatedAt?: string }>(path.join(latestDir, 'summary.json')),
    readJsonOrNull<JobOpportunity[]>(path.join(latestDir, 'selected-jobs.json')),
    readJsonOrNull<JobOpportunity[]>(path.join(latestDir, 'ranked-jobs.json')),
    readJsonOrNull(path.join(latestDir, 'filter-funnel.json')),
  ]);

  const allJobs = rankedJobs ?? selectedJobs ?? [];
  const jobs = filterStaleJobs(allJobs, maxAgeDays);
  const downloads = await listDownloads(latestDir, summary?.generatedAt);

  return { summary, jobs, downloads, funnel };
}

async function listDownloads(
  latestDir: string,
  generatedAt?: string,
): Promise<Array<{ name: string; label: string; size: number }>> {
  const entries = await readdir(latestDir).catch(() => []);
  const entrySet = new Set(entries);
  const result: Array<{ name: string; label: string; size: number }> = [];
  const generatedAtMs = generatedAt ? Date.parse(generatedAt) : Number.NaN;

  for (const filename of downloadableFiles) {
    if (!entrySet.has(filename)) continue;

    const fileStat = await stat(path.join(latestDir, filename));
    if (
      filename.startsWith('report-') &&
      Number.isFinite(generatedAtMs) &&
      fileStat.mtimeMs + 1_000 < generatedAtMs
    ) {
      continue;
    }
    result.push({ name: filename, label: labelDownload(filename), size: fileStat.size });
  }

  return result;
}

async function readJsonOrNull<T = unknown>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}
