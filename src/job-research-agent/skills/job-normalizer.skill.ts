import type { JobResearchConfig } from '../config/job-research.config.js';
import type {
  JobOpportunity,
  RawJobPosting,
  RoleCategory,
  SeniorityLevel,
} from '../domain/job.types.js';
import { classifyJobMarket } from './job-market-classifier.skill.js';
import { detectRemotePolicy } from './remote-policy-detector.skill.js';
import { detectVisaRestrictions } from './visa-restriction-detector.skill.js';
import { matchStackSignals } from './stack-matcher.skill.js';
import { buildStableId, normalizeJobUrl, slugify, uniqueStrings } from '../shared/job.util.js';

interface RoleProfile {
  name: string;
  patterns: RegExp[];
  seniority: SeniorityLevel;
  roleCategory: RoleCategory;
}

const ROLE_PROFILES: RoleProfile[] = [
  {
    name: 'Cloud Architect',
    patterns: [/\bcloud architect\b/i],
    seniority: 'architect',
    roleCategory: 'cloud_architecture',
  },
  {
    name: 'Solutions Architect',
    patterns: [
      /\bsolutions? architect\b/i,
      /\barquitet[oa](?:\(a\))?\s+de\s+solu[çc][õo]es\b/i,
    ],
    seniority: 'architect',
    roleCategory: 'solutions_architecture',
  },
  {
    name: 'Software Architect',
    patterns: [
      /\bsoftware architect\b/i,
      /\bapplication architect\b/i,
      /\bsystems? architect\b/i,
      /\barquitet[oa]\s+de\s+software\b/i,
    ],
    seniority: 'architect',
    roleCategory: 'software_architecture',
  },
  {
    name: 'Tech Lead',
    patterns: [
      /\btech lead\b/i,
      /\btechnical lead\b/i,
      /\blead engineer\b/i,
      /\bengineering lead\b/i,
      /\bteam lead\b/i,
      /\blead developer\b/i,
      /\bl[ií]der t[ée]cnico\b/i,
    ],
    seniority: 'lead',
    roleCategory: 'tech_lead',
  },
  {
    name: 'Principal Software Engineer',
    patterns: [
      /\bprincipal\b.*\b(engineer|developer)\b/i,
      /\bprincipal\b.*\b(engenheir[oa]|desenvolvedor(?:a)?)\b/i,
      /\bengineer v\b/i,
      /\bprincipal software engineer\b/i,
    ],
    seniority: 'principal',
    roleCategory: 'software_engineering',
  },
  {
    name: 'Staff Software Engineer',
    patterns: [
      /\bstaff\b.*\bengineer\b/i,
      /\bsoftware engineer iv\b/i,
      /\bstaff\b.*\bdeveloper\b/i,
      /\bstaff\b.*\b(engenheir[oa]|desenvolvedor(?:a)?)\b/i,
    ],
    seniority: 'staff',
    roleCategory: 'software_engineering',
  },
  {
    name: 'Senior Software Engineer',
    patterns: [
      /\b(senior|sr\.?|s[êe]nior)\b.*\b(engineer|developer)\b/i,
      /\bengineer iii\b/i,
      /\bdesenvolvedor(?:a)?\s+s[êe]nior\b/i,
      /\bsenior software engineer\b/i,
    ],
    seniority: 'senior',
    roleCategory: 'software_engineering',
  },
  {
    name: 'QA Engineer',
    patterns: [
      /\bqa\b/i,
      /\bquality assurance\b/i,
      /\bquality engineer\b/i,
      /\bquality engineering\b/i,
      /\bquality automation\b/i,
      /\btest automation\b/i,
      /\bautomation qa\b/i,
      /\btest(?:er|ing)?\s+engineer\b/i,
      /\bsoftware development engineer in test\b/i,
      /\bsdet\b/i,
      /\banalista\b.*?\bde\s+testes\b/i,
      /\banalista\b.*?\bde\s+qualidade\b/i,
      /\bengenheiro(?:a)?\s+de\s+qualidade\b/i,
      /\bespecialista\s+(?:em\s+)?qualidade\b/i,
    ],
    seniority: 'mid_level',
    roleCategory: 'qa',
  },
  {
    name: 'DevOps Engineer',
    patterns: [
      /\bdevops\b/i,
      /\bdevsecops\b/i,
      /\bsite reliability engineer\b/i,
      /\bsre\b/i,
      /\bplatform engineer\b/i,
      /\binfrastructure engineer\b/i,
      /\bcloud engineer\b/i,
      /\bengenheiro(?:a)?\s+de\s+infraestrutura\b/i,
      /\bengenheiro(?:a)?\s+de\s+plataforma\b/i,
      /\banalista\s+de\s+infraestrutura\b/i,
    ],
    seniority: 'mid_level',
    roleCategory: 'devops',
  },
  {
    name: 'Management',
    patterns: [
      /\bscrum master\b/i,
      /\bproduct manager\b/i,
      /\bproduct owner\b/i,
      /\bgroup product manager\b/i,
      /\bengineering manager\b/i,
      /\bsoftware engineering manager\b/i,
      /\bmanager\b.*\b(engineering|software engineering|platform|devops|quality)\b/i,
      /\bgpm\b/i,
      /\bgerente de produto\b/i,
      /\bgerente de engenharia\b/i,
      /\bgerente\b.*\b(tecnologia|engenharia|software|devops|qualidade)\b/i,
      /\bgestor(?:a)?\s+de\s+produto\b/i,
    ],
    seniority: 'mid_level',
    roleCategory: 'management',
  },
  {
    name: 'Software Engineer',
    patterns: [
      /\bsoftware engineer\b/i,
      /\bswe\b/i,
      /\bsde\b/i,
      /\bsoftware developer\b/i,
      /\bbackend engineer\b/i,
      /\bbackend developer\b/i,
      /\bfull[- ]?stack engineer\b/i,
      /\bfull[- ]?stack developer\b/i,
      /\bfront[- ]?end engineer\b/i,
      /\bfront[- ]?end developer\b/i,
      /\bfrontend engineer\b/i,
      /\bfrontend developer\b/i,
      /\bweb developer\b/i,
      /\bapplication developer\b/i,
      /\bengenheir[oa](?:\(a\))?\s+de\s+software\b/i,
      /\bengenheir[oa](?:\(a\))?\s+(?:backend|front[- ]?end|full[- ]?stack|web|mobile|dados|data)\b/i,
      /\bdesenvolvedor(?:a)?(?:\(a\))?\b/i,
      /\bpessoa\s+desenvolvedora\b/i,
      /\bdev(?:eloper)?\s+(?:backend|front[- ]?end|frontend|full[- ]?stack|fullstack|mobile)\b/i,
      /\b(back[- ]?end|front[- ]?end|frontend|full[- ]?stack|fullstack|mobile)\s+dev(?:eloper)?\b/i,
      /\bprogramador(?:a)?(?:\(a\))?\b/i,
      /\banalista\s+de\s+sistemas\b/i,
      /\bespecialista\s+(?:mobile|backend|frontend|full[- ]?stack|software)\b/i,
      /\bmobile engineer\b/i,
      /\bmobile developer\b/i,
      /\bandroid developer\b/i,
      /\bios developer\b/i,
      /\b(?:java|php|ruby|golang|swift|kotlin|\.net)\s+developer\b/i,
      /\bdeveloper\s+(?:android|ios|java|php|ruby|swift|kotlin)\b/i,
      /\bdata engineer\b/i,
      /\bengenheiro(?:a)?(?:\(a\))?\s+de\s+dados\b/i,
    ],
    seniority: 'mid_level',
    roleCategory: 'software_engineering',
  },
  {
    name: 'Architect',
    patterns: [
      /\barchitect\b/i,
      /\barquitet[oa](?:\s*\(a\))?\b/i,
    ],
    seniority: 'architect',
    roleCategory: 'software_architecture',
  },
];

export function normalizeJob(
  rawJob: RawJobPosting,
  config: JobResearchConfig,
  now: Date,
): JobOpportunity {
  const roleMatches = uniqueStrings(
    ROLE_PROFILES.flatMap((profile) =>
      profile.patterns.some((pattern) => pattern.test(rawJob.title)) ? [profile.name] : [],
    ),
  );
  const roleCategory = detectRoleCategory(roleMatches);

  const seniority = detectSeniority(rawJob.title, roleMatches);
  const remoteDetection = detectRemotePolicy(rawJob);
  const visaDetection = detectVisaRestrictions(rawJob, remoteDetection.regions);
  const marketClassification = classifyJobMarket({
    rawJob,
    remotePolicy: remoteDetection.policy,
    remoteRegions: remoteDetection.regions,
    regionFit: visaDetection.regionFit,
    restrictionSignals: visaDetection.restrictionSignals,
  });
  const stackSignals = matchStackSignals(
    [rawJob.title, rawJob.descriptionText, rawJob.locationText, ...rawJob.tags],
    config.technicalKeywordProfiles,
  );

  const notes: string[] = [];

  if (rawJob.sourceType === 'manual') {
    notes.push('Manual curated intake. Verify the original posting before outreach.');
  }

  if (rawJob.curationNotes.length > 0) {
    notes.push(...rawJob.curationNotes);
  }

  if (!rawJob.descriptionText) {
    notes.push('No description text was available from the source.');
  }

  if (visaDetection.regionFit === 'partial_latam') {
    notes.push('Eligibility appears limited to a specific LATAM country.');
  }

  if (marketClassification.market === 'unclear') {
    notes.push('Brazil eligibility is not explicit from the location or description.');
  }

  return {
    id: buildStableId(rawJob.source, rawJob.sourceId, rawJob.companyName, rawJob.title),
    source: rawJob.source,
    sourceId: rawJob.sourceId,
    sourceBoard: rawJob.sourceBoard,
    sourceType: rawJob.sourceType,
    sourceFocus: rawJob.sourceFocus,
    sourceTier: rawJob.sourceTier,
    companyName: rawJob.companyName,
    normalizedCompanyName: slugify(rawJob.companyName),
    title: rawJob.title,
    normalizedTitle: slugify(rawJob.title),
    url: normalizeJobUrl(rawJob.url, rawJob.sourceId),
    locationText: rawJob.locationText,
    descriptionText: rawJob.descriptionText,
    employmentType: rawJob.employmentType,
    publishedAt: rawJob.publishedAt,
    updatedAt: rawJob.updatedAt,
    discoveredAt: now.toISOString(),
    salaryText: rawJob.salaryText,
    tags: rawJob.tags,
    metadata: rawJob.metadata,
    roleMatches,
    remotePolicy: remoteDetection.policy,
    remoteConfidence: remoteDetection.confidence,
    remoteRegions: remoteDetection.regions,
    regionFit: visaDetection.regionFit,
    jobMarket: marketClassification.market,
    brazilLocationPriority: marketClassification.brazilLocationPriority,
    marketSignals: marketClassification.signals,
    visaSignal: visaDetection.visaSignal,
    restrictionSignals: visaDetection.restrictionSignals,
    seniority,
    roleCategory,
    stackSignals,
    sourceQualityRank: sourceQualityRank(rawJob),
    isRelevant: false,
    rejectionReasons: [],
    notes,
    score: 0,
    scoreBreakdown: {
      titleMatch: 0,
      seniorityFit: 0,
      marketFit: 0,
      locationBoost: 0,
      stackMatch: 0,
      preferredPlatformBoost: 0,
      sourceQuality: 0,
      recency: 0,
      compensation: 0,
      restrictionsPenalty: 0,
      clarityPenalty: 0,
      stackPenalty: 0,
      total: 0,
    },
    rawJob,
  };
}

function detectSeniority(title: string, roleMatches: string[]): SeniorityLevel {
  if (roleMatches.some((role) => role.includes('Architect'))) {
    return 'architect';
  }

  if (
    roleMatches.includes('Principal Software Engineer') ||
    /\bprincipal\b/i.test(title)
  ) {
    return 'principal';
  }

  if (roleMatches.includes('Staff Software Engineer') || /\bstaff\b/i.test(title)) {
    return 'staff';
  }

  if (roleMatches.includes('Tech Lead') || /\blead\b|\bl[ií]der\b/i.test(title)) {
    return 'lead';
  }

  if (
    roleMatches.includes('Senior Software Engineer') ||
    /\bsenior\b|\bsr\.?\b|\bs[êe]nior\b/i.test(title)
  ) {
    return 'senior';
  }

  if (/\bmid\b|\bmid-level\b|\bintermediate\b|\bpleno\b|\bengineer ii\b/i.test(title)) {
    return 'mid_level';
  }

  if (/\bjunior\b|\bjr\.?\b|\bj[úu]nior\b/i.test(title)) {
    return 'junior';
  }

  if (roleMatches.includes('QA Engineer')) {
    return 'mid_level';
  }

  if (roleMatches.includes('Software Engineer')) {
    return 'mid_level';
  }

  return 'unknown';
}

function detectRoleCategory(roleMatches: string[]): RoleCategory {
  if (roleMatches.includes('Cloud Architect')) {
    return 'cloud_architecture';
  }

  if (roleMatches.includes('Solutions Architect')) {
    return 'solutions_architecture';
  }

  if (roleMatches.includes('Software Architect')) {
    return 'software_architecture';
  }

  // QA é checado antes de Tech Lead para que "QA Tech Lead" caia em "qa".
  if (roleMatches.includes('QA Engineer')) {
    return 'qa';
  }

  if (roleMatches.includes('Tech Lead')) {
    return 'tech_lead';
  }

  if (roleMatches.includes('DevOps Engineer')) {
    return 'devops';
  }

  if (roleMatches.includes('Management')) {
    return 'management';
  }

  return 'software_engineering';
}

function sourceQualityRank(rawJob: Pick<RawJobPosting, 'sourceQualityRank' | 'sourceTier'>): number {
  if (rawJob.sourceQualityRank !== undefined) {
    return rawJob.sourceQualityRank;
  }

  switch (rawJob.sourceTier) {
    case 'manual_curated':
      return 10;
    case 'brazil_public_api':
      return 9;
    case 'direct_company_board':
      return 8;
    case 'global_aggregator':
      return 5;
  }
}
