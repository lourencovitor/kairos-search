import type {
  JobOpportunity,
  RoleCategory,
  SeniorityLevel,
  SeniorityReportGroupV2,
} from '../domain/job.types.js';

export type SeniorityReportGroup = 'junior' | 'mid_level' | 'senior_plus';

export const SENIORITY_ORDER: SeniorityLevel[] = [
  'architect',
  'principal',
  'staff',
  'lead',
  'senior',
  'mid_level',
  'junior',
  'unknown',
  'staff_or_principal',
];

export const ROLE_CATEGORY_ORDER: RoleCategory[] = [
  'software_engineering',
  'tech_lead',
  'devops',
  'software_architecture',
  'solutions_architecture',
  'cloud_architecture',
  'management',
];

// Categorias de arquitetura que mapeiam para o grupo V2 "arq" independentemente
// da seniority. Mantido como ReadonlySet para lookup O(1).
const ARCHITECTURE_ROLE_CATEGORIES: ReadonlySet<RoleCategory> = new Set<RoleCategory>([
  'software_architecture',
  'solutions_architecture',
  'cloud_architecture',
]);

export function getSeniorityLabel(seniority: SeniorityLevel): string {
  switch (seniority) {
    case 'architect':
      return 'Architect';
    case 'principal':
      return 'Principal';
    case 'staff':
      return 'Staff';
    case 'lead':
      return 'Lead';
    case 'senior':
      return 'Senior';
    case 'mid_level':
      return 'Pleno';
    case 'junior':
      return 'Junior';
    case 'staff_or_principal':
      return 'Staff / Principal';
    case 'unknown':
      return 'Unspecified';
  }
}

export function getRoleCategoryLabel(roleCategory: RoleCategory): string {
  switch (roleCategory) {
    case 'software_engineering':
      return 'Software Engineering';
    case 'tech_lead':
      return 'Tech Lead';
    case 'devops':
      return 'DevOps / SRE / Platform';
    case 'software_architecture':
      return 'Software Architecture';
    case 'solutions_architecture':
      return 'Solutions Architecture';
    case 'cloud_architecture':
      return 'Cloud Architecture';
    case 'qa':
      return 'QA / Quality Engineering';
    case 'management':
      return 'Management (SM/PM/PO/GPM)';
  }
}

export function getSeniorityReportGroup(seniority: SeniorityLevel): SeniorityReportGroup | undefined {
  switch (seniority) {
    case 'junior':
      return 'junior';
    case 'mid_level':
      return 'mid_level';
    case 'senior':
    case 'lead':
    case 'staff':
    case 'principal':
    case 'staff_or_principal':
    case 'architect':
      return 'senior_plus';
    case 'unknown':
      return undefined;
  }
}

export function getSeniorityReportGroupLabel(group: SeniorityReportGroup): string {
  switch (group) {
    case 'junior':
      return 'Junior';
    case 'mid_level':
      return 'Mid-level / Pleno';
    case 'senior_plus':
      return 'Senior+';
  }
}

// Mapeia uma oportunidade para o novo grupo de relatório V2, aplicando a
// ordem de precedência exata definida no design:
//   devops → arq → qa → junior → pleno → senior → staff → other.
// `roleCategory` tem prioridade sobre `seniority` para DevOps, arquitetura e QA;
// as demais classes seguem `seniority`.
export function toSeniorityReportGroupV2(
  opportunity: Pick<JobOpportunity, 'seniority' | 'roleCategory'>,
): SeniorityReportGroupV2 {
  const { seniority, roleCategory } = opportunity;

  if (roleCategory === 'devops') {
    return 'devops';
  }

  if (ARCHITECTURE_ROLE_CATEGORIES.has(roleCategory) || seniority === 'architect') {
    return 'arq';
  }

  if (roleCategory === 'qa') {
    return 'qa';
  }

  if (roleCategory === 'management') {
    return 'management';
  }

  switch (seniority) {
    case 'junior':
      return 'junior';
    case 'mid_level':
      return 'pleno';
    case 'senior':
    case 'lead':
      return 'senior';
    case 'staff':
    case 'principal':
    case 'staff_or_principal':
      return 'staff';
    default:
      return 'other';
  }
}

export function getSeniorityReportGroupV2Label(group: SeniorityReportGroupV2): string {
  switch (group) {
    case 'junior':
      return 'Junior';
    case 'pleno':
      return 'Pleno';
    case 'senior':
      return 'Senior';
    case 'staff':
      return 'Staff';
    case 'arq':
      return 'Arq';
    case 'qa':
      return 'QA';
    case 'devops':
      return 'DevOps';
    case 'management':
      return 'Management';
    case 'other':
      return 'Other';
  }
}
