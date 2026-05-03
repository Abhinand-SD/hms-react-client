import { api } from '../lib/api';

// Phase 1 — creates a CONSULTATION invoice (doctor fee only)
export const createConsultationInvoice = (visitId, isFollowUp = false) =>
  api.post('/invoices/consultation', { visitId, isFollowUp });

// Phase 2 — creates a SERVICES invoice (selected tests only)
export const createServicesInvoice = (visitId, selectedServiceIds) =>
  api.post('/invoices/services', { visitId, selectedServiceIds });

// Legacy helpers kept for backward compat
export const generateInvoiceFromVisit = (visitId) =>
  api.post(`/invoices/generate-from-visit/${visitId}`);

export const checkoutVisit = (visitId, selectedServiceIds = []) =>
  api.post('/invoices/checkout-visit', { visitId, selectedServiceIds });

// External diagnostic billing — creates/re-uses patient and SERVICES invoice in one call
export const createExternalServicesInvoice = (patientData, selectedServiceIds) =>
  api.post('/invoices/external-services', { patientData, selectedServiceIds });

export const refundInvoice = (id, refundReason) =>
  api.post(`/invoices/${id}/refund`, { refundReason });

export const getInvoiceById = (id) => api.get(`/invoices/${id}`);

export const listInvoices = (params) => api.get('/invoices', { params });

export const recordPayment = (data) => api.post('/payments', data);
