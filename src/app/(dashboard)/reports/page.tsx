"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { Download, TrendingUp, TrendingDown, PiggyBank, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as PieTooltip,
} from "recharts";
import { formatCurrency, getTransactionTypeColor, cn } from "@/lib/utils";

type PeriodPreset = "this_month" | "last_3_months" | "last_6_months" | "this_year" | "custom";

function CustomBarTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-md min-w-[160px]">
      <p className="text-sm font-semibold text-popover-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-popover-foreground">{entry.name}</span>
          </div>
          <span className="font-medium text-popover-foreground">
            {formatCurrency(entry.value, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

function CustomPieTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-md">
      <div className="flex items-center gap-1.5 text-sm">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.payload.color }} />
        <span className="font-medium">{entry.name}</span>
      </div>
      <p className="text-sm font-bold mt-0.5">{formatCurrency(entry.value, currency)}</p>
    </div>
  );
}

export default function ReportsPage() {
  const t = useTranslations();
  const now = new Date();

  const [preset, setPreset] = useState<PeriodPreset>("last_6_months");
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const dateFrom = useMemo(() => {
    switch (preset) {
      case "this_month":    return format(startOfMonth(now), "yyyy-MM-dd");
      case "last_3_months": return format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd");
      case "last_6_months": return format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd");
      case "this_year":     return format(startOfYear(now), "yyyy-MM-dd");
      case "custom":        return customFrom;
    }
  }, [preset, customFrom]);

  const dateTo = useMemo(() => {
    switch (preset) {
      case "this_month":    return format(endOfMonth(now), "yyyy-MM-dd");
      case "last_3_months": return format(endOfMonth(now), "yyyy-MM-dd");
      case "last_6_months": return format(endOfMonth(now), "yyyy-MM-dd");
      case "this_year":     return format(endOfYear(now), "yyyy-MM-dd");
      case "custom":        return customTo;
    }
  }, [preset, customTo]);

  const { data: dashData } = useQuery({
    queryKey: ["dashboard-reports"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: txData, isLoading } = useQuery({
    queryKey: ["transactions-reports", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ dateFrom, dateTo, limit: "1000" });
      const res = await fetch(`/api/transactions?${params}`);
      return res.json();
    },
  });

  const transactions: Array<{
    id: string;
    amount: number;
    type: string;
    date: string;
    description: string;
    tags: Array<{ tag: { id: string; name: string; color: string } }>;
    bankAccount: { name: string; currency: string };
  }> = txData?.transactions ?? [];

  const accounts: Array<{ currentBalance: number; currency: string; name: string }> = dashData?.accounts ?? [];
  const primaryCurrency: string = accounts[0]?.currency ?? "RON";

  const totalIncome = useMemo(
    () => transactions.filter((tx) => tx.type === "INCOME").reduce((s, tx) => s + tx.amount, 0),
    [transactions]
  );
  const totalExpenses = useMemo(
    () => transactions.filter((tx) => tx.type === "EXPENSE").reduce((s, tx) => s + tx.amount, 0),
    [transactions]
  );
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  const monthlyTrend = useMemo(() => {
    const months: Record<string, { sortKey: string; month: string; income: number; expenses: number }> = {};
    for (const tx of transactions) {
      const d = new Date(tx.date);
      const sortKey = format(d, "yyyy-MM");
      months[sortKey] ??= { sortKey, month: format(d, "MMM yy"), income: 0, expenses: 0 };
      if (tx.type === "INCOME") months[sortKey].income += tx.amount;
      if (tx.type === "EXPENSE") months[sortKey].expenses += tx.amount;
    }
    return Object.values(months)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ month, income, expenses }) => ({ month, income, expenses }));
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    const tagTotals: Record<string, { name: string; amount: number; color: string }> = {};
    for (const tx of transactions) {
      if (tx.type !== "EXPENSE") continue;
      if (!tx.tags?.length) {
        tagTotals["__untagged__"] ??= { name: t("reports.untagged"), amount: 0, color: "#9ca3af" };
        tagTotals["__untagged__"].amount += tx.amount;
      } else {
        for (const { tag } of tx.tags) {
          tagTotals[tag.id] ??= { name: tag.name, amount: 0, color: tag.color };
          tagTotals[tag.id].amount += tx.amount;
        }
      }
    }
    return Object.values(tagTotals).sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [transactions, t]);

  const topExpenses = useMemo(
    () =>
      [...transactions]
        .filter((tx) => tx.type === "EXPENSE")
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8),
    [transactions]
  );

  function handleExportCsv() {
    const rows = [
      ["Date", "Type", "Description", "Amount", "Account", "Tags"],
      ...transactions.map((tx) => [
        format(new Date(tx.date), "yyyy-MM-dd"),
        tx.type,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.amount,
        tx.bankAccount.name,
        tx.tags.map((t) => t.tag.name).join("; "),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fintrack-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJson() {
    const blob = new Blob(
      [JSON.stringify({ transactions, accounts, totalIncome, totalExpenses, netSavings }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fintrack-${dateFrom}-${dateTo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const PRESETS: Array<{ key: PeriodPreset; labelKey: string }> = [
    { key: "this_month",    labelKey: "dashboard.period.thisMonth" },
    { key: "last_3_months", labelKey: "dashboard.period.last3Months" },
    { key: "last_6_months", labelKey: "dashboard.period.last6Months" },
    { key: "this_year",     labelKey: "dashboard.period.thisYear" },
    { key: "custom",        labelKey: "reports.custom" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("reports.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isLoading || transactions.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            {t("reports.exportCsv")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJson} disabled={isLoading || transactions.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            {t("reports.exportJson")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(({ key, labelKey }) => (
              <Button
                key={key}
                size="sm"
                variant={preset === key ? "default" : "outline"}
                onClick={() => setPreset(key)}
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </Button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex gap-4 items-end pt-1">
              <div className="space-y-1.5">
                <Label>{t("reports.from")}</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("reports.to")}</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36" />
              </div>
            </div>
          )}
          {!isLoading && (
            <p className="text-xs text-muted-foreground">
              {t("reports.transactionCount", { count: transactions.length })}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{t("dashboard.totalIncome")}</p>
                <p className="text-base font-bold text-emerald-500 truncate">
                  {formatCurrency(totalIncome, primaryCurrency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{t("dashboard.totalExpenses")}</p>
                <p className="text-base font-bold text-red-500 truncate">
                  {formatCurrency(totalExpenses, primaryCurrency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                netSavings >= 0 ? "bg-blue-100 dark:bg-blue-900/30" : "bg-orange-100 dark:bg-orange-900/30"
              )}>
                <PiggyBank className={cn("w-5 h-5", netSavings >= 0 ? "text-blue-500" : "text-orange-500")} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{t("reports.netSavings")}</p>
                <p className={cn("text-base font-bold truncate", netSavings >= 0 ? "text-blue-500" : "text-orange-500")}>
                  {netSavings >= 0 ? "+" : ""}{formatCurrency(netSavings, primaryCurrency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                savingsRate >= 20 ? "bg-emerald-100 dark:bg-emerald-900/30"
                  : savingsRate >= 0 ? "bg-yellow-100 dark:bg-yellow-900/30"
                  : "bg-red-100 dark:bg-red-900/30"
              )}>
                <Percent className={cn("w-5 h-5",
                  savingsRate >= 20 ? "text-emerald-500"
                  : savingsRate >= 0 ? "text-yellow-500"
                  : "text-red-500"
                )} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{t("reports.savingsRate")}</p>
                <p className={cn("text-base font-bold truncate",
                  savingsRate >= 20 ? "text-emerald-500"
                  : savingsRate >= 0 ? "text-yellow-500"
                  : "text-red-500"
                )}>
                  {totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.incomeVsExpenses")}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                {t("reports.noTransactions")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyTrend} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: unknown) => {
                      const n = Number(v);
                      return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
                    }}
                  />
                  <Tooltip
                    content={<CustomBarTooltip currency={primaryCurrency} />}
                    wrapperStyle={{ backgroundColor: "transparent", border: "none", boxShadow: "none", padding: 0 }}
                  />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar dataKey="income" name={t("reports.incomeLabel")} fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name={t("reports.expensesLabel")} fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("reports.categoryBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                {t("reports.noTransactions")}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {categoryBreakdown.map((cat, i) => (
                        <Cell key={i} fill={cat.color} />
                      ))}
                    </Pie>
                    <PieTooltip content={<CustomPieTooltip currency={primaryCurrency} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {categoryBreakdown.slice(0, 6).map((cat) => {
                    const pct = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;
                    return (
                      <div key={cat.name} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate flex-1 text-muted-foreground">{cat.name}</span>
                        <span className="font-medium shrink-0">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("reports.topTransactions")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("reports.noTransactions")}</p>
            ) : (
              <div className="divide-y divide-border">
                {topExpenses.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.date), "dd MMM yyyy")}
                        {tx.tags?.length > 0 && (
                          <span className="ml-1.5">
                            {tx.tags.slice(0, 2).map(({ tag }) => (
                              <Badge
                                key={tag.id}
                                variant="secondary"
                                className="text-xs py-0 h-4 ml-1"
                                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                              >
                                #{tag.name}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className={cn("text-sm font-bold shrink-0", getTransactionTypeColor(tx.type))}>
                      -{formatCurrency(tx.amount, tx.bankAccount.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
            
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("reports.categoryBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("reports.noTransactions")}</p>
            ) : (
              <div className="space-y-3">
                {categoryBreakdown.map((cat) => {
                  const maxAmount = categoryBreakdown[0]?.amount ?? 1;
                  const pct = (cat.amount / maxAmount) * 100;
                  const totalPct = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="font-medium">{cat.name}</span>
                          <span className="text-xs text-muted-foreground">({totalPct.toFixed(0)}%)</span>
                        </div>
                        <span className="text-muted-foreground">{formatCurrency(cat.amount, primaryCurrency)}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
