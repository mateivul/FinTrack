"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/dashboard/StatCard";
import { SpendingByCategory } from "@/components/dashboard/SpendingByCategory";
import { IncomeVsExpenses } from "@/components/dashboard/IncomeVsExpenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, getTransactionTypeColor, getProgressColor } from "@/lib/utils";
import { cn } from "@/lib/utils";

const now = new Date();

type PeriodKey = "this_month" | "last_month" | "last_3_months" | "last_6_months" | "this_year";

const PERIODS: { key: PeriodKey; labelKey: string; from: Date; to: Date }[] = [
  { key: "this_month", labelKey: "dashboard.period.thisMonth", from: startOfMonth(now), to: endOfMonth(now) },
  { key: "last_month", labelKey: "dashboard.period.lastMonth", from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
  { key: "last_3_months", labelKey: "dashboard.period.last3Months", from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) },
  { key: "last_6_months", labelKey: "dashboard.period.last6Months", from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) },
  { key: "this_year", labelKey: "dashboard.period.thisYear", from: startOfYear(now), to: endOfYear(now) },
];

async function fetchBudgets() {
  const res = await fetch("/api/budgets");
  if (!res.ok) throw new Error("Failed to fetch budgets");
  return res.json();
}

export default function DashboardPage() {
  const t = useTranslations();
  const [period, setPeriod] = useState<PeriodKey>("this_month");

  const activePeriod = PERIODS.find((p) => p.key === period)!;
  const dateFrom = format(activePeriod.from, "yyyy-MM-dd");
  const dateTo = format(activePeriod.to, "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: budgetsData } = useQuery({
    queryKey: ["budgets"],
    queryFn: fetchBudgets,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { summary, accounts, recentTransactions, spendingByTag, monthlyTrend, savingsGoals } =
    data ?? {};

  const primaryCurrency = accounts?.[0]?.currency ?? "RON";

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">{dateFrom} – {dateTo}</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {t(activePeriod.labelKey)}
                <ChevronDown className="w-4 h-4 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PERIODS.map((p) => (
                <DropdownMenuItem key={p.key} onClick={() => setPeriod(p.key)}>
                  {t(p.labelKey)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild>
            <Link href="/transactions?add=true">
              <Plus className="w-4 h-4 mr-2" />
              {t("transactions.add")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("dashboard.totalIncome")}
          value={formatCurrency(summary?.totalIncome ?? 0, primaryCurrency)}
          trend={summary?.incomeTrend}
          trendLabel={t("dashboard.vsLastMonth")}
          icon={<TrendingUp className="w-6 h-6" />}
          color="#10b981"
        />
        <StatCard
          title={t("dashboard.totalExpenses")}
          value={formatCurrency(summary?.totalExpenses ?? 0, primaryCurrency)}
          trend={summary?.expensesTrend !== undefined ? -summary.expensesTrend : undefined}
          trendLabel={t("dashboard.vsLastMonth")}
          icon={<TrendingDown className="w-6 h-6" />}
          color="#f97316"
        />
        <StatCard
          title={t("dashboard.netSavings")}
          value={formatCurrency(summary?.netSavings ?? 0, primaryCurrency)}
          icon={<PiggyBank className="w-6 h-6" />}
          color="#3b82f6"
        />
        <StatCard
          title={t("accounts.title")}
          value={formatCurrency(
            accounts?.reduce((sum: number, a: { currentBalance: number }) => sum + a.currentBalance, 0) ?? 0,
            primaryCurrency
          )}
          icon={<Wallet className="w-6 h-6" />}
          color="#8b5cf6"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingByCategory data={spendingByTag ?? []} currency={primaryCurrency} />
        <IncomeVsExpenses data={monthlyTrend ?? []} currency={primaryCurrency} />
      </div>

      {accounts && accounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("accounts.title")}</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/accounts">{t("common.viewAll")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map((account: {
                id: string;
                name: string;
                color: string;
                currency: string;
                currentBalance: number;
                bankName?: string;
              }) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-accent/50 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${account.color}20` }}
                  >
                    <Wallet className="w-5 h-5" style={{ color: account.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{account.name}</p>
                    {account.bankName && (
                      <p className="text-xs text-muted-foreground truncate">{account.bankName}</p>
                    )}
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm font-bold">
                      {formatCurrency(account.currentBalance, account.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">{account.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("dashboard.recentTransactions")}</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/transactions">{t("common.viewAll")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!recentTransactions || recentTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <ArrowLeftRight className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{t("dashboard.noTransactions")}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {t("dashboard.noTransactionsDesc")}
                </p>
                <Button asChild className="mt-4" size="sm">
                  <Link href="/import">{t("nav.import")}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {recentTransactions.map((tx: {
                  id: string;
                  type: string;
                  description: string;
                  date: string;
                  amount: number;
                  tags: Array<{ tag: { id: string; name: string; color: string } }>;
                  bankAccount: { name: string; currency: string };
                }) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-accent/50 transition-colors"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                        tx.type === "INCOME" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"
                      )}
                    >
                      {tx.type === "INCOME" ? (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                        {tx.tags?.map(({ tag }) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="text-xs py-0 h-4"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            #{tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p
                      className={cn(
                        "text-sm font-bold shrink-0",
                        getTransactionTypeColor(tx.type)
                      )}
                    >
                      {tx.type === "INCOME" ? "+" : "-"}
                      {formatCurrency(tx.amount, tx.bankAccount.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("savings.title")}</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/savings">{t("common.viewAll")}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!savingsGoals || savingsGoals.length === 0 ? (
                <div className="text-center py-6">
                  <PiggyBank className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">{t("savings.noGoals")}</p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href="/savings">{t("savings.add")}</Link>
                  </Button>
                </div>
              ) : (
                savingsGoals.slice(0, 4).map((goal: {
                  id: string;
                  name: string;
                  color: string;
                  currentAmount: number;
                  targetAmount: number;
                }) => {
                  const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                  return (
                    <div key={goal.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{goal.name}</p>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className="h-2"
                        style={{ "--progress-color": goal.color } as React.CSSProperties}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(goal.currentAmount, primaryCurrency)}</span>
                        <span>{formatCurrency(goal.targetAmount, primaryCurrency)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("dashboard.budgetOverview")}</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/budgets">{t("common.viewAll")}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!budgetsData?.budgets || budgetsData.budgets.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-muted-foreground">{t("budgets.noBudgets")}</p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href="/budgets">{t("budgets.add")}</Link>
                  </Button>
                </div>
              ) : (
                budgetsData.budgets.slice(0, 4).map((budget: {
                  id: string;
                  name: string;
                  amount: number;
                  currentSpent: number;
                  tag: { color: string } | null;
                }) => {
                  const pct = Math.min((budget.currentSpent / budget.amount) * 100, 100);
                  return (
                    <div key={budget.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{budget.name}</p>
                        <span
                          className={cn(
                            "text-xs font-medium ml-2 shrink-0",
                            pct >= 100
                              ? "text-red-500"
                              : pct >= 80
                              ? "text-orange-500"
                              : "text-muted-foreground"
                          )}
                        >
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={cn("h-2 rounded-full transition-all", getProgressColor(pct))}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(budget.currentSpent, primaryCurrency)}</span>
                        <span>{formatCurrency(budget.amount, primaryCurrency)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

