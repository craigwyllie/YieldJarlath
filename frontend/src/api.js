const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const TOKEN_KEY = 'giltAuthToken';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(username, password) {
  const token = btoa(`${username}:${password}`);
  const response = await fetch(`${API_BASE}/gilts?taxRate=0`, {
    headers: { Authorization: `Basic ${token}` },
  });

  if (!response.ok) {
    throw new Error('Invalid credentials');
  }

  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export async function fetchGilts(params, token) {
  const search = new URLSearchParams();
  if (params?.taxRate !== undefined) search.set('taxRate', params.taxRate);
  if (params?.couponMin !== undefined && params.couponMin !== '') search.set('couponMin', params.couponMin);
  if (params?.couponMax !== undefined && params.couponMax !== '') search.set('couponMax', params.couponMax);
  if (params?.maturityFrom) search.set('maturityFrom', params.maturityFrom);
  if (params?.maturityTo) search.set('maturityTo', params.maturityTo);

  const response = await fetch(`${API_BASE}/gilts?${search.toString()}`, {
    headers: { Authorization: `Basic ${token}` },
  });

  if (response.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error('Failed to fetch gilts');
  }

  return response.json();
}

export const TAX_RATES = [
  { label: '0%', value: 0 },
  { label: '20%', value: 0.2 },
  { label: '40%', value: 0.4 },
  { label: '45%', value: 0.45 },
];
