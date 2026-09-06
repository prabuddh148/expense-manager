/**
 * Two complete palettes with the same keys, so every component reads colours by role
 * and never hard-codes a hex value. Switching mode swaps the whole object.
 */
export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primarySoft: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  border: string;
  overlay: string;
  tabBar: string;
  skeleton: string;
};

export const lightColors: ThemeColors = {
  background: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F9',
  surfaceElevated: '#FFFFFF',
  text: '#0F1621',
  textMuted: '#69748A',
  textInverse: '#FFFFFF',
  primary: '#3D7BF7',
  primarySoft: '#E5EDFE',
  accent: '#F2704A',
  success: '#22A06B',
  danger: '#DC3F45',
  warning: '#E0A008',
  border: '#E1E7F0',
  overlay: 'rgba(15, 22, 33, 0.45)',
  tabBar: '#FFFFFF',
  skeleton: '#E6EBF3',
};

export const darkColors: ThemeColors = {
  background: '#0D1016',
  surface: '#161A22',
  surfaceAlt: '#1E232D',
  surfaceElevated: '#1B2029',
  text: '#F1F4F9',
  textMuted: '#94A0B4',
  textInverse: '#0D1016',
  primary: '#6EA2FF',
  primarySoft: '#1D2B45',
  accent: '#FF8A5C',
  success: '#4CC38A',
  danger: '#FF6B6E',
  warning: '#FFC95C',
  border: '#262D39',
  overlay: 'rgba(0, 0, 0, 0.6)',
  tabBar: '#12161D',
  skeleton: '#212733',
};

/** Categorical colours for charts, tuned to stay legible on both backgrounds. */
export const chartPalette = [
  '#3D7BF7',
  '#F2704A',
  '#22A06B',
  '#9B6BF2',
  '#E0A008',
  '#12B3A8',
  '#E5647B',
  '#6C7A93',
];

export const colorForIndex = (index: number) => chartPalette[index % chartPalette.length];
