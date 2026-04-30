import { api } from '../lib/api';

export const getReceptionistDashboard = () => api.get('/dashboard/receptionist');
export const getAdminDashboard        = () => api.get('/dashboard/admin');
