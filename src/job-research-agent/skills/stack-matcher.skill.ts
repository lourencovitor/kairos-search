import type { TechnicalKeywordProfile } from '../config/job-research.config.js';
import { normalizeForComparison, uniqueStrings } from '../shared/job.util.js';

export function matchStackSignals(
  values: string[],
  technicalKeywordProfiles: TechnicalKeywordProfile[],
): string[] {
  const searchableText = normalizeForComparison(values.join(' '));

  return uniqueStrings(
    technicalKeywordProfiles.flatMap((profile) =>
      profile.aliases.some((alias) =>
        searchableText.includes(normalizeForComparison(alias)),
      )
        ? [profile.label]
        : [],
    ),
  );
}
