import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { AppError, toAppError } from '../api';

type Options<T> = {
  /** When set, the last successful payload is cached and shown while offline. */
  cacheKey?: string;
  /** Skip the request entirely, e.g. while a screen has no id yet. */
  enabled?: boolean;
  onSuccess?: (data: T) => void;
};

type State<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: AppError | null;
  /** True when what is on screen came from the cache rather than the network. */
  fromCache: boolean;
};

const CACHE_PREFIX = 'expense-manager/cache/';

/**
 * One fetch-with-states hook for every read screen: initial load, pull-to-refresh,
 * error state, and an optional cached copy so the dashboard still renders offline.
 * The cache is display-only - the backend stays the source of truth.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[], options: Options<T> = {}) {
  const { cacheKey, enabled = true, onSuccess } = options;

  const [state, setState] = useState<State<T>>({
    data: null,
    loading: enabled,
    refreshing: false,
    error: null,
    fromCache: false,
  });

  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!enabled) {
        setState((current) => ({ ...current, loading: false }));
        return;
      }
      setState((current) => ({
        ...current,
        loading: mode === 'initial' && current.data === null,
        refreshing: mode === 'refresh',
        error: mode === 'refresh' ? current.error : null,
      }));

      try {
        const data = await fetcherRef.current();
        if (!mounted.current) return;
        setState({ data, loading: false, refreshing: false, error: null, fromCache: false });
        onSuccessRef.current?.(data);
        if (cacheKey) {
          AsyncStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(data)).catch(() => {});
        }
      } catch (error) {
        if (!mounted.current) return;
        const appError = toAppError(error);

        // Falling back to cache only makes sense when the network is the problem.
        if (cacheKey && appError.kind === 'network') {
          const cached = await AsyncStorage.getItem(CACHE_PREFIX + cacheKey).catch(() => null);
          if (cached && mounted.current) {
            setState({
              data: JSON.parse(cached) as T,
              loading: false,
              refreshing: false,
              error: appError,
              fromCache: true,
            });
            return;
          }
        }
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          error: appError,
        }));
      }
    },
    [cacheKey, enabled],
  );

  useEffect(() => {
    void run('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  /**
   * The tab bar is a pager, so every tab screen stays mounted once visited and the
   * effect above never runs again. Without this, adding an expense and swiping back to
   * the dashboard would show the figures from whenever the tab first loaded.
   *
   * Refetches quietly on every focus after the first, keeping the current data on
   * screen instead of flashing a spinner.
   */
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (enabled) {
        void run('refresh');
      }
    }, [enabled, run]),
  );

  return {
    ...state,
    reload: useCallback(() => run('initial'), [run]),
    refresh: useCallback(() => run('refresh'), [run]),
    setData: useCallback((data: T) => setState((current) => ({ ...current, data })), []),
  };
}

export async function clearDataCache() {
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  const ours = keys.filter((key) => key.startsWith(CACHE_PREFIX));
  if (ours.length) {
    await AsyncStorage.multiRemove(ours).catch(() => {});
  }
}
