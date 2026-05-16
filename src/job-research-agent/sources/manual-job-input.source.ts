import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { JobResearchConfig } from '../config/job-research.config.js';
import type {
  JobMarket,
  JobSourceFocus,
  JobSourceTier,
  RawJobPosting,
  RemotePolicy,
} from '../domain/job.types.js';
import { toIsoDate, uniqueStrings } from '../shared/job.util.js';
import type { JobSource, JobSourceFetchResult } from './job-source.interface.js';

interface ManualJobDefaults {
  source?: string;
  sourceFocus?: JobSourceFocus;
  sourceTier?: JobSourceTier;
  sourceQualityRank?: number;
  marketHint?: JobMarket;
  remotePolicyHint?: RemotePolicy;
  regionHints?: string[];
  restrictionHints?: string[];
  tags?: string[];
  notes?: string[];
  metadata?: Record<string, unknown>;
}

interface ManualJobInputFile {
  defaults?: ManualJobDefaults;
  jobs?: Array<{
    source?: string;
    companyName?: string;
    title?: string;
    url?: string;
    locationText?: string;
    descriptionText?: string;
    employmentType?: string;
    publishedAt?: string;
    updatedAt?: string;
    salaryText?: string;
    tags?: string[];
    sourceFocus?: JobSourceFocus;
    sourceTier?: JobSourceTier;
    sourceQualityRank?: number;
    marketHint?: JobMarket;
    remotePolicyHint?: RemotePolicy;
    regionHints?: string[];
    restrictionHints?: string[];
    notes?: string[];
    metadata?: Record<string, unknown>;
  }>;
}

export class ManualJobInputSource implements JobSource {
  readonly name = 'manual' as const;

  async fetchJobs(config: JobResearchConfig): Promise<JobSourceFetchResult> {
    if (!config.manualSource.enabled) {
      return {
        jobs: [],
        summaries: [
          {
            source: this.name,
            label: 'Manual intake',
            focus: 'mixed',
            tier: 'manual_curated',
            fetchedJobs: 0,
          },
        ],
      };
    }

    try {
      const fileNames = await readdir(config.manualInputDir);
      const inputFiles = fileNames.filter(
        (fileName) => fileName.endsWith('.json') && !fileName.endsWith('.example.json'),
      );

      const jobs: RawJobPosting[] = [];

      for (const fileName of inputFiles) {
        const filePath = path.join(config.manualInputDir, fileName);
        const contents = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(contents) as ManualJobInputFile;
        const defaults = parsed.defaults ?? {};

        for (const [index, job] of (parsed.jobs ?? []).entries()) {
          if (!job.companyName || !job.title || !job.url) {
            continue;
          }

          if (isPlaceholderManualJob(job)) {
            continue;
          }

          const sourceFocus =
            job.sourceFocus ??
            defaults.sourceFocus ??
            inferManualSourceFocus(fileName);
          const sourceTier = job.sourceTier ?? defaults.sourceTier ?? 'manual_curated';
          const sourceQualityRank = job.sourceQualityRank ?? defaults.sourceQualityRank ?? 10;
          const marketHint = job.marketHint ?? defaults.marketHint;
          const remotePolicyHint = job.remotePolicyHint ?? defaults.remotePolicyHint;
          const regionHints = uniqueStrings([
            ...(defaults.regionHints ?? []),
            ...(job.regionHints ?? []),
          ]);
          const restrictionHints = uniqueStrings([
            ...(defaults.restrictionHints ?? []),
            ...(job.restrictionHints ?? []),
          ]);
          const curationNotes = uniqueStrings([
            ...(defaults.notes ?? []),
            ...(job.notes ?? []),
          ]);

          jobs.push({
            source: this.name,
            sourceId: `${fileName}:${index}`,
            sourceBoard: job.source ?? defaults.source ?? path.basename(fileName, '.json'),
            sourceType: 'manual',
            sourceFocus,
            sourceTier,
            sourceQualityRank,
            companyName: job.companyName,
            title: job.title,
            url: job.url,
            locationText: job.locationText ?? '',
            descriptionText: job.descriptionText ?? '',
            employmentType: job.employmentType,
            publishedAt: toIsoDate(job.publishedAt),
            updatedAt: toIsoDate(job.updatedAt),
            salaryText: job.salaryText,
            tags: uniqueStrings([
              ...(defaults.tags ?? []),
              ...(job.tags ?? []),
            ]),
            marketHint,
            remotePolicyHint,
            regionHints,
            restrictionHints,
            curationNotes,
            metadata: {
              fileName,
              manualSource: job.source ?? defaults.source ?? 'manual',
              ...(defaults.metadata ?? {}),
              ...(job.metadata ?? {}),
            },
            raw: job,
          });
        }
      }

      return {
        jobs,
        summaries: [
          {
            source: this.name,
            label: 'Manual intake',
            focus: 'mixed',
            tier: 'manual_curated',
            fetchedJobs: jobs.length,
          },
        ],
      };
    } catch (error) {
      return {
        jobs: [],
        summaries: [
          {
            source: this.name,
            label: 'Manual intake',
            focus: 'mixed',
            tier: 'manual_curated',
            fetchedJobs: 0,
            error: error instanceof Error ? error.message : 'Unknown manual intake error',
          },
        ],
      };
    }
  }
}

function inferManualSourceFocus(fileName: string): JobSourceFocus {
  if (/latam/i.test(fileName)) {
    return 'latam';
  }

  if (/brazil|brasil/i.test(fileName)) {
    return 'brazil';
  }

  return 'global';
}

function isPlaceholderManualJob(
  job: NonNullable<ManualJobInputFile['jobs']>[number],
): boolean {
  const normalizedCompanyName = job.companyName?.trim().toLowerCase() ?? '';
  const normalizedTitle = job.title?.trim().toLowerCase() ?? '';

  if (normalizedCompanyName.startsWith('example ') || normalizedTitle.startsWith('example ')) {
    return true;
  }

  try {
    const url = new URL(job.url ?? '');
    const pathname = url.pathname.toLowerCase();

    return (
      url.hostname.endsWith('example.com') ||
      pathname.endsWith('/example') ||
      pathname.includes('/jobs/view/example')
    );
  } catch {
    return false;
  }
}
