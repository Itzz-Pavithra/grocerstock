import { auth } from './auth.svelte.js';

/**
 * Determine the API Base URL dynamically:
 * 1. Checks VITE_API_BASE_URL or legacy VITE_API_URL
 * 2. In production, defaults to relative '/api' on the same domain (Vercel serverless / proxy)
 * 3. In local development, defaults to 'http://localhost:5000/api'
 */
function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // In production, fallback to relative '/api' so it works out-of-the-box on Vercel / single-domain deployments
  if (import.meta.env.PROD) {
    return '/api';
  }

  // Local development fallback
  return 'http://localhost:5000/api';
}

const BASE_URL = getApiBaseUrl();

/**
 * Normalizes request path ensuring no double slashes or duplicate '/api' prefixes
 */
function normalizePath(baseUrl, path) {
  let cleanPath = (path || '').trim();
  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }

  // If BASE_URL already ends with '/api' and path begins with '/api/', remove duplicate
  if (baseUrl.endsWith('/api') && cleanPath.startsWith('/api/')) {
    cleanPath = cleanPath.slice(4);
  }

  return `${baseUrl}${cleanPath}`;
}

async function request(method, path, body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const fullUrl = normalizePath(BASE_URL, path);
  let response;

  try {
    response = await fetch(fullUrl, config);
  } catch (netErr) {
    console.error(`API Fetch Network Error for [${method} ${fullUrl}]:`, netErr);
    if (import.meta.env.PROD && BASE_URL === '/api') {
      throw new Error(`Unable to connect to API service at ${fullUrl}. Please verify VITE_API_BASE_URL is configured in your deployment settings.`);
    }
    throw new Error(`Unable to connect to backend server at ${BASE_URL}. Please verify the backend service is running.`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `HTTP Request Failed: status ${response.status}`);
  }

  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  getBaseUrl: () => BASE_URL,
};

