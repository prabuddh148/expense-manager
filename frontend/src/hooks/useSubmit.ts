import { useCallback, useRef, useState } from 'react';

import { AppError, toAppError } from '../api';

/**
 * Wraps a write call: tracks the pending flag, surfaces field errors from bean validation
 * and guards against a double tap firing the request twice.
 */
export function useSubmit<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const inFlight = useRef(false);

  const submit = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      if (inFlight.current) {
        return null;
      }
      inFlight.current = true;
      setSubmitting(true);
      setError(null);
      try {
        return await action(...args);
      } catch (caught) {
        setError(toAppError(caught));
        return null;
      } finally {
        inFlight.current = false;
        setSubmitting(false);
      }
    },
    [action],
  );

  return {
    submit,
    submitting,
    error,
    fieldErrors: error?.fieldErrors ?? {},
    clearError: useCallback(() => setError(null), []),
  };
}
