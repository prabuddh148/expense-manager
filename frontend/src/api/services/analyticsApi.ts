import { apiClient } from '../client';
import { Analytics, AnalyticsPeriod, CategorySpend, Dashboard } from '../../types/api';

export const analyticsApi = {
  forPeriod: (period: AnalyticsPeriod, from?: string, to?: string) =>
    apiClient.get<Analytics>('/analytics', { params: { period, from, to } }).then((r) => r.data),

  weekly: (period: 'this_week' | 'last_week' = 'this_week') =>
    apiClient.get<Analytics>('/analytics/weekly', { params: { period } }).then((r) => r.data),

  monthly: (period: 'this_month' | 'last_month' = 'this_month') =>
    apiClient.get<Analytics>('/analytics/monthly', { params: { period } }).then((r) => r.data),

  categories: (period: AnalyticsPeriod, from?: string, to?: string) =>
    apiClient
      .get<CategorySpend[]>('/analytics/category', { params: { period, from, to } })
      .then((r) => r.data),
};

export const dashboardApi = {
  get: (year?: number, month?: number) =>
    apiClient.get<Dashboard>('/dashboard', { params: { year, month } }).then((r) => r.data),
};
