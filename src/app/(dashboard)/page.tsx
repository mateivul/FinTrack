"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  ChevronRight,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/dashboard/StatCard";
import { SpendingByCategory } from "@/components/dashboard/SpendingByCategory";
import { IncomeVsExpenses } from "@/components/dashboard/IncomeVsExpenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatCurrency, formatDate, getTransactionTypeColor, getProgressColor } from "@/lib/utils";
import { cn } from "@/lib/utils";

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

interface QuickAddForm {
  type: TxType;
  amount: string;
  description: string;
  bankAccountId: string;
  toAccountId: string;
  date: string;
  tagIds: string[];
}

type PeriodKey = "this_month" | "last_month" | "last_3_months" | "last_6_months" | "this_year";

function buildPeriods(now: Date) {
  return [
    { key: "this_month" as PeriodKey, labelKey: "dashboard.period.thisMonth", from: startOfMonth(now), to: endOfMonth(now) },
    { key: "last_month" as PeriodKey, labelKey: "dashboard.period.lastMonth", from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
    { key: "last_3_months" as PeriodKey, labelKey: "dashboard.period.last3Months", from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) },
    { key: "last_6_months" as PeriodKey, labelKey: "dashboard.period.last6Months", from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) },
    { key: "this_year" as PeriodKey, labelKey: "dashboard.period.thisYear", from: startOfYear(now), to: endOfYear(now) },
  ];
}

async function fetchBudgets() {
  const res = await fetch("/api/budgets");
  if (!res.ok) throw new Error("Failed to fetch budgets");
  return res.json();
}

const defaultQuickForm: QuickAddForm = {
  type: "EXPENSE",
  amount: "",
  description: "",
  bankAccountId: "",
  toAccountId: "",
  date: "",
  tagIds: [],
};

export default function DashboardPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<QuickAddForm>(defaultQuickForm);
  const [addSaving, setAddSaving] = useState(false);

  const PERIODS = buildPeriods(new Date());
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

  const { data: accountsListData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const accountsList: { id: string; name: string; currency: string }[] = accountsListData?.accounts ?? [];
  const tagsList: { id: string; name: string; color: string }[] = tagsData?.tags ?? [];

  function openAdd() {
    setAddForm({
      ...defaultQuickForm,
      bankAccountId: accountsList[0]?.id ?? "",
      date: format(new Date(), "yyyy-MM-dd"),
    });
    setAddOpen(true);
  }

  const handleQuickSave = useCallback(async () => {
    if (!addForm.amount || !addForm.bankAccountId) {
      toast.error(t("transactions.requiredFields"));
      return;
    }
    if (addForm.type === "TRANSFER" && !addForm.toAccountId) {
      toast.error(t("transactions.transferDestRequired"));
      return;
    }
    if (addForm.type === "TRANSFER" && addForm.toAccountId === addForm.bankAccountId) {
      toast.error(t("transactions.transferSameAccount"));
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(addForm.amount),
          type: addForm.type,
          date: addForm.date,
          description: addForm.description || t(`transactions.${addForm.type.toLowerCase()}` as Parameters<typeof t>[0]),
          bankAccountId: addForm.bankAccountId,
          toAccountId: addForm.type === "TRANSFER" ? addForm.toAccountId : undefined,
          tags: addForm.tagIds,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t("common.error"));
        return;
      }
      toast.success(t("transactions.added"));
      setAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    } finally {
      setAddSaving(false);
    }
  }, [addForm, queryClient, t]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
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
  const totalBalance = accounts?.reduce(
    (sum: number, a: { currentBalance: number }) => sum + a.currentBalance, 0
  ) ?? 0;
  const hasSidebar =
    (savingsGoals && savingsGoals.length > 0) ||
    !!(budgetsData?.budgets && budgetsData.budgets.length > 0);

  return (
    <div className="space-y-6 max-w-[1400px]">    
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
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
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            {t("transactions.add")}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-5">
            <div className="lg:col-span-2 p-6 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-border">
              <p className="text-sm font-medium text-muted-foreground">{t("reports.netWorth")}</p>
              <p className={cn(
                "text-4xl font-bold tracking-tight mt-1",
                totalBalance < 0 && "text-red-500"
              )}>
                {formatCurrency(totalBalance, primaryCurrency)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {accounts?.length ?? 0} {t("accounts.count")}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4 w-fit">
                <Link href="/accounts">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {t("accounts.add")}
                </Link>
              </Button>
            </div>

            <div className="lg:col-span-3 p-4 flex flex-col justify-center">
              {accounts && accounts.length > 0 ? (
                <div className="space-y-0.5">
                  {accounts.map((account: {
                    id: string;
                    name: string;
                    color: string;
                    currency: string;
                    currentBalance: number;
                    bankName?: string;
                  }) => (
                    <Link
                      key={account.id}
                      href={`/accounts/${account.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/50 transition-colors group"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${account.color}20` }}
                      >
                        <Wallet className="w-4 h-4" style={{ color: account.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{account.name}</p>
                        {account.bankName && (
                          <p className="text-xs text-muted-foreground truncate">{account.bankName}</p>
                        )}
                      </div>
                      <p className={cn(
                        "text-sm font-bold shrink-0",
                        account.currentBalance < 0 ? "text-red-500" : "text-foreground"
                      )}>
                        {formatCurrency(account.currentBalance, account.currency)}
                      </p>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-2">{t("accounts.noAccounts")}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/accounts">{t("accounts.add")}</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingByCategory data={spendingByTag ?? []} currency={primaryCurrency} />
        <IncomeVsExpenses data={monthlyTrend ?? []} currency={primaryCurrency} />
      </div>

      <div className={cn("grid grid-cols-1 gap-6", hasSidebar && "lg:grid-cols-3")}>
        <Card className={hasSidebar ? "lg:col-span-2" : ""}>
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
                        tx.type === "INCOME"
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : tx.type === "TRANSFER"
                          ? "bg-blue-100 dark:bg-blue-900/30"
                          : "bg-red-100 dark:bg-red-900/30"
                      )}
                    >
                      {tx.type === "INCOME" ? (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                      ) : tx.type === "TRANSFER" ? (
                        <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                        {tx.type === "TRANSFER" && (
                          <Badge variant="secondary" className="text-xs py-0 h-4 text-blue-500 bg-blue-100 dark:bg-blue-900/30">
                            {t("transactions.transfer")}
                          </Badge>
                        )}
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
                      {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                      {formatCurrency(tx.amount, tx.bankAccount.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {savingsGoals && savingsGoals.length > 0 && (
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
                {savingsGoals.slice(0, 4).map((goal: {
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
                })}
              </CardContent>
            </Card>
          )}

          {budgetsData?.budgets && budgetsData.budgets.length > 0 && (
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
                {budgetsData.budgets.slice(0, 4).map((budget: {
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
                        <span className={cn(
                          "text-xs font-medium ml-2 shrink-0",
                          pct >= 100 ? "text-red-500" : pct >= 80 ? "text-orange-500" : "text-muted-foreground"
                        )}>
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
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("transactions.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("transactions.type")}</Label>
              <div className="flex gap-2">
                {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((type) => (
                  <Button
                    key={type}
                    variant={addForm.type === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAddForm((f) => ({ ...f, type, toAccountId: "" }))}
                    className={cn(
                      "flex-1",
                      addForm.type === type && type === "EXPENSE" && "bg-red-500 hover:bg-red-600",
                      addForm.type === type && type === "INCOME" && "bg-emerald-500 hover:bg-emerald-600",
                      addForm.type === type && type === "TRANSFER" && "bg-blue-500 hover:bg-blue-600"
                    )}
                  >
                    {t(`transactions.${type.toLowerCase()}` as Parameters<typeof t>[0])}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("transactions.amount")} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={addForm.amount}
                  onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("transactions.date")} *</Label>
                <Input
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("transactions.description")}</Label>
              <Input
                placeholder={t("transactions.descriptionPlaceholder")}
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("transactions.account")} *</Label>
              <Select
                value={addForm.bankAccountId}
                onValueChange={(v) => setAddForm((f) => ({ ...f, bankAccountId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("import.selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  {accountsList.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {addForm.type === "TRANSFER" && (
              <div className="space-y-1.5">
                <Label>{t("transactions.toAccount")} *</Label>
                <Select
                  value={addForm.toAccountId}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, toAccountId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("import.selectAccount")} />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsList.filter((a) => a.id !== addForm.bankAccountId).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tagsList.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("transactions.tags")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tagsList.map((tag) => {
                    const selected = addForm.tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setAddForm((f) => ({
                          ...f,
                          tagIds: selected ? f.tagIds.filter((i) => i !== tag.id) : [...f.tagIds, tag.id],
                        }))}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                          selected ? "border-transparent" : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                        )}
                        style={selected ? { backgroundColor: `${tag.color}20`, borderColor: tag.color, color: tag.color } : undefined}
                      >
                        {selected && <Check className="w-3 h-3" />}
                        #{tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleQuickSave} disabled={addSaving}>
              {addSaving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

