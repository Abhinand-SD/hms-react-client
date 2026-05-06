import { api } from '../lib/api';

export const getCollectionsReport = (params) =>
  api.get('/reports/collections', { params });

export const getDailyCollectionReport = (params) =>
  api.get('/reports/daily-collection', { params });
