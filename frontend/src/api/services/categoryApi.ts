import { apiClient } from '../client';
import { Category, CategoryPayload } from '../../types/api';

export const categoryApi = {
  list: (year?: number, month?: number) =>
    apiClient.get<Category[]>('/categories', { params: { year, month } }).then((r) => r.data),

  get: (id: number) => apiClient.get<Category>(`/categories/${id}`).then((r) => r.data),

  create: (payload: CategoryPayload) =>
    apiClient.post<Category>('/categories', payload).then((r) => r.data),

  update: (id: number, payload: CategoryPayload) =>
    apiClient.put<Category>(`/categories/${id}`, payload).then((r) => r.data),

  remove: (id: number) => apiClient.delete(`/categories/${id}`).then(() => undefined),
};
