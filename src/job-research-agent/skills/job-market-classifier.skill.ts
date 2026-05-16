import type {
  BrazilLocationPriority,
  JobMarket,
  RawJobPosting,
  RegionFit,
  RemotePolicy,
} from '../domain/job.types.js';
import { detectBrazilLocation, extractLocationSignals } from '../shared/location.util.js';
import { uniqueStrings } from '../shared/job.util.js';

export interface JobMarketClassification {
  market: JobMarket;
  brazilLocationPriority: BrazilLocationPriority;
  signals: string[];
}

const LATAM_ONLY_SIGNALS = new Set([
  'latam',
  'south_america',
  'americas',
  'colombia',
  'argentina',
  'mexico',
  'chile',
  'peru',
  'uruguay',
  'costa_rica',
]);

const FOREIGN_OR_BROAD_SIGNALS = new Set([
  'worldwide',
  'usa',
  'canada',
  'europe',
  'emea',
  'uk',
  'apac',
  'asia',
  'oceania',
  'india',
  'turkiye',
  'australia',
  'philippines',
  'singapore',
  'japan',
  'germany',
  'poland',
  'spain',
  'portugal',
  'france',
  'netherlands',
  'china',
  'taiwan',
]);

const HARD_RESTRICTION_LABELS = new Set([
  'US-only restriction',
  'Canada-only restriction',
  'Europe restriction',
  'EMEA restriction',
  'UK-only restriction',
  'Australia-only restriction',
  'Citizenship required',
  'Security clearance required',
]);

export function classifyJobMarket(input: {
  rawJob: Pick<RawJobPosting, 'locationText' | 'descriptionText' | 'marketHint' | 'regionHints' | 'sourceFocus'>;
  remotePolicy: RemotePolicy;
  remoteRegions: string[];
  regionFit: RegionFit;
  restrictionSignals: string[];
}): JobMarketClassification {
  const searchableText = [input.rawJob.locationText, input.rawJob.descriptionText.slice(0, 1_500)]
    .filter(Boolean)
    .join(' ');
  const hintedSignals = uniqueStrings(
    input.rawJob.regionHints.flatMap((hint) => extractLocationSignals(hint)),
  );
  const locationTextSignals = uniqueStrings([
    ...input.remoteRegions,
    ...hintedSignals,
    ...extractLocationSignals(input.rawJob.locationText),
  ]);
  const locationSignals = uniqueStrings([
    ...locationTextSignals,
    ...extractLocationSignals(searchableText),
  ]);
  const brazilLocation = detectBrazilLocation(input.rawJob.locationText);
  const hasHardRestriction = input.restrictionSignals.some((signal) =>
    HARD_RESTRICTION_LABELS.has(signal),
  );
  const hasExplicitBrazilFriendlyText =
    /\bbrazil\b|\bbrasil\b/i.test(searchableText) &&
    /\bremote\b|\bdistributed\b|\bwork from home\b|\bwork remotely\b/i.test(searchableText);
  const latamSignals = locationSignals.filter((signal) => LATAM_ONLY_SIGNALS.has(signal));
  const broadOrForeignSignals = locationSignals.filter((signal) =>
    FOREIGN_OR_BROAD_SIGNALS.has(signal),
  );
  const hasWorldwideCompatibility = locationSignals.includes('worldwide');
  const hasBroadGlobalCompatibility =
    broadOrForeignSignals.filter((signal) =>
      ['americas', 'europe', 'emea', 'apac', 'asia', 'oceania'].includes(signal),
    ).length >= 2;
  const hasExplicitForeignSignal = broadOrForeignSignals.some((signal) => signal !== 'worldwide');
  const isLatamScopedOnly =
    input.remotePolicy === 'remote' &&
    latamSignals.length > 0 &&
    !hasWorldwideCompatibility &&
    !hasBroadGlobalCompatibility &&
    !hasExplicitForeignSignal;

  if (brazilLocation.isBrazilLocation) {
    const hasAdditionalLocationSignals = locationTextSignals.some((signal) => signal !== 'brazil');

    if (input.remotePolicy === 'remote' && hasAdditionalLocationSignals) {
      return {
        market: 'brazil_friendly',
        brazilLocationPriority: brazilLocation.priority,
        signals: uniqueStrings([brazilLocation.matchedLocation, ...locationSignals]),
      };
    }

    return {
      market: 'brazil',
      brazilLocationPriority: brazilLocation.priority,
      signals: uniqueStrings([brazilLocation.matchedLocation, ...locationSignals]),
    };
  }

  if (hasExplicitBrazilFriendlyText) {
    return {
      market: 'brazil_friendly',
      brazilLocationPriority: 'none',
      signals: locationSignals,
    };
  }

  if (isLatamScopedOnly) {
    return {
      market: 'latam',
      brazilLocationPriority: 'none',
      signals: locationSignals,
    };
  }

  if (
    input.remotePolicy === 'remote' &&
    (hasWorldwideCompatibility || hasBroadGlobalCompatibility)
  ) {
    return {
      market: 'international',
      brazilLocationPriority: 'none',
      signals: locationSignals,
    };
  }

  if (hasHardRestriction || hasExplicitForeignSignal || input.regionFit === 'incompatible') {
    return {
      market: 'international',
      brazilLocationPriority: 'none',
      signals: locationSignals,
    };
  }

  if (input.rawJob.marketHint) {
    return {
      market: input.rawJob.marketHint,
      brazilLocationPriority: 'none',
      signals: locationSignals,
    };
  }

  if (input.remotePolicy !== 'unknown' && input.remotePolicy !== 'remote') {
    return {
      market: 'international',
      brazilLocationPriority: 'none',
      signals: locationSignals,
    };
  }

  if (input.rawJob.sourceFocus === 'brazil') {
    return {
      market: 'brazil_friendly',
      brazilLocationPriority: 'none',
      signals: [...locationSignals, 'sourceFocus:brazil'],
    };
  }

  return {
    market: 'unclear',
    brazilLocationPriority: 'none',
    signals: locationSignals,
  };
}

export function isPrimaryBrazilMarket(market: JobMarket): boolean {
  return market === 'brazil' || market === 'brazil_friendly' || market === 'latam';
}
