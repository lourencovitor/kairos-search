import { createHash } from 'node:crypto';

export function normalizeWhitespace(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function stripHtmlTags(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const withoutTags = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return normalizeWhitespace(decodeHtmlEntities(withoutTags));
}

export function slugify(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeForComparison(value: string | undefined): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ');
}

export function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map((value) => normalizeWhitespace(value ?? '')).filter(Boolean))];
}

export function toIsoDate(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const date = new Date(normalizeDateInput(value));

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function normalizeDateInput(value: string | number): string | number {
  if (typeof value === 'number') {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (/^\d+$/.test(value)) {
    const numericValue = Number(value);
    return numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
  }

  return value;
}

export function daysSince(value: string | undefined, now: Date): number | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

export function freshestAgeInDays(
  now: Date,
  ...values: Array<string | undefined>
): number | undefined {
  for (const value of values) {
    const age = daysSince(value, now);

    if (age !== undefined) {
      return age;
    }
  }

  return undefined;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildStableId(...parts: string[]): string {
  return createHash('sha1').update(parts.join('::')).digest('hex').slice(0, 16);
}

export function getHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function normalizeJobUrl(url: string, sourceId?: string): string {
  try {
    const parsedUrl = new URL(url);

    if (/(^|\.)linkedin\.com$/i.test(parsedUrl.hostname)) {
      const linkedInJobId = extractLinkedInJobId(parsedUrl.pathname) ?? extractNumericJobId(sourceId);

      parsedUrl.hostname = 'www.linkedin.com';
      parsedUrl.search = '';
      parsedUrl.hash = '';

      if (linkedInJobId) {
        parsedUrl.pathname = `/jobs/view/${linkedInJobId}/`;
      }

      return parsedUrl.toString();
    }

    return parsedUrl.toString();
  } catch {
    return url;
  }
}

function extractLinkedInJobId(pathname: string): string | undefined {
  const match = pathname.match(/\/jobs\/view\/(?:[^/]+-)?(\d+)/i);
  return match?.[1];
}

function extractNumericJobId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return /^\d+$/.test(value) ? value : undefined;
}
