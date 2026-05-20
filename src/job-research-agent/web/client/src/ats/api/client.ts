import type { AnalysisDto, AtsJobDto, CandidateProfile, UserDto } from './types.js';

export interface RegisterInput {
  readonly name: string;
  readonly email: string;
  readonly technologies: readonly string[];
}

/**
 * Dev: sempre same-origin (:3355) + proxy Vite → ATS (:4000) para cookies de sessão.
 * Produção: VITE_ATS_API_URL no build (ex. https://kairos-ats.onrender.com).
 */
const API_BASE = import.meta.env.DEV
  ? ''
  : ((import.meta.env.VITE_ATS_API_URL as string | undefined)?.trim() ?? '');

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
  if (!API_BASE && !import.meta.env.DEV) {
    throw new AtsApiError(
      0,
      'VITE_ATS_API_URL não configurada. Crie .env (cp .env.example) e rode pnpm build:client de novo.',
    );
  }
  const url = API_BASE ? `${API_BASE}${path}` : path;
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    });
  } catch (err) {
    const hint =
      err instanceof TypeError
        ? ` Não foi possível contactar a API ATS${API_BASE ? ` em ${API_BASE}` : ''} (API parada, proxy /v1 ou imagem Docker desatualizada).`
        : '';
    throw new AtsApiError(0, (err instanceof Error ? err.message : 'Erro de rede') + hint);
  }

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
  register(input: RegisterInput): Promise<{ data: { sent: true } }> {
    return request('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getMe(): Promise<{ data: UserDto }> {
    return request('/v1/auth/me');
  },

  logout(): Promise<{ data: { ok: true } }> {
    return request('/v1/auth/logout', { method: 'POST', body: '{}' });
  },

  async checkSession(): Promise<boolean> {
    try {
      await request('/v1/auth/me');
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

  createAnalysis(
    jobId: string,
    profile: CandidateProfile,
    jobDescriptionText?: string,
  ): Promise<{ data: AnalysisDto }> {
    const body: { jobId: string; profile: CandidateProfile; jobDescriptionText?: string } = {
      jobId,
      profile,
    };
    const desc = jobDescriptionText?.trim();
    if (desc) {
      body.jobDescriptionText = desc;
    }
    return request('/v1/analyses', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getAnalysis(id: string): Promise<{ data: AnalysisDto }> {
    return request(`/v1/analyses/${id}`);
  },
};
