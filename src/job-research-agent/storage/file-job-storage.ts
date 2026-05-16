import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  JobOpportunity,
  JobFilterFunnelSummary,
  JobResearchOutputPaths,
  JobSelectionSummary,
  JobSourceSummary,
  RawJobPosting,
} from '../domain/job.types.js';
import { normalizeJobUrl } from '../shared/job.util.js';

export interface PersistedRunArtifacts {
  runId: string;
  generatedAt: string;
  totalRawJobs: number;
  selectionSummary: JobSelectionSummary;
  rawJobs: RawJobPosting[];
  rankedJobs: JobOpportunity[];
  selectedJobs: JobOpportunity[];
  rejectedJobs: JobOpportunity[];
  filterFunnel?: JobFilterFunnelSummary;
  sourceSummaries: JobSourceSummary[];
  markdownReport: string;
  csvReport: string;
  // Novo shape V2: 8 grupos visíveis. Grupo com conteúdo `null` não gera CSV.
  csvReportsBySeniority: {
    junior: string | null;
    pleno: string | null;
    senior: string | null;
    staff: string | null;
    arq: string | null;
    qa: string | null;
    devops: string | null;
    management?: string | null;
  };
}

export interface SaveRunOptions {
  // Quando fornecido, o conteúdo é serializado como JSON em
  // `<runDirectory>/browser-mcp-trace.json` e o path resultante é retornado em
  // `output.browserMcpTracePath`. Quando omitido, `browserMcpTracePath` = null.
  browserMcpTrace?: unknown;
}

export class FileJobStorage {
  constructor(private readonly outputRootDir: string) {}

  async loadRecentSelectionHistory(
    referenceDate: Date,
    lookbackDays: number,
  ): Promise<Map<string, number>> {
    const history = new Map<string, number>();
    const runsDirectory = path.join(this.outputRootDir, 'runs');

    const runEntries = await readdir(runsDirectory, { withFileTypes: true }).catch(() => null);

    if (!runEntries) {
      return history;
    }

    for (const entry of runEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const runDirectory = path.join(runsDirectory, entry.name);
      const summary = await readRunSummary(runDirectory);

      if (!summary?.generatedAt) {
        continue;
      }

      const ageInDays = diffCalendarDays(referenceDate, new Date(summary.generatedAt));

      if (ageInDays < 0 || ageInDays > lookbackDays) {
        continue;
      }

      const selectionKeys = await readSelectedJobHistoryKeys(runDirectory);

      for (const key of selectionKeys) {
        const currentAge = history.get(key);

        if (currentAge === undefined || ageInDays < currentAge) {
          history.set(key, ageInDays);
        }
      }
    }

    return history;
  }

  async saveRun(
    input: PersistedRunArtifacts,
    options: SaveRunOptions = {},
  ): Promise<JobResearchOutputPaths> {
    const runDirectory = path.join(this.outputRootDir, 'runs', input.runId);
    const latestDirectory = path.join(this.outputRootDir, 'latest');

    await mkdir(runDirectory, { recursive: true });
    await mkdir(latestDirectory, { recursive: true });

    const r = input.csvReportsBySeniority;
    // Lista canônica V2: 8 grupos na ordem exata definida em
    // SENIORITY_REPORT_GROUP_V2_ORDER. Os 4 nomes antigos
    // (mid-level, senior-plus, tech-lead, architect) foram removidos.
    const csvByGroup: Array<{ content: string | null; filename: string }> = [
      { content: r.junior, filename: 'report-junior.csv' },
      { content: r.pleno,  filename: 'report-pleno.csv' },
      { content: r.senior, filename: 'report-senior.csv' },
      { content: r.staff,  filename: 'report-staff.csv' },
      { content: r.arq,    filename: 'report-arq.csv' },
      { content: r.qa,     filename: 'report-qa.csv' },
      { content: r.devops, filename: 'report-devops.csv' },
      { content: r.management ?? null, filename: 'report-management.csv' },
    ];

    const hasBrowserMcpTrace = options.browserMcpTrace !== undefined;
    const browserMcpTracePath = hasBrowserMcpTrace
      ? path.join(runDirectory, 'browser-mcp-trace.json')
      : null;

    const outputPaths: JobResearchOutputPaths = {
      runDirectory,
      latestDirectory,
      rawJobsPath: path.join(runDirectory, 'raw-jobs.json'),
      rankedJobsPath: path.join(runDirectory, 'ranked-jobs.json'),
      rejectedJobsPath: path.join(runDirectory, 'rejected-jobs.json'),
      filterFunnelPath: path.join(runDirectory, 'filter-funnel.json'),
      summaryPath: path.join(runDirectory, 'summary.json'),
      markdownReportPath: path.join(runDirectory, 'report.md'),
      csvReportPath: path.join(runDirectory, 'report.csv'),
      csvReportBySeniorityPaths: {
        junior:     r.junior     ? path.join(runDirectory, 'report-junior.csv')     : null,
        pleno:      r.pleno      ? path.join(runDirectory, 'report-pleno.csv')      : null,
        senior:     r.senior     ? path.join(runDirectory, 'report-senior.csv')     : null,
        staff:      r.staff      ? path.join(runDirectory, 'report-staff.csv')      : null,
        arq:        r.arq        ? path.join(runDirectory, 'report-arq.csv')        : null,
        qa:         r.qa         ? path.join(runDirectory, 'report-qa.csv')         : null,
        devops:     r.devops     ? path.join(runDirectory, 'report-devops.csv')     : null,
        management: r.management ? path.join(runDirectory, 'report-management.csv') : null,
      },
      browserMcpTracePath,
    };

    const summary = {
      runId: input.runId,
      generatedAt: input.generatedAt,
      totalRawJobs: input.totalRawJobs,
      rankedJobs: input.rankedJobs.length,
      selectedJobs: input.selectedJobs.length,
      rejectedJobs: input.rejectedJobs.length,
      selectionSummary: input.selectionSummary,
      sourceSummaries: input.sourceSummaries,
    };

    await writeFile(outputPaths.rawJobsPath, JSON.stringify(input.rawJobs, null, 2));
    const filterFunnel = input.filterFunnel ?? buildEmptyFilterFunnel(input);

    await writeFile(outputPaths.rankedJobsPath, JSON.stringify(input.rankedJobs, null, 2));
    await writeFile(outputPaths.rejectedJobsPath, JSON.stringify(input.rejectedJobs, null, 2));
    await writeFile(outputPaths.filterFunnelPath, JSON.stringify(filterFunnel, null, 2));
    await writeFile(path.join(runDirectory, 'selected-jobs.json'), JSON.stringify(input.selectedJobs, null, 2));
    await writeFile(outputPaths.summaryPath, JSON.stringify(summary, null, 2));
    await writeFile(outputPaths.markdownReportPath, input.markdownReport);
    await writeFile(outputPaths.csvReportPath, input.csvReport);

    await writeCsvReportGroup(csvByGroup, runDirectory);

    await writeFile(path.join(latestDirectory, 'raw-jobs.json'), JSON.stringify(input.rawJobs, null, 2));
    await writeFile(path.join(latestDirectory, 'ranked-jobs.json'), JSON.stringify(input.rankedJobs, null, 2));
    await writeFile(path.join(latestDirectory, 'rejected-jobs.json'), JSON.stringify(input.rejectedJobs, null, 2));
    await writeFile(path.join(latestDirectory, 'filter-funnel.json'), JSON.stringify(filterFunnel, null, 2));
    await writeFile(path.join(latestDirectory, 'selected-jobs.json'), JSON.stringify(input.selectedJobs, null, 2));
    await writeFile(path.join(latestDirectory, 'summary.json'), JSON.stringify(summary, null, 2));
    await writeFile(path.join(latestDirectory, 'report.md'), input.markdownReport);
    await writeFile(path.join(latestDirectory, 'report.csv'), input.csvReport);

    await writeCsvReportGroup(csvByGroup, latestDirectory);

    if (hasBrowserMcpTrace && browserMcpTracePath) {
      await writeFile(
        browserMcpTracePath,
        JSON.stringify(options.browserMcpTrace, null, 2),
      );
    }

    return outputPaths;
  }
}

async function writeCsvReportGroup(
  group: Array<{ content: string | null; filename: string }>,
  directory: string,
): Promise<void> {
  for (const { content, filename } of group) {
    const filePath = path.join(directory, filename);
    if (content) {
      await writeFile(filePath, content);
      continue;
    }
    await rm(filePath, { force: true });
  }
}

function buildEmptyFilterFunnel(input: PersistedRunArtifacts): JobFilterFunnelSummary {
  return {
    rawJobs: input.rawJobs.length,
    rankedJobs: input.rankedJobs.length,
    rejectedJobs: input.rejectedJobs.length,
    rejectedByReason: {},
    rejectedByReasonCombination: {},
    rankedBySource: {},
    rejectedBySource: {},
    rankedByReportGroup: {
      junior: 0,
      pleno: 0,
      senior: 0,
      staff: 0,
      arq: 0,
      qa: 0,
      devops: 0,
      management: 0,
      other: 0,
    },
    rejectedByReportGroup: {
      junior: 0,
      pleno: 0,
      senior: 0,
      staff: 0,
      arq: 0,
      qa: 0,
      devops: 0,
      management: 0,
      other: 0,
    },
  };
}

async function readRunSummary(
  runDirectory: string,
): Promise<{ generatedAt?: string } | undefined> {
  try {
    const content = await readFile(path.join(runDirectory, 'summary.json'), 'utf8');
    return JSON.parse(content) as { generatedAt?: string };
  } catch {
    return undefined;
  }
}

async function readSelectedJobHistoryKeys(runDirectory: string): Promise<string[]> {
  const selectedJobsPath = path.join(runDirectory, 'selected-jobs.json');

  try {
    const content = await readFile(selectedJobsPath, 'utf8');
    const jobs = JSON.parse(content) as Array<{
      id?: string;
      sourceId?: string;
      url?: string;
    }>;

    return uniqueHistoryKeys(
      jobs.flatMap((job) => buildHistoryKeys(job.id, job.url, job.sourceId)),
    );
  } catch {
    return readSelectedJobHistoryKeysFromCsv(runDirectory);
  }
}

async function readSelectedJobHistoryKeysFromCsv(runDirectory: string): Promise<string[]> {
  try {
    const content = await readFile(path.join(runDirectory, 'report.csv'), 'utf8');
    const rows = parseCsvRows(content);

    if (rows.length <= 1) {
      return [];
    }

    const headers = rows[0].map((header) => header.trim());
    const urlIndex = headers.indexOf('url');

    if (urlIndex < 0) {
      return [];
    }

    return uniqueHistoryKeys(
      rows
        .slice(1)
        .flatMap((row) => buildHistoryKeys(undefined, unwrapCsvUrl(row[urlIndex]), undefined)),
    );
  } catch {
    return [];
  }
}

function buildHistoryKeys(
  id: string | undefined,
  url: string | undefined,
  sourceId: string | undefined,
): string[] {
  const keys: string[] = [];

  if (id) {
    keys.push(`id:${id}`);
  }

  if (url) {
    keys.push(`url:${normalizeJobUrl(url, sourceId)}`);
  }

  return keys;
}

function uniqueHistoryKeys(keys: string[]): string[] {
  return [...new Set(keys.filter(Boolean))];
}

function unwrapCsvUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1) : trimmed;
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (character === '"') {
      const nextCharacter = content[index + 1];

      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && content[index + 1] === '\n') {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function diffCalendarDays(referenceDate: Date, candidateDate: Date): number {
  const referenceDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const candidateDay = new Date(
    candidateDate.getFullYear(),
    candidateDate.getMonth(),
    candidateDate.getDate(),
  );

  return Math.floor((referenceDay.getTime() - candidateDay.getTime()) / (1000 * 60 * 60 * 24));
}
