import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const path = err.config?.url || '';
    const isAuthBootstrap =
      path.endsWith('/auth/me') ||
      path.endsWith('/auth/login') ||
      path.endsWith('/auth/logout');
    if (status === 401 && !isAuthBootstrap) {
      if (!location.pathname.startsWith('/login')) {
        location.replace('/login');
      }
    }
    return Promise.reject(err);
  },
);

export function extractError(err) {
  const body = err?.response?.data?.error;
  if (body?.details?.length) {
    return body.details.map((d) => `${d.path}: ${d.message}`).join('; ');
  }
  return body?.message || err?.message || 'Request failed.';
}
