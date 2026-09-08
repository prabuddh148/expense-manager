import { apiClient } from '../client';
import {
  MoneyTrackerPayload,
  MoneyTrackerStatus,
  MoneyTrackerSummary,
  MoneyTrackerTransaction,
} from '../../types/api';

export const moneyTrackerApi = {
  list: (status?: MoneyTrackerStatus) =>
    apiClient
      .get<MoneyTrackerTransaction[]>('/money-tracker', { params: { status } })
      .then((r) => r.data),

  summary: () =>
    apiClient.get<MoneyTrackerSummary>('/money-tracker/summary').then((r) => r.data),

  get: (id: number) =>
    apiClient.get<MoneyTrackerTransaction>(`/money-tracker/${id}`).then((r) => r.data),

  create: (payload: MoneyTrackerPayload) =>
    apiClient.post<MoneyTrackerTransaction>('/money-tracker', payload).then((r) => r.data),

  update: (id: number, payload: MoneyTrackerPayload) =>
    apiClient.put<MoneyTrackerTransaction>(`/money-tracker/${id}`, payload).then((r) => r.data),

  remove: (id: number) => apiClient.delete(`/money-tracker/${id}`).then(() => undefined),

  /** Records that the money actually moved. Does not touch the salary. */
  complete: (id: number, completed = true) =>
    apiClient
      .post<MoneyTrackerTransaction>(`/money-tracker/${id}/complete`, null, {
        params: { completed },
      })
      .then((r) => r.data),

  /** Pay -> creates a labelled expense, which is what reduces the salary. */
  deduct: (id: number, categoryId?: number | null) =>
    apiClient
      .post<MoneyTrackerTransaction>(`/money-tracker/${id}/deduct`, {
        categoryId: categoryId ?? null,
      })
      .then((r) => r.data),

  /** Receive -> credits the month on top of the stated salary. */
  addOn: (id: number) =>
    apiClient.post<MoneyTrackerTransaction>(`/money-tracker/${id}/add-on`).then((r) => r.data),

  /** Reverses whichever happened and returns the transaction to the list. */
  undo: (id: number) =>
    apiClient.post<MoneyTrackerTransaction>(`/money-tracker/${id}/undo`).then((r) => r.data),
};
