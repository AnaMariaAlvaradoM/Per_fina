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
  login:    (body) => req('POST', '/auth/login', body),
  me:       ()     => req('GET',  '/auth/me'),

  // Accounts
  getAccounts:    ()         => req('GET',    '/accounts'),
  createAccount:  (body)     => req('POST',   '/accounts', body),
  updateAccount:  (id, body) => req('PUT',    `/accounts/${id}`, body),
  deleteAccount:  (id)       => req('DELETE', `/accounts/${id}`),

  // Transactions
  getTransactions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req('GET', `/transactions${q ? `?${q}` : ''}`);
  },
  getSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req('GET', `/transactions/summary${q ? `?${q}` : ''}`);
  },
  createTransaction: (body)     => req('POST',   '/transactions', body),
  updateTransaction: (id, body) => req('PUT',    `/transactions/${id}`, body),
  deleteTransaction: (id)       => req('DELETE', `/transactions/${id}`),

  // Debts
  getDebts:    ()         => req('GET', '/debts'),
  createDebt:  (body)     => req('POST', '/debts', body),
  updateDebt:  (id, body) => req('PUT',  `/debts/${id}`, body),

  // Categories
  getCategories:  ()     => req('GET',  '/categories'),
  createCategory: (body) => req('POST', '/categories', body),


  getFixed:       ()         => req('GET',    '/fixed-expenses'),
createFixed:    (body)     => req('POST',   '/fixed-expenses', body),
updateFixed:    (id, body) => req('PUT',    `/fixed-expenses/${id}`, body),
deleteFixed:    (id)       => req('DELETE', `/fixed-expenses/${id}`),
registerFixed:  (id, body) => req('POST',   `/fixed-expenses/${id}/register`, body),
};