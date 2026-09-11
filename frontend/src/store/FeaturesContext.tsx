import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { setHiddenFeatures } from '../api';
import { clearDataCache } from '../hooks/useAsyncData';

/** Sections that can be switched off. Home and Profile always stay - Settings lives there. */
export type FeatureKey =
  | 'expenses'
  | 'emi'
  | 'moneyTracker'
  | 'sms'
  | 'analytics'
  | 'savings'
  | 'planner';

export type FeatureInfo = {
  key: FeatureKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** What goes away with it, so switching off is never a surprise. */
  hides: string;
  /** How the server knows it; the server ignores the ones that only hide a screen. */
  token: string;
};

export const FEATURES: FeatureInfo[] = [
  {
    key: 'expenses',
    label: 'Expenses',
    icon: 'receipt-outline',
    hides: 'Also leaves every expense out of Home, Analytics, budgets and your salary balance.',
    token: 'expenses',
  },
  {
    key: 'emi',
    label: 'EMI & Loans',
    icon: 'card-outline',
    hides: 'Also removes loans from Home and leaves EMI payments out of deductions and Analytics.',
    token: 'emi',
  },
  {
    key: 'moneyTracker',
    label: 'Money Tracker',
    icon: 'swap-horizontal-outline',
    hides: 'Also leaves out the expenses and salary additions it created.',
    token: 'money-tracker',
  },
  {
    key: 'sms',
    label: 'SMS Transactions',
    icon: 'chatbubbles-outline',
    hides: 'Also stops reading messages and the daily reminder, and leaves out expenses added from SMS.',
    token: 'sms',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: 'stats-chart-outline',
    hides: 'Only the tab itself.',
    token: 'analytics',
  },
  {
    key: 'savings',
    label: 'Savings',
    icon: 'wallet-outline',
    hides: 'Removes Savings from Profile.',
    token: 'savings',
  },
  {
    key: 'planner',
    label: 'Salary Planner',
    icon: 'pie-chart-outline',
    hides: 'Removes the planner from Home and Profile.',
    token: 'planner',
  },
];

/** Stores what is hidden, not what is shown, so a section added later starts switched on. */
const STORAGE_KEY = 'settings.hidden-features.v1';

type FeaturesContextValue = {
  /** False until the saved choice is read. Nothing should fetch before then. */
  ready: boolean;
  isEnabled: (key: FeatureKey) => boolean;
  setEnabled: (key: FeatureKey, enabled: boolean) => Promise<void>;
};

const FeaturesContext = createContext<FeaturesContextValue | undefined>(undefined);

function applyToApi(hidden: readonly FeatureKey[]) {
  setHiddenFeatures(
    FEATURES.filter((feature) => hidden.includes(feature.key)).map((feature) => feature.token),
  );
}

/**
 * Which sections are switched off, kept on this device.
 *
 * Hiding is never deleting. The choice travels to the server on every request and it
 * leaves those figures out of whatever it computes; switching back on brings them all
 * back exactly as they were.
 */
export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState<FeatureKey[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled || !stored) return;
        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return;
        const known = parsed.filter((key): key is FeatureKey =>
          FEATURES.some((feature) => feature.key === key),
        );
        applyToApi(known);
        setHidden(known);
      })
      .catch(() => {
        // An unreadable setting means everything shows, which loses nothing.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isEnabled = useCallback((key: FeatureKey) => !hidden.includes(key), [hidden]);

  const setEnabled = useCallback(
    async (key: FeatureKey, enabled: boolean) => {
      const next = enabled
        ? hidden.filter((item) => item !== key)
        : Array.from(new Set([...hidden, key]));
      // The header changes before anything refetches, so no screen reloads the old view.
      applyToApi(next);
      setHidden(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      // Offline copies were computed with the old sections counted in.
      await clearDataCache();
    },
    [hidden],
  );

  const value = useMemo(() => ({ ready, isEnabled, setEnabled }), [ready, isEnabled, setEnabled]);
  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}

export function useFeatures() {
  const context = useContext(FeaturesContext);
  if (!context) {
    throw new Error('useFeatures must be used inside FeaturesProvider');
  }
  return context;
}
