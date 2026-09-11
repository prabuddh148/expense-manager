import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Logo } from '../components/Logo';
import { AnalyticsScreen } from '../screens/main/AnalyticsScreen';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { EmiScreen } from '../screens/main/EmiScreen';
import { ExpensesScreen } from '../screens/main/ExpensesScreen';
import { MoneyTrackerScreen } from '../screens/main/MoneyTrackerScreen';
import { SmsTransactionsScreen } from '../screens/main/SmsTransactionsScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { FeatureKey, useFeatures } from '../store/FeaturesContext';
import { useTheme } from '../theme';
import { MainTabParamList } from './types';

const Tab = createMaterialTopTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  DashboardTab: 'home-outline',
  ExpensesTab: 'receipt-outline',
  EmiTab: 'card-outline',
  MoneyTrackerTab: 'swap-horizontal-outline',
  SmsTab: 'chatbubbles-outline',
  AnalyticsTab: 'stats-chart-outline',
  ProfileTab: 'person-circle-outline',
};

const ACTIVE_ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  DashboardTab: 'home',
  ExpensesTab: 'receipt',
  EmiTab: 'card',
  MoneyTrackerTab: 'swap-horizontal',
  SmsTab: 'chatbubbles',
  AnalyticsTab: 'stats-chart',
  ProfileTab: 'person-circle',
};

/** Tabs with a `feature` can be switched off in Settings; Home and Profile cannot. */
const TABS: {
  name: keyof MainTabParamList;
  title: string;
  component: React.ComponentType;
  feature?: FeatureKey;
}[] = [
  { name: 'DashboardTab', title: 'Home', component: DashboardScreen },
  { name: 'ExpensesTab', title: 'Expenses', component: ExpensesScreen, feature: 'expenses' },
  { name: 'EmiTab', title: 'EMI', component: EmiScreen, feature: 'emi' },
  { name: 'MoneyTrackerTab', title: 'Money', component: MoneyTrackerScreen, feature: 'moneyTracker' },
  { name: 'SmsTab', title: 'SMS', component: SmsTransactionsScreen, feature: 'sms' },
  { name: 'AnalyticsTab', title: 'Analytics', component: AnalyticsScreen, feature: 'analytics' },
  { name: 'ProfileTab', title: 'Profile', component: ProfileScreen },
];

/** Up to this many tabs share the width evenly; beyond it the bar scrolls. */
const FIXED_TAB_LIMIT = 4;

/**
 * Tabs sit at the top and are swipeable: material top tabs run on a pager, so dragging
 * horizontally moves between screens and the indicator tracks the gesture.
 *
 * The top inset is consumed once here by the brand bar, so the screens below pass
 * edges={[]} to their Screen wrapper and do not add it a second time.
 */
export function MainTabs() {
  const { colors, radius, spacing, typography, isDark, toggleTheme } = useTheme();
  const { isEnabled } = useFeatures();

  const tabs = TABS.filter((tab) => !tab.feature || isEnabled(tab.feature));
  const scrollable = tabs.length > FIXED_TAB_LIMIT;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.brandBar, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}>
        <Logo size={30} />
        <Text style={[typography.heading, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
          Expense Manager
        </Text>

        <Pressable
          onPress={toggleTheme}
          hitSlop={10}
          accessibilityRole="switch"
          accessibilityState={{ checked: isDark }}
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={[
            styles.themeButton,
            { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill },
          ]}
        >
          <Ionicons name={isDark ? 'sunny' : 'moon'} size={17} color={colors.text} />
        </Pressable>
      </View>

      <Tab.Navigator
        // Swipe is the point of moving the bar up here, so keep the pager enabled.
        screenOptions={({ route }) => ({
          swipeEnabled: true,
          // Six tabs will not fit across a phone, so the bar scrolls instead of
          // squeezing the labels down to nothing. With sections switched off there may
          // be few enough to share the width, and a scrolling bar would bunch them left.
          tabBarScrollEnabled: scrollable,
          tabBarShowIcon: true,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarPressColor: colors.primarySoft,
          tabBarStyle: {
            backgroundColor: colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          },
          tabBarItemStyle: scrollable
            ? { paddingVertical: 6, paddingHorizontal: 4, width: 'auto', minWidth: 84 }
            : { paddingVertical: 6, paddingHorizontal: 4 },
          tabBarIconStyle: { height: 22, marginBottom: 0 },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            textTransform: 'none',
            margin: 0,
          },
          tabBarIndicatorStyle: {
            backgroundColor: colors.primary,
            height: 3,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
          },
          tabBarIndicatorContainerStyle: { backgroundColor: 'transparent' },
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? ACTIVE_ICONS[route.name] : ICONS[route.name]}
              size={19}
              color={color}
            />
          ),
        })}
      >
        {tabs.map((tab) => (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            component={tab.component}
            options={{ title: tab.title }}
          />
        ))}
      </Tab.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  brandBar: { flexDirection: 'row', alignItems: 'center' },
  themeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
