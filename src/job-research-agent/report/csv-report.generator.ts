import type { JobOpportunity } from '../domain/job.types.js';
import { SENIORITY_REPORT_GROUP_V2_ORDER } from '../domain/job.types.js';
import {
  getSeniorityLabel,
  getSeniorityReportGroup,
  toSeniorityReportGroupV2,
  type SeniorityReportGroup,
} from '../shared/job-taxonomy.util.js';
import {
  isWorldwideRemoteClearlyCompatibleWithBrazil,
} from '../skills/job-selection-policy.skill.js';

/**
 * Shape legado (V1) de relatórios CSV agrupados por senioridade.
 *
 * @deprecated Use {@link CsvSeniorityReportsV2}. Mantido temporariamente enquanto
 * `index.ts` ainda consome `generateFromSeniorityGroups`; será removido no fim da Phase A.
 */
export interface CsvSeniorityReports {
  junior: string | null;
  midLevel: string | null;
  seniorPlus: string | null;
  techLead: string | null;
  devops: string | null;
  architect: string | null;
}

/**
 * Shape legado (V1) das listas de vagas por grupo de senioridade.
 *
 * @deprecated Use {@link CsvSeniorityJobGroupsV2}.
 */
export interface CsvSeniorityJobGroups {
  junior: JobOpportunity[];
  midLevel: JobOpportunity[];
  seniorPlus: JobOpportunity[];
  techLead: JobOpportunity[];
  devops: JobOpportunity[];
  architect: JobOpportunity[];
}

/**
 * Shape V2 das listas de vagas já particionadas nos 8 grupos exportáveis do
 * relatório final (`junior`, `pleno`, `senior`, `staff`, `arq`, `qa`, `devops`).
 * As chaves seguem exatamente `SENIORITY_REPORT_GROUP_V2_ORDER`.
 */
export interface CsvSeniorityJobGroupsV2 {
  junior: JobOpportunity[];
  pleno: JobOpportunity[];
  senior: JobOpportunity[];
  staff: JobOpportunity[];
  arq: JobOpportunity[];
  qa: JobOpportunity[];
  devops: JobOpportunity[];
  management?: JobOpportunity[];
}

/**
 * Shape V2 dos CSVs gerados por grupo. Cada entrada é `null` quando o grupo
 * não possui vagas (o pipeline não deve escrever arquivo neste caso).
 */
export interface CsvSeniorityReportsV2 {
  junior: string | null;
  pleno: string | null;
  senior: string | null;
  staff: string | null;
  arq: string | null;
  qa: string | null;
  devops: string | null;
  management: string | null;
}

export class CsvReportGenerator {
  generate(jobs: JobOpportunity[]): string {
    return this.generateRows(jobs);
  }

  /**
   * @deprecated Use {@link CsvReportGenerator.generateFromSeniorityGroupsV2}. Mantido
   * temporariamente para preservar o pipeline atual de `index.ts` enquanto a migração
   * dos callers (tarefa 2.8) não é concluída.
   */
  generateFromSeniorityGroups(groups: CsvSeniorityJobGroups): CsvSeniorityReports {
    return {
      junior: groups.junior.length > 0 ? this.generateRows(groups.junior) : null,
      midLevel: groups.midLevel.length > 0 ? this.generateRows(groups.midLevel) : null,
      seniorPlus: groups.seniorPlus.length > 0 ? this.generateRows(groups.seniorPlus) : null,
      techLead: groups.techLead.length > 0 ? this.generateRows(groups.techLead) : null,
      devops: groups.devops.length > 0 ? this.generateRows(groups.devops) : null,
      architect: groups.architect.length > 0 ? this.generateRows(groups.architect) : null,
    };
  }

  /**
   * Gera até 8 CSVs (um por grupo V2) iterando na ordem canônica
   * {@link SENIORITY_REPORT_GROUP_V2_ORDER}. Grupos com array vazio retornam
   * `null` (não produzem arquivo vazio nem CSV apenas com header).
   */
  generateFromSeniorityGroupsV2(groups: CsvSeniorityJobGroupsV2): CsvSeniorityReportsV2 {
    const result: CsvSeniorityReportsV2 = {
      junior: null,
      pleno: null,
      senior: null,
      staff: null,
      arq: null,
      qa: null,
      devops: null,
      management: null,
    };

    for (const group of SENIORITY_REPORT_GROUP_V2_ORDER) {
      // "other" não é exportável; defensiva caso a constante um dia o inclua.
      if (group === 'other') {
        continue;
      }
      const jobs = groups[group] ?? [];
      result[group] = jobs.length > 0 ? this.generateRows(jobs) : null;
    }

    return result;
  }

  countBySeniority(
    jobs: JobOpportunity[],
    minimumScore = 50,
  ): Record<'junior' | 'mid_level' | 'senior_plus', number> {
    const filteredJobs = jobs.filter((job) => job.score >= minimumScore);

    return {
      junior: filterBySeniorityGroup(filteredJobs, 'junior').length,
      mid_level: filterBySeniorityGroup(filteredJobs, 'mid_level').length,
      senior_plus: filterBySeniorityGroup(filteredJobs, 'senior_plus').length,
    };
  }

  // Renderiza linhas com o cabeçalho canônico + a coluna `report_group` ao final,
  // populada por `toSeniorityReportGroupV2(job)` para cada vaga.
  private generateRows(jobs: JobOpportunity[]): string {
    const headers = [
      'rank',
      'fit',
      'score',
      'company',
      'title',
      'url',
      'source',
      'location',
      'fit_reason',
      'job_market',
      'seniority',
      'stack_signals',
      'published_at',
      'report_group',
    ];

    const rows = jobs.map((job, index) => [
      String(index + 1),
      describeFitLabel(job.score),
      String(job.score),
      job.companyName,
      job.title,
      formatCsvUrl(job.url),
      job.source,
      job.locationText,
      describePrimaryReason(job),
      job.jobMarket,
      getSeniorityLabel(job.seniority),
      job.stackSignals.join('; '),
      job.publishedAt ?? '',
      toSeniorityReportGroupV2(job),
    ]);

    return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
  }

  /**
   * @deprecated Sem chamadores após a Phase A; mantido para referência e removido em
   * limpeza posterior.
   */
  private generateOptionalRows(
    jobs: JobOpportunity[],
    targetJobs: number,
    minimumJobs: number,
  ): string | null {
    if (jobs.length < minimumJobs) {
      return null;
    }

    return this.generateRows(jobs.slice(0, targetJobs));
  }
}

function filterBySeniorityGroup(
  jobs: JobOpportunity[],
  group: SeniorityReportGroup,
): JobOpportunity[] {
  return jobs.filter((job) => getSeniorityReportGroup(job.seniority) === group);
}

function escapeCsv(value: string): string {
  const escapedValue = value.replaceAll('"', '""');

  return /[",\n]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
}

function formatCsvUrl(url: string): string {
  return `<${url}>`;
}

function describeFitLabel(score: number): string {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Otima';
  if (score >= 55) return 'Boa';
  return 'Razoavel';
}

function describePrimaryReason(job: JobOpportunity): string {
  if (job.reportBucket === 'international_fallback') {
    return 'international fallback';
  }

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
