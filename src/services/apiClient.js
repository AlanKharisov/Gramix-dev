import { auth } from "../pages/firebase-config";
import { API_BASE, APP_RELEASE } from "../config";
import { reportIncident, beginAnalysis } from './telemetry';
import { Capacitor } from '@capacitor/core';
import { fetchWithReadRetry } from './networkRead';

export async function firebaseToken(forceRefresh = false) {
  let timer;
  try {
    return await Promise.race([
      (async () => {
        await auth.authStateReady?.();
        const user = auth.currentUser;
        if (!user) throw new Error('authentication_required');
        return user.getIdToken(forceRefresh);
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('request_timeout')), 10000); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function authHeaders(extra = {}) {
  const token = await firebaseToken();
  return { ...extra, Authorization: `Bearer ${token}` };
}

export async function apiFetch(path, options = {}) {
  let headers;
  try { headers = await authHeaders(options.headers || {}); }
  catch (error) {
    if (error.message !== 'authentication_required') reportIncident('api_failure', error, { endpoint: path, code: 'request_timeout' });
    throw error;
  }
  return apiFetchWithToken(path, headers.Authorization.slice(7), options);
}

export async function apiFetchWithToken(path, token, options = {}) {
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}`,
    'X-App-Release': APP_RELEASE, 'X-App-Platform': Capacitor.getPlatform() };
  const started = Date.now();
  const endAnalysis = path.startsWith('/analyze') ? beginAnalysis(path.split('?')[0]) : () => {};
  const timeout = path.startsWith('/analyze') ? 75000 : 20000;
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
  let requestId = '';
  try {
    const response = await fetchWithReadRetry(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    requestId = response.headers.get('X-Request-ID') || '';
    let payload;
    try { payload = await response.json(); } catch { throw new Error('invalid_response'); }
    if (!response.ok) {
      const error = new Error(payload.error || `api_${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    const cancelled = options.signal?.aborted && !timedOut;
    // Persist a client copy too: if the server's incident store is down, it
    // can be retried after recovery. Request IDs deduplicate it server-side.
    if (!cancelled && ![422, 429].includes(error.status)) {
      reportIncident(timedOut && path.startsWith('/analyze') ? 'analysis_timeout' : 'api_failure', error, {
        endpoint: path, requestId, durationMs: Date.now() - started,
        code: timedOut ? 'request_timeout' : error.status ? `api_${error.status}` : error.message === 'invalid_response' ? 'invalid_response' : 'network_error',
      });
    }
    if (timedOut) { const timeoutError = new Error('request_timeout'); timeoutError.name = 'TimeoutError'; throw timeoutError; }
    throw error;
  } finally {
    endAnalysis();
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
