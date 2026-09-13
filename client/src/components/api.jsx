import axios from 'axios';

// Base URL now comes from an env var instead of being hardcoded in every
// file. Falls back to localhost for local dev only.
const BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // httpOnly cookies only — no tokens in JS
  timeout: 15000,
  // If the backend sets a readable "XSRF-TOKEN" cookie (double-submit
  // pattern), axios will automatically echo it back as this header on
  // every request. Cookie-based sessions are vulnerable to CSRF unless
  // something like this is in place — this just wires the frontend half
  // of it up. No-op if the backend doesn't set that cookie.
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN'
});

// Central handling for an expired/invalid session, instead of every
// component guessing at what a failed request means.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // sessionStorage role is a UI convenience only — the server is the
      // real authority on role/permissions. Clear it on auth failure so
      // stale UI never implies access that no longer holds.
      sessionStorage.removeItem('role');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;