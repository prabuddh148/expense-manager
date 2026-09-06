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
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { useTheme } from '../theme';
import { MainTabParamList } from './types';

const Tab = createMaterialTopTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  DashboardTab: 'home-outline',
  ExpensesTab: 'receipt-outline',
  EmiTab: 'card-outline',
  AnalyticsTab: 'stats-chart-outline',
  ProfileTab: 'person-circle-outline',
};

const ACTIVE_ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  DashboardTab: 'home',
  ExpensesTab: 'receipt',
  EmiTab: 'card',
  AnalyticsTab: 'stats-chart',
  ProfileTab: 'person-circle',
};

/**
 * Tabs sit at the top and are swipeable: material top tabs run on a pager, so dragging
 * horizontally moves between screens and the indicator tracks the gesture.
 *
 * The top inset is consumed once here by the brand bar, so the screens below pass
 * edges={[]} to their Screen wrapper and do not add it a second time.
 */
export function MainTabs() {
  const { colors, radius, spacing, typography, isDark, toggleTheme } = useTheme();

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
          tabBarItemStyle: { paddingVertical: 6, paddingHorizontal: 0 },
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
        <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ title: 'Home' }} />
        <Tab.Screen name="ExpensesTab" component={ExpensesScreen} options={{ title: 'Expenses' }} />
        <Tab.Screen name="EmiTab" component={EmiScreen} options={{ title: 'EMI' }} />
        <Tab.Screen name="AnalyticsTab" component={AnalyticsScreen} options={{ title: 'Analytics' }} />
        <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  brandBar: { flexDirection: 'row', alignItems: 'center' },
  themeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
