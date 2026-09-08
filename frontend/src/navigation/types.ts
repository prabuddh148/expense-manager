import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  DashboardTab: undefined;
  ExpensesTab: undefined;
  EmiTab: undefined;
  MoneyTrackerTab: undefined;
  SmsTab: undefined;
  AnalyticsTab: undefined;
  ProfileTab: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList>;
  SalaryTarget: undefined;
  Categories: undefined;
  AddExpense: { expenseId?: number; categoryId?: number } | undefined;
  ExpenseDetail: { expenseId: number };
  LoanForm: { loanId?: number } | undefined;
  LoanDetail: { loanId: number };
  EmiPayment: { loanId: number; paymentId?: number };
  SalaryPlanner: undefined;
  SalaryPlannerEditor: { plannerId?: number } | undefined;
  SalaryPlannerPreview: { plannerId: number };
  Settings: undefined;
  MoneyTrackerForm: { transactionId?: number } | undefined;
};
