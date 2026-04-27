import axios from 'axios';

export const api = axios.create({
  // This tells Vite: "Use the live Render URL if we are on Vercel, otherwise use the local one for testing."
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', //api
  timeout: 15000,
  withCredentials: true,
});

let isRefreshing = false;
let pendingQueue = [];

function drainQueue(error) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()));
  pendingQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const path = err.config?.url || '';
    const skipRefresh =
      path.endsWith('/auth/login') ||
      path.endsWith('/auth/logout') ||
      path.endsWith('/auth/refresh');

    if (status !== 401 || skipRefresh) {
      return Promise.reject(err);
    }

    if (err.config._retry) {
      if (!location.pathname.startsWith('/login')) location.replace('/login');
      return Promise.reject(err);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => pendingQueue.push({ resolve, reject })).then(() =>
        api({ ...err.config, _retry: true }),
      );
    }

    isRefreshing = true;
    err.config._retry = true;

    try {
      await api.post('/auth/refresh');
      drainQueue(null);
      return api(err.config);
    } catch (refreshErr) {
      drainQueue(refreshErr);
      if (!location.pathname.startsWith('/login')) location.replace('/login');
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export function extractError(err) {
  const body = err?.response?.data?.error;
  if (body?.details?.length) {
    return body.details.map((d) => `${d.path}: ${d.message}`).join('; ');
  }
  return body?.message || err?.message || 'Request failed.';
}
