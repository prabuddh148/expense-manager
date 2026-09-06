import { apiClient } from '../client';
import { EmiPayment, EmiPaymentPayload, Loan, LoanPayload } from '../../types/api';

export const loanApi = {
  list: () => apiClient.get<Loan[]>('/loans').then((r) => r.data),

  get: (id: number) => apiClient.get<Loan>(`/loans/${id}`).then((r) => r.data),

  create: (payload: LoanPayload) => apiClient.post<Loan>('/loans', payload).then((r) => r.data),

  update: (id: number, payload: LoanPayload) =>
    apiClient.put<Loan>(`/loans/${id}`, payload).then((r) => r.data),

  remove: (id: number) => apiClient.delete(`/loans/${id}`).then(() => undefined),

  payments: (loanId: number) =>
    apiClient.get<EmiPayment[]>(`/loans/${loanId}/payments`).then((r) => r.data),

  addPayment: (loanId: number, payload: EmiPaymentPayload) =>
    apiClient.post<EmiPayment>(`/loans/${loanId}/payments`, payload).then((r) => r.data),

  updatePayment: (loanId: number, paymentId: number, payload: EmiPaymentPayload) =>
    apiClient
      .put<EmiPayment>(`/loans/${loanId}/payments/${paymentId}`, payload)
      .then((r) => r.data),

  removePayment: (loanId: number, paymentId: number) =>
    apiClient.delete(`/loans/${loanId}/payments/${paymentId}`).then(() => undefined),
};
