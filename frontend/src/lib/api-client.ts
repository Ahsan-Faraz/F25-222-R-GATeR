/**
 * GitHub OAuth token from NextAuth — sent as Bearer for Flask `/api/backend/*`.
 */

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

const BASE = '/api/backend';

function withAuth(headers?: HeadersInit): Headers {
  const h = new Headers(headers);
  if (accessToken) {
    h.set('Authorization', `Bearer ${accessToken}`);
  }
  return h;
}

/** Raw fetch to Flask (proxied by Next). */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = withAuth(init?.headers);
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${BASE}${path}`, { ...init, headers });
}

/** JSON responses; throws Error with `.status` on non-OK. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    let err: { error?: string; message?: string } = {};
    try {
      err = JSON.parse(text);
    } catch {
      err = { error: text || res.statusText };
    }
    const e = new Error(err.error || err.message || `HTTP ${res.status}`) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
