import { api } from '../lib/api';

export const getActiveShift  = () => api.get('/shifts/active');
export const openShift       = (data) => api.post('/shifts/open', data);
export const closeShift      = (data) => api.post('/shifts/close', data);
