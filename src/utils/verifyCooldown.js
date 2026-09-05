// Persists the 2-minute "send again" cooldown for verification emails so
// that closing/reopening the modal doesn't reset the timer, and so the
// auto-send that fires on registration counts toward the same window.

const COOLDOWN_MS = 2 * 60 * 1000;
const key = (uid) => `cs_resend_cooldown_${uid}`;

export function startResendCooldown(uid) {
  if (!uid) return;
  localStorage.setItem(key(uid), String(Date.now() + COOLDOWN_MS));
}

export function getResendSecondsLeft(uid) {
  if (!uid) return 0;
  const end = parseInt(localStorage.getItem(key(uid)) || "0", 10);
  if (!end) return 0;
  const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
  if (left === 0) localStorage.removeItem(key(uid));
  return left;
}

export function formatMMSS(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
