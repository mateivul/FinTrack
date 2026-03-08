"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { BarChart3, Download, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export default function ReportsPage() {
  const t = useTranslations();
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const { data: dashData } = useQuery({
    queryKey: ["dashboard-reports"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      return res.json();
    },
  });

  const { data: txData } = useQuery({
    queryKey: ["transactions-reports", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ dateFrom, dateTo, limit: "1000" });
      const res = await fetch(`/api/transactions?${params}`);
      return res.json();
    },
  });

  const monthlyTrend = dashData?.monthlyTrend ?? [];
  const transactions = txData?.transactions ?? [];
  const accounts = dashData?.accounts ?? [];

  const totalBalance = accounts.reduce(
    (sum: number, a: { currentBalance: number }) => sum + a.currentBalance,
    0
  );

  const totalIncome = transactions
    .filter((tx: { type: string }) => tx.type === "INCOME")
    .reduce((s: number, tx: { amount: number }) => s + tx.amount, 0);
  const totalExpenses = transactions
    .filter((tx: { type: string }) => tx.type === "EXPENSE")
    .reduce((s: number, tx: { amount: number }) => s + tx.amount, 0);

  const tagTotals: Record<string, { name: string; amount: number; color: string }> = {};
  for (const tx of transactions) {
    if (tx.type !== "EXPENSE") continue;
    const txTags: { tag: { id: string; name: string; color: string } }[] = tx.tags ?? [];
    if (txTags.length === 0) {
      tagTotals["__untagged__"] ??= { name: "Untagged", amount: 0, color: "#9ca3af" };
      tagTotals["__untagged__"].amount += tx.amount;
    } else {
      for (const { tag } of txTags) {
        tagTotals[tag.id] ??= { name: tag.name, amount: 0, color: tag.color };
        tagTotals[tag.id].amount += tx.amount;
      }
    }
  }

  const categoryBreakdown = Object.values(tagTotals)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  async function handleExportJson() {
    const blob = new Blob([JSON.stringify({ transactions, accounts, totalIncome, totalExpenses }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fintrack-export-${format(now, "yyyy-MM-dd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("reports.title")}</h1>
        </div>
        <Button variant="outline" onClick={handleExportJson}>
          <Download className="w-4 h-4 mr-2" />
          {t("reports.exportJson")}
        </Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-1.5">
              <Label>{t("reports.from")}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("reports.to")}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard.totalIncome")}</p>
                <p className="text-lg font-bold text-emerald-500">
                  {formatCurrency(totalIncome)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard.totalExpenses")}</p>
                <p className="text-lg font-bold text-red-500">
                  {formatCurrency(totalExpenses)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("reports.netWorth")}</p>
                <p className="text-lg font-bold text-blue-500">
                  {formatCurrency(totalBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.incomeVsExpenses")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.categoryBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("common.noData")}</p>
              ) : (
                categoryBreakdown.map((cat) => {
                  const maxAmount = categoryBreakdown[0]?.amount ?? 1;
                  const pct = (cat.amount / maxAmount) * 100;
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-muted-foreground">{formatCurrency(cat.amount)}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
