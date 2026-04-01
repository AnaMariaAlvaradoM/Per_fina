const BASE = import.meta.env.VITE_API_URL || '/api';

const getToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
});

const req = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
};

export const api = {
  // Auth
  register: (body) => req('POST', '/auth/register', body),
  login: (body) => req('POST', '/auth/login', body),
  me: () => req('GET', '/auth/me'),
  joinHousehold: (code) => req('POST', '/auth/join-household', { invite_code: code }),

  // Accounts
  getAccounts: (household_id) => req('GET', `/accounts${household_id ? `?household_id=${household_id}` : ''}`),
  createAccount: (body) => req('POST', '/accounts', body),
  updateAccount: (id, body) => req('PUT', `/accounts/${id}`, body),
  deleteAccount: (id) => req('DELETE', `/accounts/${id}`),

  // Transactions
  getTransactions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req('GET', `/transactions${q ? `?${q}` : ''}`);
  },
  getSharedTransactions: (household_id) => req('GET', `/transactions/shared?household_id=${household_id}`),
  getSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req('GET', `/transactions/summary${q ? `?${q}` : ''}`);
  },
  createTransaction: (body) => req('POST', '/transactions', body),
  deleteTransaction: (id) => req('DELETE', `/transactions/${id}`),

  // Debts
  getDebts: (household_id) => req('GET', `/debts${household_id ? `?household_id=${household_id}` : ''}`),
  createDebt: (body) => req('POST', '/debts', body),
  updateDebt: (id, body) => req('PUT', `/debts/${id}`, body),

  // Categories
  getCategories: () => req('GET', '/categories'),
  createCategory: (body) => req('POST', '/categories', body),

};