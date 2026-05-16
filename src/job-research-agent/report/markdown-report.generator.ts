import type { JobResearchConfig } from '../config/job-research.config.js';
import type {
  JobOpportunity,
  JobSelectionSummary,
  JobSourceSummary,
} from '../domain/job.types.js';
import { SENIORITY_REPORT_GROUP_V2_ORDER } from '../domain/job.types.js';
import {
  getRoleCategoryLabel,
  getSeniorityLabel,
  getSeniorityReportGroup,
  getSeniorityReportGroupLabel,
  getSeniorityReportGroupV2Label,
  ROLE_CATEGORY_ORDER,
  SENIORITY_ORDER,
  toSeniorityReportGroupV2,
  type SeniorityReportGroup,
} from '../shared/job-taxonomy.util.js';
import { isWorldwideRemoteClearlyCompatibleWithBrazil } from '../skills/job-selection-policy.skill.js';

export interface MarkdownReportInput {
  generatedAt: string;
  totalRawJobs: number;
  selectionSummary: JobSelectionSummary;
  selectedJobs: JobOpportunity[];
  rankedJobs: JobOpportunity[];
  rejectedJobs: JobOpportunity[];
  sourceSummaries: JobSourceSummary[];
  config: JobResearchConfig;
}

export class MarkdownReportGenerator {
  generate(input: MarkdownReportInput): string {
    const selectedJobs = input.selectedJobs.slice(0, input.config.reportTopJobs);
    const primaryJobs = selectedJobs.filter((job) => job.reportBucket === 'primary');
    const fallbackJobs = selectedJobs.filter((job) => job.reportBucket === 'international_fallback');
    const seniorityReportJobs = selectedJobs.filter((job) => job.score >= 50);
    const lines: string[] = [
      '# Job Research Report',
      '',
      `Generated at: ${input.generatedAt}`,
      `Raw jobs fetched: ${input.totalRawJobs}`,
      buildBrowserMcpStatusLine(input.sourceSummaries),
      `Relevant jobs after filtering: ${input.rankedJobs.length}`,
      `Selected report jobs: ${selectedJobs.length}`,
      `Rejected jobs: ${input.rejectedJobs.length}`,
      `Brazil-first target: ${input.selectionSummary.desiredPrimaryJobs} primary + ${input.selectionSummary.desiredInternationalJobs} international fallback`,
      `Actual mix: ${input.selectionSummary.selectedPrimaryJobs} primary + ${input.selectionSummary.selectedSecondaryJobs} international fallback`,
      '',
      '## Source Summary',
      '',
      '| Source | Label | Focus | Tier | Jobs | Status |',
      '| --- | --- | --- | --- | ---: | --- |',
      ...input.sourceSummaries.map(
        (summary) =>
          `| ${summary.source} | ${escapePipes(summary.label)} | ${summary.focus} | ${summary.tier} | ${summary.fetchedJobs} | ${summary.error ? escapePipes(summary.error) : 'ok'} |`,
      ),
      '',
    ];

    if (selectedJobs.length === 0) {
      lines.push('No jobs were selected for this run.');
      return lines.join('\n');
    }

    if (input.selectionSummary.usedThresholdFallback) {
      lines.push(
        'Threshold fallback was used to complete the target list size with the next-best ranked jobs.',
      );
      lines.push('');
    }

    if (input.selectionSummary.selectedWorldwideCompatiblePrimaryJobs > 0) {
      lines.push(
        `Worldwide-compatible remote jobs counted as primary: ${input.selectionSummary.selectedWorldwideCompatiblePrimaryJobs}.`,
      );
      lines.push('');
    }

    if (input.selectionSummary.filledFromSecondaryBecausePrimaryShortfall > 0) {
      lines.push(
        `Primary-market shortfall: ${input.selectionSummary.filledFromSecondaryBecausePrimaryShortfall} slots were filled with international fallback jobs.`,
      );
      lines.push('');
    }

    lines.push('## Selection Overview', '');
    lines.push('### By Seniority', '');
    lines.push('| Seniority | Primary | Fallback | Total |');
    lines.push('| --- | ---: | ---: | ---: |');
    lines.push(...buildSeniorityOverviewRows(primaryJobs, fallbackJobs));
    lines.push('');
    lines.push('### By Role Category', '');
    lines.push('| Role Category | Primary | Fallback | Total |');
    lines.push('| --- | ---: | ---: | ---: |');
    lines.push(...buildRoleCategoryOverviewRows(primaryJobs, fallbackJobs));
    lines.push('');
    lines.push('## Seniority Reports', '');
    lines.push(
      'These sections mirror the CSV exports by seniority group and include only jobs with score greater than or equal to 50.',
    );
    lines.push('');
    lines.push(...buildSeniorityReportSections(seniorityReportJobs));

    lines.push('## Reports by Group (V2)', '');
    lines.push(...buildSeniorityReportSectionsV2(input.rankedJobs, input.config));

    lines.push('', '## Export Notes', '');
    lines.push(
      'Use `report.csv` for the full shortlist and `report-junior.csv`, `report-mid-level.csv`, and `report-senior-plus.csv` for the score >= 50 seniority exports.',
    );

    return lines.join('\n');
  }
}

function buildSeniorityOverviewRows(
  primaryJobs: JobOpportunity[],
  fallbackJobs: JobOpportunity[],
): string[] {
  return SENIORITY_ORDER.flatMap((seniority) => {
    const primaryCount = primaryJobs.filter((job) => job.seniority === seniority).length;
    const fallbackCount = fallbackJobs.filter((job) => job.seniority === seniority).length;
    const total = primaryCount + fallbackCount;

    if (total === 0) {
      return [];
    }

    return [`| ${getSeniorityLabel(seniority)} | ${primaryCount} | ${fallbackCount} | ${total} |`];
  });
}

function buildRoleCategoryOverviewRows(
  primaryJobs: JobOpportunity[],
  fallbackJobs: JobOpportunity[],
): string[] {
  return ROLE_CATEGORY_ORDER.flatMap((roleCategory) => {
    const primaryCount = primaryJobs.filter((job) => job.roleCategory === roleCategory).length;
    const fallbackCount = fallbackJobs.filter((job) => job.roleCategory === roleCategory).length;
    const total = primaryCount + fallbackCount;

    if (total === 0) {
      return [];
    }

    return [
      `| ${getRoleCategoryLabel(roleCategory)} | ${primaryCount} | ${fallbackCount} | ${total} |`,
    ];
  });
}

function buildGroupedOpportunitySections(
  jobs: JobOpportunity[],
  startRank: number,
  includePrimaryReason: boolean,
): string[] {
  const lines: string[] = [];
  let nextRank = startRank;

  for (const roleCategory of ROLE_CATEGORY_ORDER) {
    const jobsForRoleCategory = jobs.filter((job) => job.roleCategory === roleCategory);

    if (jobsForRoleCategory.length === 0) {
      continue;
    }

    lines.push(`### ${getRoleCategoryLabel(roleCategory)}`, '');

    for (const seniority of SENIORITY_ORDER) {
      const jobsForSeniority = jobsForRoleCategory.filter((job) => job.seniority === seniority);

      if (jobsForSeniority.length === 0) {
        continue;
      }

      lines.push(`#### ${getSeniorityLabel(seniority)}`, '');

      if (includePrimaryReason) {
        lines.push('| Rank | Score | Primary Reason | Market | Company | Title | Location | Source |');
        lines.push('| ---: | ---: | --- | --- | --- | --- | --- | --- |');
        lines.push(...jobsForSeniority.map((job, index) => buildPrimaryRow(job, nextRank + index)));
      } else {
        lines.push('| Rank | Score | Market | Company | Title | Location | Source |');
        lines.push('| ---: | ---: | --- | --- | --- | --- | --- |');
        lines.push(...jobsForSeniority.map((job, index) => buildFallbackRow(job, nextRank + index)));
      }

      lines.push('');
      nextRank += jobsForSeniority.length;
    }
  }

  return lines;
}

function buildSeniorityReportSections(jobs: JobOpportunity[]): string[] {
  const groups: SeniorityReportGroup[] = ['junior', 'mid_level', 'senior_plus'];
  const lines: string[] = [];

  for (const group of groups) {
    const jobsForGroup = jobs.filter((job) => getSeniorityReportGroup(job.seniority) === group);

    lines.push(`### ${getSeniorityReportGroupLabel(group)}`, '');

    if (jobsForGroup.length === 0) {
      lines.push('No jobs met the score threshold for this seniority group.', '');
      continue;
    }

    lines.push('| Rank | Score | Bucket | Primary Reason | Market | Company | Title | Location | Source |');
    lines.push('| ---: | ---: | --- | --- | --- | --- | --- | --- | --- |');
    lines.push(...jobsForGroup.map((job, index) => buildSeniorityReportRow(job, index + 1)));
    lines.push('');
  }

  return lines;
}

function buildPrimaryRow(job: JobOpportunity, rank: number): string {
  return `| ${rank} | ${job.score} | ${describePrimaryReason(job)} | ${job.jobMarket} | ${escapePipes(job.companyName)} | [${escapePipes(job.title)}](<${job.url}>) | ${escapePipes(job.locationText || 'Remote')} | ${job.source} |`;
}

function buildFallbackRow(job: JobOpportunity, rank: number): string {
  return `| ${rank} | ${job.score} | ${job.jobMarket} | ${escapePipes(job.companyName)} | [${escapePipes(job.title)}](<${job.url}>) | ${escapePipes(job.locationText || 'Remote')} | ${job.source} |`;
}

function buildSeniorityReportRow(job: JobOpportunity, rank: number): string {
  return `| ${rank} | ${job.score} | ${job.reportBucket ?? 'primary'} | ${describePrimaryReason(job)} | ${job.jobMarket} | ${escapePipes(job.companyName)} | [${escapePipes(job.title)}](<${job.url}>) | ${escapePipes(job.locationText || 'Remote')} | ${job.source} |`;
}

function describePrimaryReason(job: JobOpportunity): string {
  if (isWorldwideRemoteClearlyCompatibleWithBrazil(job)) {
    return 'worldwide-compatible remote';
  }

  switch (job.jobMarket) {
    case 'brazil':
      return 'Brazil-based or Remote Brazil';
    case 'brazil_friendly':
      return 'Brazil-friendly remote';
    case 'latam':
      return 'LATAM remote';
    case 'international':
      return 'worldwide-compatible remote';
    case 'unclear':
      return 'reviewed primary';
  }
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, '/');
}

function buildSeniorityReportSectionsV2(
  rankedJobs: JobOpportunity[],
  config: JobResearchConfig,
): string[] {
  const lines: string[] = [];

  // Filtra só por threshold de score; a atribuição de grupo vem de
  // toSeniorityReportGroupV2 e respeita a precedência devops → arq → qa → etc.
  const eligibleJobs = rankedJobs.filter((job) => job.score >= config.minReportScore);

  for (const group of SENIORITY_REPORT_GROUP_V2_ORDER) {
    const label = getSeniorityReportGroupV2Label(group);
    lines.push(`### ${label}`, '');

    const jobsForGroup = eligibleJobs
      .filter((job) => toSeniorityReportGroupV2(job) === group)
      .sort((a, b) => b.score - a.score);

    if (jobsForGroup.length === 0) {
      lines.push(`Sem vagas no grupo ${label} nesta execução.`, '');
      continue;
    }

    lines.push('| rank | score | company | title | market | source | location |');
    lines.push('| ---: | ---: | --- | --- | --- | --- | --- |');
    lines.push(...jobsForGroup.map((job, index) => buildReportV2Row(job, index + 1)));
    lines.push('');
  }

  return lines;
}

function buildReportV2Row(job: JobOpportunity, rank: number): string {
  return `| ${rank} | ${job.score} | ${escapePipes(job.companyName)} | [${escapePipes(job.title)}](<${job.url}>) | ${job.jobMarket} | ${job.source} | ${escapePipes(job.locationText || 'Remote')} |`;
}

// Renderiza uma linha única com o status da Browser MCP Engine no topo do
// relatório. `disabled` quando não há nenhum summary com source="browser_mcp"
// (ver Requirement 14.4). Caso contrário, imprime `enabled (siteId=N, ...)`.
function buildBrowserMcpStatusLine(sourceSummaries: JobSourceSummary[]): string {
  const browserMcpSummaries = sourceSummaries.filter(
    (summary) => summary.source === 'browser_mcp',
  );

  if (browserMcpSummaries.length === 0) {
    return 'Browser MCP: disabled';
  }

  const entries = browserMcpSummaries.map((summary) => {
    const siteId = extractBrowserMcpSiteId(summary);
    return `${siteId}=${summary.fetchedJobs}`;
  });

  return `Browser MCP: enabled (${entries.join(', ')})`;
}

function extractBrowserMcpSiteId(summary: JobSourceSummary): string {
  const metadataSiteId = (summary as { metadata?: { siteId?: unknown } }).metadata?.siteId;
  if (typeof metadataSiteId === 'string' && metadataSiteId.length > 0) {
    return metadataSiteId;
  }

  // Convenção dos adapters: label no formato "browser_mcp:<siteId>" ou
  // "<siteId>-browser-mcp"; extrai o id quando possível, senão devolve o label cru.
  const label = summary.label ?? '';
  const prefixMatch = /^browser[_-]mcp:(.+)$/.exec(label);
  if (prefixMatch) {
    return prefixMatch[1];
  }

  const suffixMatch = /^(.+)-browser-mcp$/.exec(label);
  if (suffixMatch) {
    return suffixMatch[1];
  }

  return label;
}
