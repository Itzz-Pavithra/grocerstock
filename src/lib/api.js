import { auth } from './auth.svelte.js';

/**
 * Resolves the API Base URL dynamically:
 * - Reads VITE_API_BASE_URL or VITE_API_URL
 * - Strips any trailing slashes
 * - In production, defaults to relative '/api' on the same domain (Vercel serverless / proxy)
 * - In local development, defaults to 'http://localhost:5000/api'
 */
export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (import.meta.env.PROD) {
    return '/api';
  }

  return 'http://localhost:5000/api';
}

/**
 * Normalizes request path ensuring no duplicate '/api' or missing leading slashes
 */
export function normalizePath(baseUrl, path) {
  const base = (baseUrl || '').trim().replace(/\/+$/, '');
  let cleanPath = (path || '').trim();

  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }

  // Prevent duplicate '/api' segment if baseUrl ends with '/api' and path begins with '/api/'
  if (base.endsWith('/api') && (cleanPath === '/api' || cleanPath.startsWith('/api/'))) {
    cleanPath = cleanPath.slice(4);
    if (!cleanPath.startsWith('/')) {
      cleanPath = `/${cleanPath}`;
    }
  }

  return `${base}${cleanPath}`;
}

async function request(method, path, body = null) {
  const baseUrl = getApiBaseUrl();
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

  if (body !== null && body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const fullUrl = normalizePath(baseUrl, path);
  let response;

  try {
    response = await fetch(fullUrl, config);
  } catch (netErr) {
    console.error(`API Fetch Network Error for [${method} ${fullUrl}]:`, netErr);
    const hasConfiguredBase = Boolean(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL);

    if (import.meta.env.PROD) {
      if (!hasConfiguredBase && baseUrl === '/api') {
        throw new Error(
          `Unable to connect to API service at ${fullUrl}. VITE_API_BASE_URL is not configured in your deployment settings.`
        );
      }
      throw new Error(
        `Unable to reach backend API at ${baseUrl}. Please check that the server is active and CORS is configured.`
      );
    }

    throw new Error(
      `Unable to connect to backend server at ${baseUrl}. Please verify the backend service is running locally.`
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // If token expired or unauthorized, trigger session reset on client
    if (response.status === 401 && auth.token && !path.includes('/auth/login') && !path.includes('/auth/register')) {
      auth.clearSession();
    }
    throw new Error(data.message || `HTTP Request Failed: status ${response.status}`);
  }

  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  getBaseUrl: () => getApiBaseUrl(),
};


