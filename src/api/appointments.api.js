import { api } from '../lib/api';

export const getDailySchedule  = (params)     => api.get('/appointments/daily', { params });
export const listAppointments  = (params)     => api.get('/appointments', { params });
export const bookAppointment   = (data)       => api.post('/appointments', data);
export const getAppointmentById = (id)        => api.get(`/appointments/${id}`);
export const updateStatus      = (id, data)   => api.patch(`/appointments/${id}/status`, data);
export const reschedule        = (id, data)   => api.patch(`/appointments/${id}/reschedule`, data);
export const cancelAppointment = (id, data)   => api.patch(`/appointments/${id}/cancel`, data);
