import { api } from '../lib/api';

export const searchPatients = (params) => api.get('/patients', { params });
export const createPatient = (data) => api.post('/patients', data);
export const getPatientById = (id) => api.get(`/patients/${id}`);
export const getPatientByUhid = (uhid) => api.get(`/patients/uhid/${uhid}`);
export const updatePatient = (id, data) => api.patch(`/patients/${id}`, data);
export const checkDuplicates = (params) => api.get('/patients/check-duplicates', { params });
export const getPatientVisits = (id, params) => api.get(`/patients/${id}/visits`, { params });
