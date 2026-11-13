import API_BASE_URL from '../config/api';

export async function localRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal: AbortSignal.timeout(15000), ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(data?.error || 'Unable to connect to the local app. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}

let currentUser = null;
const listeners = new Set();
const updateUser = user => { currentUser = user; listeners.forEach(listener => listener(user)); };
export const getCurrentUser = () => currentUser;
export function subscribeAuth(listener) {
  listeners.add(listener);
  listener(currentUser);
  return () => listeners.delete(listener);
}
export async function loadSession() {
  const data = await localRequest('/api/auth/session');
  updateUser(data.user);
}
export async function authenticate(action, credentials) {
  const data = await localRequest(`/api/auth/${action}`, { method: 'POST', body: JSON.stringify(credentials) });
  updateUser(data.user);
}
export async function logout() {
  await localRequest('/api/auth/logout', { method: 'POST', body: '{}' });
  updateUser(null);
}
export const loadHistory = () => localRequest('/api/history');
export const saveHistory = (conversations, revision) => localRequest('/api/history', {
  method: 'PUT', body: JSON.stringify({ conversations, revision }),
});
