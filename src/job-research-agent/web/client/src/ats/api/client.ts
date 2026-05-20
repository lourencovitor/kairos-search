import type { AnalysisDto, AtsJobDto, CandidateProfile } from './types.js';

const API_BASE = import.meta.env.VITE_ATS_API_URL ?? '';

export class AtsApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AtsApiError';
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new AtsApiError(0, 'VITE_ATS_API_URL não configurada');
  }
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await parseJson<{ error?: { message?: string } }>(response);
      message = body.error?.message ?? message;
    } catch {
      // ignore
    }
    throw new AtsApiError(response.status, message);
  }

  return parseJson<T>(response);
}

export const atsApi = {
  async checkSession(): Promise<boolean> {
    try {
      await request('/v1/jobs?limit=1');
      return true;
    } catch (err) {
      if (err instanceof AtsApiError && err.status === 401) {
        return false;
      }
      throw err;
    }
  },

  lookupJob(source: string, sourceId: string): Promise<{ data: AtsJobDto }> {
    const qs = new URLSearchParams({ source, sourceId });
    return request(`/v1/jobs/lookup?${qs}`);
  },

  requestMagicCode(email: string): Promise<{ data: { sent: true } }> {
    return request('/v1/auth/magic-code/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verifyMagicCode(email: string, code: string): Promise<{ data: { userId: string } }> {
    return request('/v1/auth/magic-code/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  },

  uploadCv(file: File): Promise<{ data: { profile: CandidateProfile } }> {
    const form = new FormData();
    form.append('cv', file);
    return request('/v1/cv', { method: 'POST', body: form });
  },

  createAnalysis(jobId: string, profile: CandidateProfile): Promise<{ data: AnalysisDto }> {
    return request('/v1/analyses', {
      method: 'POST',
      body: JSON.stringify({ jobId, profile }),
    });
  },

  getAnalysis(id: string): Promise<{ data: AnalysisDto }> {
    return request(`/v1/analyses/${id}`);
  },
};
