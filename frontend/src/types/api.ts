/** Mirrors the Spring Boot DTOs. Money arrives as a JSON number already scaled to 2dp. */

export type User = {
  id: number;
  name: string;
  email: string;
  provider: 'LOCAL' | 'GOOGLE';
  createdAt: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInMs: number;
  user: User;
};

export type Salary = {
  id: number | null;
  amount: number;
  targetAmount: number | null;
  targetDate: string | null;
  year: number;
  month: number;
  difference: number | null;
  progressPercentage: number;
  totalDeductions: number;
  remainingAmount: number;
  updatedAt: string | null;
};

export type SalaryPayload = {
  amount: number;
  targetAmount?: number | null;
  targetDate?: string | null;
  year?: number;
  month?: number;
};

export type Category = {
  id: number;
  name: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usedPercentage: number;
  overspent: boolean;
  transactionCount: number;
  color: string | null;
  icon: string | null;
  updatedAt: string;
};

export type CategoryPayload = {
  name: string;
  allocatedAmount: number;
  color?: string | null;
  icon?: string | null;
};

export type Expense = {
  id: number;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  expenseName: string | null;
  displayName: string;
  description: string | null;
  date: string;
  time: string | null;
  createdAt: string;
};

export type ExpensePayload = {
  amount: number;
  categoryId?: number | null;
  expenseName?: string | null;
  description?: string | null;
  date?: string | null;
  time?: string | null;
};

export type Page<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export type ExpenseQuery = {
  search?: string;
  categoryId?: number | null;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  size?: number;
  sortBy?: 'date' | 'amount' | 'createdAt';
  direction?: 'asc' | 'desc';
};

export type Loan = {
  id: number;
  name: string;
  originalAmount: number;
  remainingAmount: number;
  paidAmount: number;
  monthlyEmi: number;
  interestRate: number | null;
  startDate: string;
  endDate: string | null;
  status: 'ACTIVE' | 'CLOSED';
  progressPercentage: number;
  paymentCount: number;
  estimatedInstalmentsLeft: number | null;
};

export type LoanPayload = {
  name: string;
  originalAmount: number;
  monthlyEmi: number;
  interestRate?: number | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type EmiPayment = {
  id: number;
  loanId: number;
  loanName: string;
  amount: number;
  paymentDate: string;
  description: string | null;
  createdAt: string;
};

export type EmiPaymentPayload = {
  amount: number;
  paymentDate?: string | null;
  description?: string | null;
};

export type CategorySpend = {
  categoryId: number | null;
  name: string;
  color: string | null;
  amount: number;
  percentage: number;
  transactions: number;
};

export type DailySpend = { date: string; amount: number };

export type Analytics = {
  rangeLabel: string;
  from: string;
  to: string;
  totalExpenses: number;
  totalEmiPaid: number;
  totalDeductions: number;
  salary: number;
  remainingAmount: number;
  transactionCount: number;
  averagePerDay: number;
  highestDayAmount: number;
  highestDay: string | null;
  categories: CategorySpend[];
  daily: DailySpend[];
};

export type AnalyticsPeriod =
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

export type Dashboard = {
  year: number;
  month: number;
  monthLabel: string;
  salary: {
    amount: number;
    targetAmount: number | null;
    difference: number | null;
    progressPercentage: number;
    targetDate: string | null;
    totalDeductions: number;
    remainingAmount: number;
  };
  expenses: {
    totalSpent: number;
    totalBudgeted: number;
    remainingBudget: number;
    transactionCount: number;
    averagePerDay: number;
  };
  loans: {
    totalOutstanding: number;
    totalOriginal: number;
    totalPaid: number;
    monthlyEmi: number;
    paidThisMonth: number;
    activeLoans: number;
    progressPercentage: number;
  };
  categoryBreakdown: CategorySpend[];
  dailyTrend: DailySpend[];
  recentExpenses: Expense[];
};

export type SalaryPlannerItem = {
  id: number;
  name: string;
  amount: number;
  percentage: number;
  color: string | null;
  position: number;
};

export type SalaryPlanner = {
  id: number;
  name: string;
  totalSalary: number;
  totalAllocated: number;
  remainingAmount: number;
  allocatedPercentage: number;
  overAllocated: boolean;
  items: SalaryPlannerItem[];
  createdAt: string;
  updatedAt: string;
};

export type SalaryPlannerItemPayload = {
  name: string;
  amount: number;
  color?: string | null;
  position?: number | null;
};

export type SalaryPlannerPayload = {
  name?: string | null;
  totalSalary: number;
  items?: SalaryPlannerItemPayload[];
};

export type ApiErrorBody = {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors?: Record<string, string>;
};
