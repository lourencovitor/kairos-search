import type { RawJobPosting, RegionFit, VisaSignal } from '../domain/job.types.js';
import { determineRegionFit, extractLocationSignals } from '../shared/location.util.js';
import { uniqueStrings } from '../shared/job.util.js';

export interface VisaRestrictionDetection {
  visaSignal: VisaSignal;
  restrictionSignals: string[];
  regionFit: RegionFit;
}

const REGION_RESTRICTION_PATTERNS: Array<{
  label: string;
  region: string;
  patterns: RegExp[];
}> = [
  {
    label: 'US-only restriction',
    region: 'usa',
    patterns: [
      /\bremote\s*\/\s*(usa|united states)\b/i,
      /\bus-remote\b/i,
      /\b(united states|usa)\s+only\b/i,
      /\bmust be (?:based|located|reside)[^.\n]{0,40}\b(united states|usa)\b/i,
      /\bauthorized to work in (?:the )?(united states|usa)\b/i,
    ],
  },
  {
    label: 'Canada-only restriction',
    region: 'canada',
    patterns: [
      /\bremote\s*\/\s*canada\b/i,
      /\bcan-remote\b/i,
      /\bcanada\s+only\b/i,
      /\bmust be (?:based|located|reside)[^.\n]{0,40}\bcanada\b/i,
      /\bauthorized to work in canada\b/i,
    ],
  },
  {
    label: 'Europe restriction',
    region: 'europe',
    patterns: [
      /\beurope\s+only\b/i,
      /\bremote\s*\/\s*europe\b/i,
      /\beu-remote\b/i,
      /\bmust be (?:based|located|reside)[^.\n]{0,40}\beurope\b/i,
    ],
  },
  {
    label: 'EMEA restriction',
    region: 'emea',
    patterns: [/\bemea\s+only\b/i, /\bremote\s*\/\s*emea\b/i],
  },
  {
    label: 'UK-only restriction',
    region: 'uk',
    patterns: [
      /\buk\s+only\b/i,
      /\bremote\s*\/\s*(uk|united kingdom)\b/i,
      /\bright to work in the uk\b/i,
    ],
  },
  {
    label: 'Australia-only restriction',
    region: 'australia',
    patterns: [
      /\baustralia\s+only\b/i,
      /\bremote\s*\/\s*australia\b/i,
      /\bright to work in australia\b/i,
    ],
  },
  {
    label: 'Brazil-compatible restriction',
    region: 'brazil',
    patterns: [/\bremote\s*\/\s*(brazil|brasil)\b/i, /\bbrazil\s+only\b/i],
  },
  {
    label: 'LATAM-compatible restriction',
    region: 'latam',
    patterns: [/\blatam\b/i, /\blatin america\b/i],
  },
  {
    label: 'Americas-compatible restriction',
    region: 'americas',
    patterns: [/\bamericas\b/i],
  },
  {
    label: 'Citizenship required',
    region: 'usa',
    patterns: [
      /\bcitizenship required\b/i,
      /\bmust be (?:a )?(?:us|u\.s\.) citizen\b/i,
      /\bus citizen(ship)?\b/i,
      /\bgreen card\b/i,
      /\bpermanent resident\b/i,
    ],
  },
  {
    label: 'Security clearance required',
    region: 'usa',
    patterns: [
      /\bsecurity clearance\b/i,
      /\bpublic trust\b/i,
      /\bsecret clearance\b/i,
      /\btop secret\b/i,
      /\bts\/sci\b/i,
    ],
  },
];

export function detectVisaRestrictions(
  rawJob: Pick<RawJobPosting, 'locationText' | 'descriptionText' | 'regionHints' | 'restrictionHints'>,
  remoteRegions: string[],
): VisaRestrictionDetection {
  const descriptionExcerpt = rawJob.descriptionText.slice(0, 1_500);
  const searchableText = [rawJob.locationText, descriptionExcerpt].join(' ');
  const matchedRestrictions = REGION_RESTRICTION_PATTERNS.flatMap((restriction) =>
    restriction.patterns.some((pattern) => pattern.test(searchableText))
      ? [restriction]
      : [],
  );

  const explicitRegions = uniqueStrings([
    ...remoteRegions,
    ...rawJob.regionHints.flatMap((hint) => extractLocationSignals(hint)),
    ...extractLocationSignals(rawJob.locationText),
    ...matchedRestrictions.map((restriction) => restriction.region),
  ]);

  let visaSignal: VisaSignal = 'not_mentioned';

  if (
    /\bvisa sponsorship available\b|\bwe sponsor visas\b|\bsponsorship available\b/i.test(
      searchableText,
    )
  ) {
    visaSignal = 'supports';
  } else if (
    /\bno visa sponsorship\b|\bunable to sponsor\b|\bcannot sponsor\b|\bwon'?t sponsor\b/i.test(
      searchableText,
    )
  ) {
    visaSignal = 'not_supported';
  } else if (
    /\bauthorized to work in\b|\bright to work in\b|\bexisting work authorization\b/i.test(
      searchableText,
    )
  ) {
    visaSignal = 'requires_work_authorization';
  }

  return {
    visaSignal,
    restrictionSignals: uniqueStrings([
      ...matchedRestrictions.map((restriction) => restriction.label),
      ...rawJob.restrictionHints,
    ]),
    regionFit: determineRegionFit(explicitRegions),
  };
}
