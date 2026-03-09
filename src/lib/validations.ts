import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const bankAccountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  accountType: z.enum(["CASH", "CARD", "SAVINGS", "INVESTMENT", "LOAN", "INSURANCE", "OTHER"]).default("CARD"),
  bankName: z.string().optional(),
  currency: z.string().default("RON"),
  accountNumber: z.string().optional(),
  color: z.string().default("#3B82F6"),
  icon: z.string().default("building-2"),
  currentBalance: z.number().default(0),
});

export const transactionSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  date: z.string().or(z.date()),
  description: z.string().optional(),
  notes: z.string().optional(),
  bankAccountId: z.string().min(1, "Account is required"),
  toAccountId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const budgetSchema = z.object({
  name: z.string().min(1, "Budget name is required"),
  tagId: z.string().nullable().optional(),
  amount: z.number().positive("Amount must be positive"),
  period: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
  alertThreshold: z.number().min(0).max(1).default(0.8),
  rollover: z.boolean().default(false),
});

export const savingsGoalSchema = z.object({
  name: z.string().min(1, "Goal name is required"),
  targetAmount: z.number().positive("Target amount must be positive"),
  currentAmount: z.number().min(0).default(0),
  deadline: z.string().optional(),
  icon: z.string().default("piggy-bank"),
  color: z.string().default("#10B981"),
  monthlyContribution: z.number().optional(),
});

export const recurringRuleSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be positive"),
  type: z.enum(["INCOME", "EXPENSE"]),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"]),
  nextOccurrence: z.string(),
  bankAccountId: z.string().min(1, "Account is required"),
});

export const tagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(50),
  color: z.string().default("#6B7280"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type BankAccountInput = z.infer<typeof bankAccountSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>;
export type RecurringRuleInput = z.infer<typeof recurringRuleSchema>;
export type TagInput = z.infer<typeof tagSchema>;
