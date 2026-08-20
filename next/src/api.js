// Обёртки над Traccar API (/api, сессионная кука) и hitrac-api (/v2, JWT)

export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.split('\n')[0] || `HTTP ${response.status}`);
  }
  return response;
}

export const getJson = (path) => api(path, { headers: { Accept: 'application/json' } }).then((r) => r.json());

export const getSession = () => getJson('/session');

export const login = (email, password) =>
  api('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password }),
  }).then((r) => r.json());

// ── hitrac-api (/v2): свои пользователи и роли, вход по JWT ──

export async function v2(path, options = {}) {
  const token = localStorage.getItem('v2token');
  const response = await fetch(`/v2${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    localStorage.removeItem('v2token');
    throw new Error('unauthorized');
  }
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try { message = (await response.json()).message ?? message; } catch { /* not json */ }
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return response.json();
}

export const v2Login = async (email, password) => {
  const result = await v2('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem('v2token', result.accessToken);
  return result.user;
};

export const hasV2Token = () => Boolean(localStorage.getItem('v2token'));

// ── производные значения ──

export const KNOTS_TO_KMH = 1.852;

export function deviceState(device) {
  if (device.status === 'online') return { label: 'На связи', tagClass: 'tag tag-accent' };
  if (!device.lastUpdate) return { label: 'На складе', tagClass: 'tag tag-accent-2' };
  return { label: 'Офлайн', tagClass: 'tag tag-neutral' };
}

export function relativeTime(value) {
  if (!value) return '—';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return `${seconds} сек назад`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин назад`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} ч назад`;
  return `${Math.round(seconds / 86400)} дн назад`;
}

export function formatTime(value) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export const fmt = (n) => Number(n).toLocaleString('ru-RU');
