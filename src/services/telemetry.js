import { auth } from '../pages/firebase-config';
import { API_BASE, APP_RELEASE } from '../config';
import { Capacitor, registerPlugin } from '@capacitor/core';
const NativeReliability = registerPlugin('GramixReliability');

const KEY = '_gramix_incidents_v1';
const ANALYSIS_KEY = '_gramix_pending_analysis_v1';
const session = crypto.randomUUID();
let sending = false;
let installed = false;
let retryTimer;
const seen = new Map();
function readQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter(item => item.at > Date.now() - 86400000).slice(-20); }
  catch { return []; }
}
function writeQueue(queue) { try { localStorage.setItem(KEY, JSON.stringify(queue)); return true; } catch { return false; } }

export function beginAnalysis(endpoint) {
  const id = crypto.randomUUID();
  try {
    const entries = JSON.parse(localStorage.getItem(ANALYSIS_KEY) || '{}');
    entries[id] = { session, uid: auth.currentUser?.uid, at: Date.now(), endpoint };
    localStorage.setItem(ANALYSIS_KEY, JSON.stringify(entries));
  } catch { /* Best effort. */ }
  return () => {
    try {
      const entries = JSON.parse(localStorage.getItem(ANALYSIS_KEY) || '{}');
      delete entries[id];
      localStorage.setItem(ANALYSIS_KEY, JSON.stringify(entries));
    } catch { /* Best effort. */ }
  };
}

export async function flushIncidents() {
  const user = auth.currentUser;
  if (sending || !user || navigator.onLine === false) return;
  sending = true;
  try {
    const token = await user.getIdToken();
    for (const item of readQueue().filter(item => item.uid === user.uid)) {
      if (auth.currentUser?.uid !== user.uid) break;
      const response = await fetch(`${API_BASE}/incidents`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(item.event), signal: AbortSignal.timeout(5000),
      });
      if (response.ok || [400, 413].includes(response.status)) {
        writeQueue(readQueue().filter(queued => queued.id !== item.id));
      } else break;
    }
  } catch { /* Offline reports remain queued for the next connection/start. */ }
  finally {
    sending = false;
    clearTimeout(retryTimer);
    if (readQueue().some(item => item.uid === auth.currentUser?.uid)) {
      retryTimer = setTimeout(() => { if (!document.hidden) void flushIncidents(); }, 60000);
    }
  }
}

export function reportIncident(kind, error, details = {}) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const rawCode = details.code || error?.name || 'Error';
    const code = /^(api_\d{3}|network_error|request_timeout|invalid_response|image_decode_failed|TypeError|RangeError|ReferenceError|Error)$/.test(rawCode) ? rawCode : 'Error';
    const endpoint = String(details.endpoint || '').split('?')[0];
    const key = [uid, kind, endpoint, code].join(':');
    if (Date.now() - (seen.get(key) || 0) < 300000) return true;
    if (seen.size > 100) seen.clear();
    const event = {
      kind, code, endpoint, route: window.location.pathname,
      requestId: details.requestId || '', durationMs: details.durationMs || 0,
      occurredAt: details.occurredAt || Date.now(),
      release: APP_RELEASE, platform: Capacitor.getPlatform(),
      nativeType: details.nativeType || '',
      importance: details.importance,
      memoryKb: details.memoryKb,
      visibility: document.hidden ? 'background' : 'foreground',
      online: navigator.onLine !== false,
      imageStage: details.imageStage || '',
      frames: String(details.frames || String(error?.stack || '').split('\n').slice(1).join('\n'))
        .match(/(?:[\w.-]+\.(?:js|jsx|java|kt):\d+(?::\d+)?)/g)?.slice(0, 5).join('\n') || '',
    };
    const queued = writeQueue([...readQueue(), { id: crypto.randomUUID(), uid, at: Date.now(), event }].slice(-20));
    if (queued) seen.set(key, Date.now());
    void flushIncidents();
    return queued;
  } catch { /* Reporting must never break the app. */ }
}

export function installTelemetry() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', event => { if (event.error) reportIncident('js_error', event.error); });
  window.addEventListener('unhandledrejection', event => {
    if (event.reason?.name !== 'AbortError') reportIncident('unhandled_rejection', event.reason);
  });
  window.addEventListener('online', flushIncidents);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void flushIncidents(); });
  auth.onAuthStateChanged(user => {
    if (Capacitor.getPlatform() === 'android') void (async () => {
      try {
        await NativeReliability.setUser({ uid: user?.uid || '' });
        if (!user) return;
        const crash = await NativeReliability.peekCrash({ uid: user.uid });
        if (auth.currentUser?.uid !== user.uid) return;
        if (crash.id && reportIncident('native_crash', null, { frames: crash.frames, nativeType: crash.nativeType, occurredAt: crash.at, importance:crash.importance, memoryKb:crash.memoryKb })) {
          await NativeReliability.acknowledgeCrash({ id: crash.id });
        }
      } catch { /* Older app binaries may not yet contain this native plugin. */ }
    })();
    try {
      const entries = JSON.parse(localStorage.getItem(ANALYSIS_KEY) || '{}');
      for (const [id, entry] of Object.entries(entries)) {
        if (entry.session === session) continue;
        if (entry.uid === user?.uid && Date.now() - entry.at < 86400000) {
          // Could be a process kill, manual close or OS eviction: never label
          // it a confirmed native crash.
          reportIncident('analysis_interrupted', null, { endpoint: entry.endpoint, occurredAt: entry.at });
          delete entries[id];
        } else if (Date.now() - entry.at >= 86400000) delete entries[id];
      }
      localStorage.setItem(ANALYSIS_KEY, JSON.stringify(entries));
    } catch { /* Best effort. */ }
    void flushIncidents();
  });
}
