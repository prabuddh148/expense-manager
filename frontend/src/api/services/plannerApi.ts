import { apiClient } from '../client';
import { SalaryPlanner, SalaryPlannerItemPayload, SalaryPlannerPayload } from '../../types/api';

export const plannerApi = {
  list: () => apiClient.get<SalaryPlanner[]>('/salary-planner').then((r) => r.data),

  get: (id: number) => apiClient.get<SalaryPlanner>(`/salary-planner/${id}`).then((r) => r.data),

  create: (payload: SalaryPlannerPayload) =>
    apiClient.post<SalaryPlanner>('/salary-planner', payload).then((r) => r.data),

  update: (id: number, payload: SalaryPlannerPayload) =>
    apiClient.put<SalaryPlanner>(`/salary-planner/${id}`, payload).then((r) => r.data),

  remove: (id: number) => apiClient.delete(`/salary-planner/${id}`).then(() => undefined),

  addItem: (id: number, payload: SalaryPlannerItemPayload) =>
    apiClient.post<SalaryPlanner>(`/salary-planner/${id}/items`, payload).then((r) => r.data),

  updateItem: (id: number, itemId: number, payload: SalaryPlannerItemPayload) =>
    apiClient
      .put<SalaryPlanner>(`/salary-planner/${id}/items/${itemId}`, payload)
      .then((r) => r.data),

  removeItem: (id: number, itemId: number) =>
    apiClient.delete<SalaryPlanner>(`/salary-planner/${id}/items/${itemId}`).then((r) => r.data),
};
