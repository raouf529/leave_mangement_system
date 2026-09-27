import axios from 'axios';

// Base URL comes from an env var; falls back to the Nginx API proxy in the container.
const BASE_URL = import.meta.env?.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // httpOnly cookies only — no tokens in JS
  timeout: 15000,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

// ─── Silent token refresh ─────────────────────────────────────────────────────
// When the access token expires the server returns 401.  Instead of immediately
// kicking the user out we attempt one silent refresh (POST /auth/refresh).  The
// refresh cookie is httpOnly and scoped to that path, so the browser sends it
// automatically — no JS token handling needed.
//
// "Thundering herd" guard: if many requests fail with 401 at the same time we
// only fire one refresh call.  All waiting callers share the same promise and
// retry once it resolves.

let isRefreshing = false;
let pendingQueue = []; // [{resolve, reject}]

function processQueue(error) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
  pendingQueue = [];
}

function redirectToLogin() {
  sessionStorage.removeItem('role');
  if (typeof window !== 'undefined' && window.location.pathname !== '/') {
    window.location.replace('/');
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only intercept 401s that haven't already been retried and are not the
    // refresh call itself (to avoid an infinite loop).
    const is401 = error.response?.status === 401;
    const isRetry = originalRequest?._retry;
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');
    const skip = originalRequest?.skipAuthRedirect;

    if (!is401 || isRetry || isRefreshCall || skip) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another request is already refreshing — queue up and wait for it.
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then(() => {
        originalRequest._retry = true;
        return api(originalRequest);
      }).catch((err) => Promise.reject(err));
    }

    // First 401 to arrive: kick off the refresh.
    isRefreshing = true;
    originalRequest._retry = true;

    try {
      // POST /auth/refresh — browser sends the httpOnly refreshToken cookie
      // automatically because it is scoped to this path.
      await axios.post(
        `${BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      // Refresh succeeded: wake up all waiting callers.
      processQueue(null);

      // Retry the original request with the new access-token cookie.
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed (cookie expired / revoked): send everyone to login.
      processQueue(refreshError);
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;