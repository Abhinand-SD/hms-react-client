import { api } from '../lib/api';

export const getCollectionsReport = (params) =>
  api.get('/reports/collections', { params });
