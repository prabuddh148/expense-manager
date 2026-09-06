import axios from 'axios';

import { ApiErrorBody } from '../types/api';

export type AppError = {
  /** What to show the user. */
  message: string;
  status?: number;
  fieldErrors?: Record<string, string>;
  kind: 'network' | 'server' | 'validation' | 'auth' | 'unknown';
};

/** Turns anything thrown by axios into something a screen can render. */
export function toAppError(error: unknown): AppError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      const timedOut = error.code === 'ECONNABORTED';
      return {
        kind: 'network',
        message: timedOut
          ? 'The server is taking a while to wake up. Give it a moment and try again.'
          : 'Cannot reach the server. Check your internet connection and try again.',
      };
    }

    const status = error.response.status;
    const body = error.response.data as ApiErrorBody | undefined;
    const message = body?.message ?? 'Something went wrong. Please try again.';

    if (status === 401 || status === 403) {
      return { kind: 'auth', status, message };
    }
    if (status === 400 && body?.fieldErrors) {
      return {
        kind: 'validation',
        status,
        message: firstFieldError(body.fieldErrors) ?? message,
        fieldErrors: body.fieldErrors,
      };
    }
    if (status >= 500) {
      return {
        kind: 'server',
        status,
        message: 'The server is having trouble right now. Please try again shortly.',
      };
    }
    return { kind: 'server', status, message };
  }

  if (error instanceof Error) {
    return { kind: 'unknown', message: error.message };
  }
  return { kind: 'unknown', message: 'Something went wrong. Please try again.' };
}

function firstFieldError(fieldErrors: Record<string, string>): string | undefined {
  const [field, message] = Object.entries(fieldErrors)[0] ?? [];
  if (!field) {
    return undefined;
  }
  const label = field.replace(/([A-Z])/g, ' $1').toLowerCase();
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${message}`;
}
