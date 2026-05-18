import { useEffect, useState } from 'react';

import type { LatestPayload } from '../api/types.js';
import { INITIAL_PAYLOAD } from '../api/types.js';

export interface UseLatestPayloadResult {
  payload: LatestPayload;
  loading: boolean;
  status: string;
  error: string | null;
  loadLatest: () => Promise<void>;
}

export function useLatestPayload(): UseLatestPayloadResult {
  const [payload, setPayload] = useState<LatestPayload>(INITIAL_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Carregando...');
  const [error, setError] = useState<string | null>(null);

  async function loadLatest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/latest');
      const data = (await res.json()) as LatestPayload;
      setPayload({
        summary: data.summary,
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
        downloads: Array.isArray(data.downloads) ? data.downloads : [],
      });
      setStatus(data.jobs?.length ? 'Atualizado' : 'Sem dados');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLatest();
  }, []);

  return { payload, loading, status, error, loadLatest };
}
