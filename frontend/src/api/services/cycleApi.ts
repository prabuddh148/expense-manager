import { apiClient } from '../client';
import { Cycle, CycleResetPayload } from '../../types/api';

export const cycleApi = {
  get: () => apiClient.get<Cycle>('/cycle').then((r) => r.data),

  /** Overrides the target until the next reset or category budget change. */
  setTarget: (amount: number) =>
    apiClient.put<Cycle>('/cycle/target', { amount }).then((r) => r.data),

  /** Salary day: a new cycle from startDate with fresh category budgets. */
  reset: (payload: CycleResetPayload) =>
    apiClient.post<Cycle>('/cycle/reset', payload).then((r) => r.data),
};
