import { apiClient } from '../client';
import { Salary, SalaryPayload } from '../../types/api';

export const salaryApi = {
  get: (year?: number, month?: number) =>
    apiClient.get<Salary>('/salary', { params: { year, month } }).then((r) => r.data),

  history: () => apiClient.get<Salary[]>('/salary/history').then((r) => r.data),

  save: (payload: SalaryPayload) =>
    apiClient.post<Salary>('/salary', payload).then((r) => r.data),

  update: (id: number, payload: SalaryPayload) =>
    apiClient.put<Salary>(`/salary/${id}`, payload).then((r) => r.data),
};
