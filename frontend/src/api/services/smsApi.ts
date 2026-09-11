import { apiClient } from '../client';
import {
  SmsBankSummary,
  SmsImportResult,
  SmsTransaction,
  SmsTransactionPayload,
  SmsTransactionStatus,
  SmsTransactionType,
} from '../../types/api';

/** Inclusive transaction dates, yyyy-MM-dd. Either end may be left open. */
type DateRange = {
  from?: string;
  to?: string;
};

type ListQuery = DateRange & {
  bank?: string;
  status?: SmsTransactionStatus;
  type?: SmsTransactionType;
};

export const smsApi = {
  list: (query: ListQuery = {}) =>
    apiClient.get<SmsTransaction[]>('/sms-transactions', { params: query }).then((r) => r.data),

  /** Built from banks actually detected, never a fixed list, counted within the range. */
  banks: (range: DateRange = {}) =>
    apiClient
      .get<SmsBankSummary[]>('/sms-transactions/banks', { params: range })
      .then((r) => r.data),

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
    apiClient.post<SmsTransaction>(`/sms-transactions/${id}/ignore`).then((r) => r.data),

  /** Forgets the record entirely, so a later rescan can pick the message up again. */
  remove: (id: number) =>
    apiClient.delete(`/sms-transactions/${id}`).then(() => undefined),

  /** Clears every detection that has not become an expense. */
  clearPending: () =>
    apiClient.delete<{ deleted: number }>('/sms-transactions').then((r) => r.data.deleted),
};
