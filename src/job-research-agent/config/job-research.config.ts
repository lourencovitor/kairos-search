import path from 'node:path';

import type { JobSourceTier, SeniorityReportGroupV2 } from '../domain/job.types.js';
import type {
  BrowserMcpConfig,
  BrowserMcpSiteConfig,
  BrowserMcpSiteId,
} from '../sources/browser-mcp/browser-mcp.types.js';

export interface GreenhouseBoardConfig {
  boardToken: string;
  companyName: string;
  tags?: string[];
}

export interface LeverCompanyConfig {
  companyHandle: string;
  companyName: string;
  tags?: string[];
}

export interface PublicSearchSourceConfig {
  enabled: boolean;
  searchQueries: string[];
  maxPagesPerQuery: number;
}

export interface TechnicalKeywordProfile {
  label: string;
  aliases: string[];
  weight: number;
}

export interface HimalayasSourceConfig extends PublicSearchSourceConfig {
  country: string;
}

export interface GetOnBoardSourceConfig extends PublicSearchSourceConfig {
  countryCode: string;
  lang: string;
  perPage: number;
}

export interface GupySourceConfig {
  enabled: boolean;
  searchQueries: string[];
  maxPagesPerQuery: number;
}

export interface AshbyCompanyConfig {
  slug: string;
  companyName: string;
}

export interface LinkedInSourceConfig extends PublicSearchSourceConfig {
  location: string;
}

export interface ProgramaThorSourceConfig {
  enabled: boolean;
  maxPages: number;
  remoteOnly: boolean;
}

export interface JobResearchConfig {
  userAgent: string;
  requestTimeoutMs: number;
  outputRootDir: string;
  manualInputDir: string;
  reportTopJobs: number;
  minReportScore: number;
  maxJobAgeDays: number;
  maxJobAgeDaysBySourceTier: Partial<Record<JobSourceTier, number>>;
  minimumStackSignalCount: number;
  seniorityReportTargetJobs: number;
  seniorityReportTargetJobsByGroup: Partial<Record<SeniorityReportGroupV2, number>>;
  seniorityReportMinimumJobs: number;
  searchExpansionMaxAttempts: number;
  brazilPrioritySelectionRatio: number;
  restrictToBrazilPriorityMarkets: boolean;
  globalFallbackReportGroups: SeniorityReportGroupV2[];
  dailyVarietyEnabled: boolean;
  dailyVarietyExcludeRecentSelections: boolean;
  dailyVarietyLookbackDays: number;
  dailyVarietyRepeatPenalty: number;
  dailyVarietyScoreBandSize: number;
  includeHybrid: boolean;
  includeOnsite: boolean;
  targetRoles: string[];
  excludedTitleKeywords: string[];
  excludeQaRoles: boolean;
  technicalKeywordProfiles: TechnicalKeywordProfile[];
  preferredSourcePlatforms: string[];
  programathor: ProgramaThorSourceConfig;
  greenhouseBoards: GreenhouseBoardConfig[];
  leverCompanies: LeverCompanyConfig[];
  linkedIn: LinkedInSourceConfig;
  himalayas: HimalayasSourceConfig;
  getOnBoard: GetOnBoardSourceConfig;
  gupy: GupySourceConfig;
  ashbyCompanies: AshbyCompanyConfig[];
  remotive: {
    enabled: boolean;
  };
  remoteOk: {
    enabled: boolean;
  };
  manualSource: {
    enabled: boolean;
  };
  browserMcp: BrowserMcpConfig;
}

const BRAZIL_PRIORITY_SEARCH_QUERIES = [
  // Seniority levels
  'junior software engineer',
  'junior developer',
  'desenvolvedor junior',
  'software engineer',
  'desenvolvedor pleno',
  'pleno software engineer',
  'senior software engineer',
  'senior developer',
  'desenvolvedor senior',
  'staff engineer',
  'principal engineer',
  'tech lead',
  // Architecture
  'software architect',
  'solutions architect',
  'arquiteto de software',
  // QA
  'qa engineer',
  'quality assurance',
  'quality engineer',
  'test automation engineer',
  'software development engineer in test',
  'sdet',
  'analista de qualidade',
  'analista de testes',
  // Frontend
  'frontend developer',
  'desenvolvedor frontend',
  'react developer',
  'react native developer',
  // Backend / Fullstack
  'backend developer',
  'desenvolvedor backend',
  'fullstack developer',
  'desenvolvedor fullstack',
  'node developer',
  'nestjs developer',
  // DevOps / SRE
  'devops engineer',
  'sre engineer',
  'platform engineer',
  // Stack-specific
  'typescript developer',
  'aws engineer',
  'terraform engineer',
  'microservices',
  // Management
  'scrum master',
  'product manager',
  'product owner',
  'gerente de produto',
  'engineering manager',
  'software engineering manager',
  'gerente de engenharia',
];

// Queries genéricas reutilizadas pelos site adapters BR que não precisam do leque
// completo de títulos do LinkedIn/Glassdoor.
const BR_GENERIC_SEARCH_QUERIES = [
  'desenvolvedor',
  'software engineer',
  'frontend react',
  'backend node',
  'fullstack',
  'devops',
  'qa engineer',
  'analista de qualidade',
  'analista de testes',
  'quality engineer',
  'tech lead',
  'arquiteto software',
  'arquiteto de software',
  'arquiteto de soluções',
  'solution architect',
  'engineering manager',
  'react native',
  'typescript',
  'nestjs',
  'aws cloud',
  'engenheiro software',
  'programador',
  'desenvolvedor senior',
  'desenvolvedor pleno',
  'desenvolvedor junior',
];

// Termos de QA removidos do default `excludedTitleKeywords` (QA agora é suportado).
// Quando `excludeQaRoles === true`, `applyExcludeQaRolesOverride` re-injeta ambos.
const QA_EXCLUSION_TERMS = ['qa engineer', 'quality assurance'] as const;

export const defaultJobResearchConfig: JobResearchConfig = {
  userAgent: 'job-research-agent-mvp/0.1 (+safe-public-job-sources)',
  requestTimeoutMs: 20_000,
  outputRootDir: path.resolve(process.cwd(), 'data/job-research'),
  manualInputDir: path.resolve(process.cwd(), 'data/manual-inputs'),
  reportTopJobs: 999,
  minReportScore: 0,
  maxJobAgeDays: 14,
  maxJobAgeDaysBySourceTier: {
    global_aggregator: 21,
    direct_company_board: 45,
    manual_curated: 90,
  },
  minimumStackSignalCount: 0,
  seniorityReportTargetJobs: 50,
  seniorityReportTargetJobsByGroup: {},
  seniorityReportMinimumJobs: 1,
  searchExpansionMaxAttempts: 2,
  brazilPrioritySelectionRatio: 0.92,
  restrictToBrazilPriorityMarkets: true,
  globalFallbackReportGroups: ['senior', 'staff', 'arq', 'qa', 'devops', 'management'],
  dailyVarietyEnabled: true,
  dailyVarietyExcludeRecentSelections: false,
  dailyVarietyLookbackDays: 30,
  dailyVarietyRepeatPenalty: 12,
  dailyVarietyScoreBandSize: 6,
  includeHybrid: false,
  includeOnsite: false,
  targetRoles: [
    'Junior Software Engineer',
    'Mid-level Software Engineer',
    'Software Engineer',
    'Senior Software Engineer',
    'Staff Software Engineer',
    'Principal Software Engineer',
    'Tech Lead',
    'Software Architect',
    'Solutions Architect',
    'Cloud Architect',
    'Frontend Developer',
    'Frontend Engineer',
    'Backend Developer',
    'Backend Engineer',
    'Fullstack Developer',
    'Fullstack Engineer',
    'Full Stack Developer',
    'DevOps Engineer',
    'SRE',
    'Platform Engineer',
    'QA Engineer',
    'Quality Assurance',
    'Desenvolvedor',
    'Programador',
    'Engenheiro de Software',
    'React Developer',
    'Node Developer',
    'Scrum Master',
    'Product Manager',
    'Product Owner',
    'Group Product Manager',
    'Engineering Manager',
    'Software Engineering Manager',
    'Gerente de Produto',
  ],
  excludedTitleKeywords: [
    'recruiter',
    'designer',
    'program manager',
    'project manager',
    'sales manager',
    'sales engineer',
    'account executive',
    'customer success',
    'security operations',
    'support engineer',
    'business analyst',
    'data analyst',
    'intern',
    'internship',
    'solutions engineer',
    'field engineer',
    'graduate',
    'new grad',
    'director',
    'vice president',
    'vp ',
  ],
  excludeQaRoles: false,
  technicalKeywordProfiles: [
    { label: 'aws', aliases: ['aws', 'amazon web services'], weight: 8 },
    { label: 'terraform', aliases: ['terraform'], weight: 8 },
    { label: 'javascript', aliases: ['javascript', 'js'], weight: 8 },
    { label: 'typescript', aliases: ['typescript', 'ts'], weight: 8 },
    { label: 'nestjs', aliases: ['nestjs', 'nest.js', 'nest js'], weight: 8 },
    { label: 'reactjs', aliases: ['react', 'reactjs', 'react.js'], weight: 8 },
    { label: 'react-native', aliases: ['react native', 'react-native'], weight: 6 },
    { label: 'node', aliases: ['node', 'node.js', 'nodejs'], weight: 8 },
    { label: 'express', aliases: ['express', 'express.js', 'expressjs'], weight: 5 },
    { label: 'postgres', aliases: ['postgres', 'postgresql'], weight: 8 },
    { label: 'redis', aliases: ['redis'], weight: 8 },
    { label: 'docker', aliases: ['docker', 'containers'], weight: 6 },
    { label: 'microservices', aliases: ['microservices', 'micro services', 'microsserviços'], weight: 8 },
    {
      label: 'micro-frontends',
      aliases: ['micro-frontends', 'micro frontends', 'microfrontend', 'micro front-end'],
      weight: 8,
    },
    { label: 'html-css', aliases: ['html', 'css', 'html5', 'css3'], weight: 3 },
    { label: 'figma', aliases: ['figma'], weight: 3 },
    { label: 'scrum', aliases: ['scrum', 'agile', 'ágil'], weight: 2 },
    { label: 'gcp', aliases: ['gcp', 'google cloud'], weight: 1 },
    { label: 'azure', aliases: ['azure'], weight: 1 },
    { label: 'kubernetes', aliases: ['kubernetes', 'k8s'], weight: 4 },
    { label: 'graphql', aliases: ['graphql'], weight: 3 },
    { label: 'distributed systems', aliases: ['distributed systems', 'distributed system'], weight: 2 },
    { label: 'architecture', aliases: ['architecture', 'arquitetura'], weight: 3 },
    { label: 'cloud', aliases: ['cloud'], weight: 2 },
    { label: 'platform', aliases: ['platform'], weight: 1 },
    { label: 'backend', aliases: ['backend', 'back-end'], weight: 3 },
    { label: 'frontend', aliases: ['frontend', 'front-end'], weight: 3 },
    { label: 'api', aliases: ['api', 'apis', 'rest api'], weight: 2 },
    { label: 'go', aliases: ['go', 'golang'], weight: 1 },
    { label: 'python', aliases: ['python'], weight: 2 },
    { label: 'java', aliases: ['java'], weight: 2 },
    { label: 'monolith', aliases: ['monolith', 'monolito', 'monolithic'], weight: 1 },
    { label: 'selenium', aliases: ['selenium', 'selenium webdriver'], weight: 4 },
    { label: 'cypress', aliases: ['cypress', 'cypress.io'], weight: 4 },
    { label: 'playwright', aliases: ['playwright'], weight: 4 },
    { label: 'jest', aliases: ['jest', 'jest.js'], weight: 3 },
    { label: 'appium', aliases: ['appium'], weight: 3 },
    { label: 'postman', aliases: ['postman'], weight: 2 },
    { label: 'sonarqube', aliases: ['sonarqube', 'sonar'], weight: 2 },
  ],
  preferredSourcePlatforms: [
    'programathor',
    'vanhack',
    'remoteok',
    'indeed',
    'geekhunter',
    'glassdoor',
    'turing',
  ],
  programathor: {
    enabled: true,
    maxPages: 5,
    remoteOnly: true,
  },
  greenhouseBoards: [
    { boardToken: 'canonical', companyName: 'Canonical' },
    { boardToken: 'elastic', companyName: 'Elastic' },
    { boardToken: 'cloudflare', companyName: 'Cloudflare' },
    { boardToken: 'stripe', companyName: 'Stripe' },
    { boardToken: 'databricks', companyName: 'Databricks' },
    { boardToken: 'mongodb', companyName: 'MongoDB' },
    { boardToken: 'twilio', companyName: 'Twilio' },
    { boardToken: 'fivetran', companyName: 'Fivetran' },
    { boardToken: 'grafanalabs', companyName: 'Grafana Labs' },
    { boardToken: 'newrelic', companyName: 'New Relic' },
    { boardToken: 'fastly', companyName: 'Fastly' },
    { boardToken: 'pagerduty', companyName: 'PagerDuty' },
    { boardToken: 'singlestore', companyName: 'SingleStore' },
    { boardToken: 'cockroachlabs', companyName: 'CockroachDB' },
    { boardToken: 'yugabyte', companyName: 'Yugabyte' },
  ],
  leverCompanies: [
    { companyHandle: 'Flex', companyName: 'Flex' },
    { companyHandle: 'jumpcloud', companyName: 'JumpCloud' },
    { companyHandle: 'supermove', companyName: 'Supermove' },
    { companyHandle: 'sprucesystems', companyName: 'Spruce' },
  ],
  linkedIn: {
    enabled: true,
    location: 'Brazil',
    searchQueries: BRAZIL_PRIORITY_SEARCH_QUERIES,
    maxPagesPerQuery: 1,
  },
  himalayas: {
    enabled: true,
    country: 'BR',
    searchQueries: BRAZIL_PRIORITY_SEARCH_QUERIES,
    maxPagesPerQuery: 2,
  },
  getOnBoard: {
    enabled: true,
    countryCode: 'BR',
    lang: 'en',
    searchQueries: BRAZIL_PRIORITY_SEARCH_QUERIES,
    perPage: 20,
    maxPagesPerQuery: 2,
  },
  ashbyCompanies: [
    { slug: 'linear', companyName: 'Linear' },
    { slug: 'railway', companyName: 'Railway' },
    { slug: 'neon', companyName: 'Neon' },
    { slug: 'perplexity', companyName: 'Perplexity AI' },
    { slug: 'supabase', companyName: 'Supabase' },
    { slug: 'render', companyName: 'Render' },
    { slug: 'posthog', companyName: 'PostHog' },
    { slug: 'infisical', companyName: 'Infisical' },
    { slug: 'cursor', companyName: 'Cursor' },
    { slug: 'openai', companyName: 'OpenAI' },
    { slug: 'cohere', companyName: 'Cohere' },
    { slug: 'confluent', companyName: 'Confluent' },
    { slug: '1password', companyName: '1Password' },
    { slug: 'n8n', companyName: 'n8n' },
    { slug: 'clerk', companyName: 'Clerk' },
    { slug: 'resend', companyName: 'Resend' },
    { slug: 'inngest', companyName: 'Inngest' },
  ],
  gupy: {
    enabled: true,
    searchQueries: [
      'programador',
      'desenvolvedor',
      'pleno',
      'senior',
      'junior',
      'tech lead',
      'engenheiro de software',
    ],
    maxPagesPerQuery: 3,
  },
  remotive: {
    enabled: true,
  },
  remoteOk: {
    enabled: true,
  },
  manualSource: {
    enabled: true,
  },
  browserMcp: {
    enabled: true,
    connectTimeoutMs: 15_000,
    parallelSites: true,
    globalMaxPages: 300,
    sites: {
      linkedin: {
        enabled: true,
        searchQueries: BRAZIL_PRIORITY_SEARCH_QUERIES,
        maxPagesPerQuery: 3,
        rateLimitMs: 2_000,
        maxJobs: 200,
        location: 'Brazil',
      },
      programathor: {
        enabled: true,
        searchQueries: BR_GENERIC_SEARCH_QUERIES,
        maxPagesPerQuery: 3,
        rateLimitMs: 2_000,
        maxJobs: 200,
      },
      glassdoor: {
        enabled: true,
        searchQueries: BRAZIL_PRIORITY_SEARCH_QUERIES,
        maxPagesPerQuery: 3,
        rateLimitMs: 6_000,
        maxJobs: 200,
        location: 'Brazil',
      },
      vagas_com: {
        enabled: true,
        searchQueries: BR_GENERIC_SEARCH_QUERIES,
        maxPagesPerQuery: 3,
        rateLimitMs: 2_000,
        maxJobs: 200,
      },
      catho: {
        enabled: true,
        searchQueries: BR_GENERIC_SEARCH_QUERIES,
        maxPagesPerQuery: 3,
        rateLimitMs: 2_000,
        maxJobs: 200,
      },
      infojobs_br: {
        enabled: true,
        searchQueries: BR_GENERIC_SEARCH_QUERIES,
        maxPagesPerQuery: 3,
        rateLimitMs: 2_000,
        maxJobs: 200,
      },
      gupy_public: {
        enabled: true,
        searchQueries: BR_GENERIC_SEARCH_QUERIES,
        maxPagesPerQuery: 3,
        rateLimitMs: 2_000,
        maxJobs: 200,
      },
      trampos_co: {
        enabled: true,
        searchQueries: BR_GENERIC_SEARCH_QUERIES,
        maxPagesPerQuery: 3,
        rateLimitMs: 2_000,
        maxJobs: 200,
      },
      revelo: {
        enabled: true,
        searchQueries: BR_GENERIC_SEARCH_QUERIES,
        maxPagesPerQuery: 3,
        rateLimitMs: 2_000,
        maxJobs: 200,
      },
      geekhunter: {
        enabled: true,
        searchQueries: BR_GENERIC_SEARCH_QUERIES,
        maxPagesPerQuery: 3,
        rateLimitMs: 2_000,
        maxJobs: 200,
      },
    },
  },
};

/**
 * When `config.excludeQaRoles === true`, re-injects the QA exclusion terms into
 * `excludedTitleKeywords` so legacy runs keep filtering QA titles out. The
 * function is idempotent: duplicate terms are not added when already present
 * (case-insensitive compare).
 */
export function applyExcludeQaRolesOverride(config: JobResearchConfig): JobResearchConfig {
  if (!config.excludeQaRoles) {
    return config;
  }

  const existing = new Set(config.excludedTitleKeywords.map((term) => term.toLowerCase()));
  const additions = QA_EXCLUSION_TERMS.filter((term) => !existing.has(term.toLowerCase()));

  if (additions.length === 0) {
    return config;
  }

  return {
    ...config,
    excludedTitleKeywords: [...config.excludedTitleKeywords, ...additions],
  };
}

function mergeBrowserMcpSites(
  defaults: Record<BrowserMcpSiteId, BrowserMcpSiteConfig>,
  overrides: Partial<Record<BrowserMcpSiteId, Partial<BrowserMcpSiteConfig>>> | undefined,
): Record<BrowserMcpSiteId, BrowserMcpSiteConfig> {
  if (!overrides) {
    return defaults;
  }

  const merged = { ...defaults } as Record<BrowserMcpSiteId, BrowserMcpSiteConfig>;
  const ids = Object.keys(overrides) as BrowserMcpSiteId[];
  for (const id of ids) {
    const siteOverride = overrides[id];
    if (!siteOverride) {
      continue;
    }
    merged[id] = {
      ...defaults[id],
      ...siteOverride,
    };
  }
  return merged;
}

function mergeBrowserMcpConfig(
  defaults: BrowserMcpConfig,
  overrides: Partial<BrowserMcpConfig> | undefined,
): BrowserMcpConfig {
  if (!overrides) {
    return defaults;
  }

  const { sites: sitesOverride, ...rest } = overrides;
  return {
    ...defaults,
    ...rest,
    sites: mergeBrowserMcpSites(defaults.sites, sitesOverride),
  };
}

export function createJobResearchConfig(
  overrides: Partial<JobResearchConfig> = {},
): JobResearchConfig {
  return {
    ...defaultJobResearchConfig,
    ...overrides,
    greenhouseBoards: overrides.greenhouseBoards ?? defaultJobResearchConfig.greenhouseBoards,
    leverCompanies: overrides.leverCompanies ?? defaultJobResearchConfig.leverCompanies,
    linkedIn: {
      ...defaultJobResearchConfig.linkedIn,
      ...overrides.linkedIn,
    },
    programathor: {
      ...defaultJobResearchConfig.programathor,
      ...overrides.programathor,
    },
    himalayas: {
      ...defaultJobResearchConfig.himalayas,
      ...overrides.himalayas,
    },
    getOnBoard: {
      ...defaultJobResearchConfig.getOnBoard,
      ...overrides.getOnBoard,
    },
    ashbyCompanies: overrides.ashbyCompanies ?? defaultJobResearchConfig.ashbyCompanies,
    gupy: {
      ...defaultJobResearchConfig.gupy,
      ...overrides.gupy,
    },
    remotive: {
      ...defaultJobResearchConfig.remotive,
      ...overrides.remotive,
    },
    remoteOk: {
      ...defaultJobResearchConfig.remoteOk,
      ...overrides.remoteOk,
    },
    manualSource: {
      ...defaultJobResearchConfig.manualSource,
      ...overrides.manualSource,
    },
    seniorityReportTargetJobsByGroup: {
      ...defaultJobResearchConfig.seniorityReportTargetJobsByGroup,
      ...overrides.seniorityReportTargetJobsByGroup,
    },
    maxJobAgeDaysBySourceTier: {
      ...defaultJobResearchConfig.maxJobAgeDaysBySourceTier,
      ...overrides.maxJobAgeDaysBySourceTier,
    },
    globalFallbackReportGroups:
      overrides.globalFallbackReportGroups ?? defaultJobResearchConfig.globalFallbackReportGroups,
    browserMcp: mergeBrowserMcpConfig(
      defaultJobResearchConfig.browserMcp,
      overrides.browserMcp,
    ),
  };
}
