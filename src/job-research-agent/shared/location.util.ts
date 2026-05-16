import type { BrazilLocationPriority, RegionFit } from '../domain/job.types.js';
import { normalizeForComparison, uniqueStrings } from './job.util.js';

const REGION_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: 'worldwide',
    patterns: [/\bworldwide\b/i, /\bglobal(?:ly)?\b/i, /\banywhere\b/i],
  },
  {
    label: 'brazil',
    patterns: [/\bbrazil\b/i, /\bbrasil\b/i],
  },
  {
    label: 'latam',
    patterns: [/\blatam\b/i, /\blatin america\b/i],
  },
  {
    label: 'south_america',
    patterns: [/\bsouth america\b/i],
  },
  {
    label: 'americas',
    patterns: [/\bamericas\b/i, /\bamer\b/i],
  },
  {
    label: 'usa',
    patterns: [
      /\busa\b/i,
      /\bunited states\b/i,
      /\bu\.s\.\b/i,
      /\bus-only\b/i,
      /\bus-remote\b/i,
      /\bremote\s*\/\s*us\b/i,
      /\bremote\s*\/\s*usa\b/i,
      /\bnew york\b/i,
      /\bnyc\b/i,
      /(?:^|[,\s/-])ny(?:$|[,\s/-])/i,
      /\bsan francisco\b/i,
      /(?:^|[,\s/-])sf(?:$|[,\s/-])/i,
      /\bseattle\b/i,
      /\bboston\b/i,
      /\bchicago\b/i,
    ],
  },
  {
    label: 'canada',
    patterns: [/\bcanada\b/i, /\bcan-remote\b/i, /\btoronto\b/i, /\bvancouver\b/i, /\bmontreal\b/i],
  },
  {
    label: 'europe',
    patterns: [/\beurope\b/i, /\beuropean union\b/i, /\beu only\b/i, /\beu-remote\b/i],
  },
  {
    label: 'emea',
    patterns: [/\bemea\b/i],
  },
  {
    label: 'uk',
    patterns: [/\buk\b/i, /\bunited kingdom\b/i],
  },
  {
    label: 'apac',
    patterns: [/\bapac\b/i, /\basia pacific\b/i],
  },
  {
    label: 'asia',
    patterns: [/\basia\b/i],
  },
  {
    label: 'oceania',
    patterns: [/\boceania\b/i],
  },
  {
    label: 'india',
    patterns: [/\bindia\b/i],
  },
  {
    label: 'turkiye',
    patterns: [/\btürkiye\b/i, /\bturkiye\b/i, /\bturkey\b/i, /\bankara\b/i],
  },
  {
    label: 'australia',
    patterns: [/\baustralia\b/i],
  },
  {
    label: 'philippines',
    patterns: [/\bphilippines\b/i],
  },
  {
    label: 'singapore',
    patterns: [/\bsingapore\b/i],
  },
  {
    label: 'japan',
    patterns: [/\bjapan\b/i],
  },
  {
    label: 'germany',
    patterns: [/\bgermany\b/i],
  },
  {
    label: 'poland',
    patterns: [/\bpoland\b/i],
  },
  {
    label: 'spain',
    patterns: [/\bspain\b/i],
  },
  {
    label: 'portugal',
    patterns: [/\bportugal\b/i],
  },
  {
    label: 'france',
    patterns: [/\bfrance\b/i],
  },
  {
    label: 'netherlands',
    patterns: [/\bnetherlands\b/i],
  },
  {
    label: 'china',
    patterns: [/\bchina\b/i, /\bbeijing\b/i],
  },
  {
    label: 'taiwan',
    patterns: [/\btaiwan\b/i, /\btaipei\b/i],
  },
  {
    label: 'colombia',
    patterns: [/\bcolombia\b/i],
  },
  {
    label: 'argentina',
    patterns: [/\bargentina\b/i],
  },
  {
    label: 'mexico',
    patterns: [/\bmexico\b/i],
  },
  {
    label: 'chile',
    patterns: [/\bchile\b/i],
  },
  {
    label: 'peru',
    patterns: [/\bperu\b/i],
  },
  {
    label: 'uruguay',
    patterns: [/\buruguay\b/i],
  },
  {
    label: 'costa_rica',
    patterns: [/\bcosta rica\b/i],
  },
];

const HIGH_COMPATIBILITY = new Set(['worldwide', 'brazil', 'latam', 'south_america', 'americas']);
const PARTIAL_LATAM = new Set([
  'colombia',
  'argentina',
  'mexico',
  'chile',
  'peru',
  'uruguay',
  'costa_rica',
]);

const BRAZIL_CITY_PATTERNS: Array<{
  label: string;
  priority: BrazilLocationPriority;
  patterns: RegExp[];
}> = [
  {
    label: 'Sao Paulo',
    priority: 'sao_paulo',
    patterns: [
      /\bsão paulo\b/i,
      /\bsao paulo\b/i,
      /(?:^|[,\s/-])sp(?:$|[,\s/-])/i,
    ],
  },
  {
    label: 'Rio de Janeiro',
    priority: 'rio_de_janeiro',
    patterns: [
      /\brio de janeiro\b/i,
      /(?:^|[,\s/-])rj(?:$|[,\s/-])/i,
    ],
  },
  {
    label: 'Belo Horizonte',
    priority: 'major_city',
    patterns: [
      /\bbelo horizonte\b/i,
      /(?:^|[,\s/-])bh(?:$|[,\s/-])/i,
    ],
  },
  {
    label: 'Curitiba',
    priority: 'major_city',
    patterns: [/\bcuritiba\b/i],
  },
  {
    label: 'Porto Alegre',
    priority: 'major_city',
    patterns: [/\bporto alegre\b/i],
  },
  {
    label: 'Brasilia',
    priority: 'major_city',
    patterns: [/\bbrasília\b/i, /\bbrasilia\b/i],
  },
  {
    label: 'Florianopolis',
    priority: 'major_city',
    patterns: [/\bflorianópolis\b/i, /\bflorianopolis\b/i],
  },
  {
    label: 'Recife',
    priority: 'major_city',
    patterns: [/\brecife\b/i],
  },
  {
    label: 'Salvador',
    priority: 'major_city',
    patterns: [/\bsalvador\b/i],
  },
  {
    label: 'Fortaleza',
    priority: 'major_city',
    patterns: [/\bfortaleza\b/i],
  },
  {
    label: 'Goiania',
    priority: 'major_city',
    patterns: [/\bgoiânia\b/i, /\bgoiania\b/i],
  },
  {
    label: 'Campinas',
    priority: 'major_city',
    patterns: [/\bcampinas\b/i],
  },
  {
    label: 'Barueri',
    priority: 'major_city',
    patterns: [/\bbarueri\b/i],
  },
  {
    label: 'Alphaville',
    priority: 'major_city',
    patterns: [/\balphaville\b/i],
  },
  {
    label: 'Osasco',
    priority: 'major_city',
    patterns: [/\bosasco\b/i],
  },
];

export interface BrazilLocationMatch {
  isBrazilLocation: boolean;
  priority: BrazilLocationPriority;
  matchedLocation?: string;
}

export function extractLocationSignals(text: string): string[] {
  if (!normalizeForComparison(text)) {
    return [];
  }

  const signals = REGION_PATTERNS.flatMap((entry) =>
    entry.patterns.some((pattern) => pattern.test(text)) ? [entry.label] : [],
  );

  return uniqueStrings(signals);
}

export function detectBrazilLocation(text: string): BrazilLocationMatch {
  const hasBrazilCountrySignal = /\bbrazil\b/i.test(text) || /\bbrasil\b/i.test(text);
  const matchedCity = BRAZIL_CITY_PATTERNS.find((entry) => {
    if (entry.label === 'Salvador' && /\bel salvador\b/i.test(text)) {
      return false;
    }

    return entry.patterns.some((pattern) => pattern.test(text));
  });

  if (matchedCity) {
    return {
      isBrazilLocation: true,
      priority: matchedCity.priority,
      matchedLocation: matchedCity.label,
    };
  }

  if (hasBrazilCountrySignal) {
    return {
      isBrazilLocation: true,
      priority: 'none',
      matchedLocation: 'Brazil',
    };
  }

  return {
    isBrazilLocation: false,
    priority: 'none',
  };
}

export function determineRegionFit(regions: string[]): RegionFit {
  if (regions.length === 0) {
    return 'unknown';
  }

  if (regions.includes('worldwide')) {
    return 'worldwide';
  }

  if (regions.some((region) => HIGH_COMPATIBILITY.has(region))) {
    return 'brazil_or_latam';
  }

  if (regions.some((region) => PARTIAL_LATAM.has(region))) {
    return 'partial_latam';
  }

  return 'incompatible';
}

export function buildLocationBucket(regions: string[], locationText: string): string {
  const regionFit = determineRegionFit(regions);

  if (regionFit === 'worldwide' || regionFit === 'brazil_or_latam' || regionFit === 'partial_latam') {
    return regionFit;
  }

  const cleanedLocation = normalizeForComparison(locationText).replace(/\s+/g, '-');

  return cleanedLocation || 'unknown';
}
