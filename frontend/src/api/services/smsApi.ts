import { apiClient } from '../client';
import {
  SmsBankSummary,
  SmsImportResult,
  SmsTransaction,
  SmsTransactionPayload,
  SmsTransactionStatus,
  SmsTransactionType,
} from '../../types/api';

type ListQuery = {
  bank?: string;
  status?: SmsTransactionStatus;
  type?: SmsTransactionType;
};

export const smsApi = {
  list: (query: ListQuery = {}) =>
    apiClient.get<SmsTransaction[]>('/sms-transactions', { params: query }).then((r) => r.data),

  /** Built from banks actually detected, never a fixed list. */
  banks: () =>
    apiClient.get<SmsBankSummary[]>('/sms-transactions/banks').then((r) => r.data),

  pendingCount: () =>
    apiClient
      .get<{ pending: number }>('/sms-transactions/pending-count')
      .then((r) => r.data.pending),

  /** Already-seen messages come back in `skipped` rather than failing the batch. */
  import: (transactions: SmsTransactionPayload[]) =>
    apiClient
      .post<SmsImportResult>('/sms-transactions/import', transactions)
      .then((r) => r.data),

  categorise: (id: number, categoryId: number) =>
    apiClient
      .put<SmsTransaction>(`/sms-transactions/${id}/category`, { categoryId })
      .then((r) => r.data),

  addToExpense: (id: number) =>
    apiClient.post<SmsTransaction>(`/sms-transactions/${id}/add-to-expense`).then((r) => r.data),

  ignore: (id: number) =>
    apiClient.post<SmsTransaction>(`/sms-transactions//ignore`).then((r) => r.data),

  /** Forgets the record entirely, so a later rescan can pick the message up again. */
  remove: (id: number) =>
    apiClient.delete(`/sms-transactions/`).then(() => undefined),

  /** Clears every detection that has not become an expense. */
  clearPending: () =>
    apiClient.delete<{ deleted: number }>('/sms-transactions').then((r) => r.data.deleted),
};
