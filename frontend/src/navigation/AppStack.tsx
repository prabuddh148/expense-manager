import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { AddExpenseScreen } from '../screens/main/AddExpenseScreen';
import { CategoriesScreen } from '../screens/main/CategoriesScreen';
import { EmiPaymentScreen } from '../screens/main/EmiPaymentScreen';
import { ExpenseDetailScreen } from '../screens/main/ExpenseDetailScreen';
import { LoanDetailScreen } from '../screens/main/LoanDetailScreen';
import { LoanFormScreen } from '../screens/main/LoanFormScreen';
import { SalaryPlannerEditorScreen } from '../screens/main/SalaryPlannerEditorScreen';
import { SalaryPlannerPreviewScreen } from '../screens/main/SalaryPlannerPreviewScreen';
import { SalaryPlannerScreen } from '../screens/main/SalaryPlannerScreen';
import { SalaryTargetScreen } from '../screens/main/SalaryTargetScreen';
import { MoneyTrackerFormScreen } from '../screens/main/MoneyTrackerFormScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { useTheme } from '../theme';
import { MainTabs } from './MainTabs';
import { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="SalaryTarget"
        component={SalaryTargetScreen}
        options={{ title: 'Salary & Target' }}
      />
      <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Categories' }} />
      <Stack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{ title: 'Add Expense', presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="ExpenseDetail"
        component={ExpenseDetailScreen}
        options={{ title: 'Expense' }}
      />
      <Stack.Screen name="LoanForm" component={LoanFormScreen} options={{ title: 'Loan' }} />
      <Stack.Screen name="LoanDetail" component={LoanDetailScreen} options={{ title: 'Loan' }} />
      <Stack.Screen
        name="EmiPayment"
        component={EmiPaymentScreen}
        options={{ title: 'Record Payment', presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="SalaryPlanner"
        component={SalaryPlannerScreen}
        options={{ title: 'Salary Planner' }}
      />
      <Stack.Screen
        name="SalaryPlannerEditor"
        component={SalaryPlannerEditorScreen}
        options={{ title: 'Plan' }}
      />
      <Stack.Screen
        name="SalaryPlannerPreview"
        component={SalaryPlannerPreviewScreen}
        options={{ title: 'Preview & Export' }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
      <Stack.Screen
        name="MoneyTrackerForm"
        component={MoneyTrackerFormScreen}
        options={{ title: "Money Tracker" }}
      />
    </Stack.Navigator>
  );
}
