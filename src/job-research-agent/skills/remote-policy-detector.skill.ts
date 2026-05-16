import type { RawJobPosting, RemotePolicy } from '../domain/job.types.js';
import { extractLocationSignals } from '../shared/location.util.js';
import { clamp, normalizeWhitespace, uniqueStrings } from '../shared/job.util.js';

export interface RemotePolicyDetection {
  policy: RemotePolicy;
  confidence: number;
  regions: string[];
  evidence: string[];
}

export function detectRemotePolicy(
  rawJob: Pick<
    RawJobPosting,
    'title' | 'locationText' | 'descriptionText' | 'metadata' | 'remotePolicyHint'
  >,
): RemotePolicyDetection {
  const locationText = normalizeWhitespace(rawJob.locationText);
  const workplaceType =
    typeof rawJob.metadata.workplaceType === 'string'
      ? rawJob.metadata.workplaceType
      : '';
  const remoteBySource = rawJob.metadata.remoteBySource === true;
  const remotePolicyHint = rawJob.remotePolicyHint;
  const searchableText = [rawJob.title, locationText, workplaceType, rawJob.descriptionText.slice(0, 800)]
    .filter(Boolean)
    .join(' ');
  const explicitRemoteText = [rawJob.title, locationText, workplaceType, rawJob.descriptionText.slice(0, 400)]
    .filter(Boolean)
    .join(' ');

  let remoteScore = 0;
  let hybridScore = 0;
  let onsiteScore = 0;
  const evidence: string[] = [];

  if (/\bremote\b|\bremoto\b|\bremota\b/i.test(locationText)) {
    remoteScore += 3;
    evidence.push('Location contains remote');
  }

  if (/\bremote\b|\bremoto\b|\bremota\b/i.test(workplaceType)) {
    remoteScore += 3;
    evidence.push('Workplace type is remote');
  }

  if (remoteBySource) {
    remoteScore += 3;
    evidence.push('Source is remote-only');
  }

  if (remotePolicyHint === 'remote') {
    remoteScore += 4;
    evidence.push('Source marks the job as remote');
  } else if (remotePolicyHint === 'hybrid') {
    hybridScore += 4;
    evidence.push('Source marks the job as hybrid');
  } else if (remotePolicyHint === 'onsite') {
    onsiteScore += 4;
    evidence.push('Source marks the job as onsite');
  }

  if (/\bhome based\b/i.test(locationText) || /\bdistributed\b/i.test(locationText)) {
    remoteScore += 3;
    evidence.push('Location indicates home-based or distributed work');
  }

  if (
    /\bfully remote\b|\bremote role\b|\bremote position\b|\bremote-first\b|\bwork remotely\b|\bwork from home\b|\bremote within\b|\bhome based\b|\b100%\s*remot[oa]\b|\bremot[oa]\b/i.test(
      explicitRemoteText,
    )
  ) {
    remoteScore += 2;
  }

  if (/\bhybrid\b|\bh[ií]brid[oa]\b|\boffice\/remote\b|\bremote\/office\b/i.test(searchableText)) {
    hybridScore += 4;
    evidence.push('Posting mentions hybrid or office/remote');
  }

  if (/\bonsite\b|\bon-site\b|\bin office\b|\bin-office\b|\bon premises\b|\bpresencial\b/i.test(searchableText)) {
    onsiteScore += 3;
    evidence.push('Posting mentions onsite or in-office');
  }

  let policy: RemotePolicy = 'unknown';
  const bestScore = Math.max(remoteScore, hybridScore, onsiteScore);

  if (remoteScore > 0 && remoteScore >= hybridScore && remoteScore >= onsiteScore) {
    policy = 'remote';
  } else if (hybridScore > 0 && hybridScore >= onsiteScore) {
    policy = 'hybrid';
  } else if (onsiteScore > 0) {
    policy = 'onsite';
  }

  const regions = uniqueStrings([
    ...extractLocationSignals(locationText),
    ...extractLocationSignals(workplaceType),
  ]);

  return {
    policy,
    confidence: bestScore === 0 ? 0 : clamp(bestScore / 5, 0.2, 1),
    regions,
    evidence,
  };
}
