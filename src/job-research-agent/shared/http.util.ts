export interface FetchJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  method?: string;
  body?: string;
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      accept: 'application/json',
      'user-agent': 'job-research-agent-mvp/0.1',
      ...options.headers,
    },
    body: options.body,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
}

export async function fetchText(url: string, options: FetchJsonOptions = {}): Promise<string> {
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'job-research-agent-mvp/0.1',
      ...options.headers,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} for ${url}`);
  }

  return await response.text();
}

export async function isUrlReachable(
  url: string,
  options: FetchJsonOptions = {},
): Promise<boolean> {
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;
  const headers = {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'user-agent': 'job-research-agent-mvp/0.1',
    ...options.headers,
  };

  try {
    const headResponse = await fetch(url, {
      method: 'HEAD',
      headers,
      redirect: 'follow',
      signal,
    });

    if (headResponse.ok) {
      return true;
    }

    if (headResponse.status !== 405 && headResponse.status !== 403) {
      return false;
    }
  } catch {
    // Fall back to GET for providers that reject or mishandle HEAD requests.
  }

  try {
    const getResponse = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal,
    });

    return getResponse.ok;
  } catch {
    return false;
  }
}
