// Админка целиком на hitrac-api (/v2, JWT). Traccar-специфика (создание
// устройств, команды, статистика, отчёты) — через прокси нашего бэкенда.

const TOKEN_KEY = 'ht_token';

export async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
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
    localStorage.removeItem(TOKEN_KEY);
    throw new Error('unauthorized');
  }
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try { message = (await response.json()).message ?? message; } catch { /* not json */ }
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return response;
}

export const getJson = (path) => api(path).then((r) => r.json());

export const getSession = () => {
  if (!localStorage.getItem(TOKEN_KEY)) return Promise.reject(new Error('no token'));
  return getJson('/me');
};

export const login = async (email, password) => {
  const response = await fetch('/v2/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error('bad credentials');
  const result = await response.json();
  localStorage.setItem(TOKEN_KEY, result.accessToken);
  return result.user;
};

export const logout = () => localStorage.removeItem(TOKEN_KEY);

export const isAdmin = (user) => Boolean(user?.role?.permissions?.includes('*'));

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
