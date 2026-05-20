import type { CandidateProfile } from './api/types.js';

const KEY = 'kairos_search_cv_profile';

export function loadCvProfile(): CandidateProfile | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CandidateProfile) : null;
  } catch {
    return null;
  }
}

export function saveCvProfile(profile: CandidateProfile): void {
  sessionStorage.setItem(KEY, JSON.stringify(profile));
}

export function clearCvProfile(): void {
  sessionStorage.removeItem(KEY);
}
