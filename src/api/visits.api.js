import { api } from '../lib/api';

export const getLiveQueue      = (params)    => api.get('/visits/queue', { params });
export const listVisits        = (params)    => api.get('/visits', { params });
export const registerVisit     = (data)      => api.post('/visits', data);
export const getVisitById      = (id)        => api.get(`/visits/${id}`);
export const updateQueueStatus = (id, data)  => api.patch(`/visits/${id}/status`, data);
export const updateVitals      = (id, data)  => api.patch(`/visits/${id}/vitals`, data);
