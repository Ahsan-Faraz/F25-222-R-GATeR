/**
 * GitHub OAuth token from NextAuth — sent as Bearer for Flask `/api/backend/*`.
 */

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  console.log('[api-client] setAccessToken called with:', token ? `token (${token.substring(0, 10)}...)` : 'null');
  accessToken = token;
  console.log('[api-client] accessToken stored:', accessToken ? 'yes' : 'no');
}

export function getAccessToken(): string | null {
  console.log('[api-client] getAccessToken called, returning:', accessToken ? `token (${accessToken.substring(0, 10)}...)` : 'null');
  return accessToken;
}

const BASE = '/api/backend';

function withAuth(headers?: HeadersInit): Headers {
  const h = new Headers(headers);
  if (accessToken) {
    console.log('[api-client] Adding Authorization header with token');
    h.set('Authorization', `Bearer ${accessToken}`);
  } else {
    console.log('[api-client] No access token available, skipping Authorization header');
  }
  return h;
}

/** Raw fetch to Flask (proxied by Next). */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  console.log('[api-client] apiFetch called:', path);
  const headers = withAuth(init?.headers);
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const url = `${BASE}${path}`;
  console.log('[api-client] Fetching:', url);
  return fetch(url, { ...init, headers });
}

/** JSON responses; throws Error with `.status` on non-OK. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  console.log('[api-client] Response status:', res.status, 'for', path);
  if (!res.ok) {
    let err: { error?: string; message?: string } = {};
    try {
      err = JSON.parse(text);
    } catch {
      err = { error: text || res.statusText };
    }
    console.error('[api-client] Error response:', err);
    const e = new Error(err.error || err.message || `HTTP ${res.status}`) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  if (!text) return {} as T;
  const data = JSON.parse(text) as T;
  console.log('[api-client] Success response data:', data);
  return data;
}
