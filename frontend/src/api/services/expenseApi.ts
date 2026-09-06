import { apiClient } from '../client';
import { Expense, ExpensePayload, ExpenseQuery, Page } from '../../types/api';

export const expenseApi = {
  list: (query: ExpenseQuery = {}) =>
    apiClient
      .get<Page<Expense>>('/expenses', {
        params: {
          search: query.search || undefined,
          categoryId: query.categoryId ?? undefined,
          from: query.from,
          to: query.to,
          minAmount: query.minAmount,
          maxAmount: query.maxAmount,
          page: query.page ?? 0,
          size: query.size ?? 20,
          sortBy: query.sortBy ?? 'date',
          direction: query.direction ?? 'desc',
        },
      })
      .then((r) => r.data),

  get: (id: number) => apiClient.get<Expense>(`/expenses/${id}`).then((r) => r.data),

  create: (payload: ExpensePayload) =>
    apiClient.post<Expense>('/expenses', payload).then((r) => r.data),

  update: (id: number, payload: ExpensePayload) =>
    apiClient.put<Expense>(`/expenses/${id}`, payload).then((r) => r.data),

  remove: (id: number) => apiClient.delete(`/expenses/${id}`).then(() => undefined),
};
