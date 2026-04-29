import { api } from '../lib/api';

export const listServices      = (params) => api.get('/services', { params });
export const createService     = (data)   => api.post('/services', data);
export const updateService     = (id, data) => api.patch(`/services/${id}`, data);
export const deactivateService = (id)     => api.patch(`/services/${id}/deactivate`);
export const activateService   = (id)     => api.patch(`/services/${id}/activate`);
