import { Capacitor } from '@capacitor/core';

const TOKEN_STORAGE_KEY = 'kphube_auth_token';

// Default hosted KP HUBE backend URL when running as a standalone Android APK
const DEFAULT_NATIVE_API_BASE_URL =
  'https://ais-pre-ladn4u6ehmgdtu4mur2nta-37682163655.asia-northeast1.run.app';

export function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, '');
  if (Capacitor.isNativePlatform()) {
    return configured || DEFAULT_NATIVE_API_BASE_URL;
  }
  if (configured && /^https?:\/\//i.test(configured)) {
    if (typeof window !== 'undefined' && window.location.origin === configured) {
      return '';
    }
    return configured;
  }
  return '';
}

export function resolveApiUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('upi:')) {
    return path;
  }
  const base = getApiBaseUrl();
  if (!base) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(resolveApiUrl(path), {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
