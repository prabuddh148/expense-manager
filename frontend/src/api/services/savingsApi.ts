import { apiClient } from '../client';
import { SavingsEntry, SavingsPayload, SavingsSummary } from '../../types/api';

export const savingsApi = {
  list: () => apiClient.get<SavingsEntry[]>('/savings').then((r) => r.data),

  /** Totals for the profile card, including the split by method. */
  summary: () => apiClient.get<SavingsSummary>('/savings/summary').then((r) => r.data),

  create: (payload: SavingsPayload) =>
    apiClient.post<SavingsEntry>('/savings', payload).then((r) => r.data),

  update: (id: number, payload: SavingsPayload) =>
    apiClient.put<SavingsEntry>(`/savings/${id}`, payload).then((r) => r.data),

  remove: (id: number) => apiClient.delete(`/savings/${id}`).then(() => undefined),
};
