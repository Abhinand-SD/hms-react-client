import { api } from '../lib/api';

export const generateInvoiceFromVisit = (visitId) =>
  api.post(`/invoices/generate-from-visit/${visitId}`);

export const getInvoiceById = (id) => api.get(`/invoices/${id}`);

export const listInvoices = (params) => api.get('/invoices', { params });

export const recordPayment = (data) => api.post('/payments', data);
