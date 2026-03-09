"use client";

import { useTranslations } from "next-intl";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

function CustomTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: { color } } = payload[0];
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-md">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-popover-foreground">{name}</span>
      </div>
      <p className="text-sm font-bold text-popover-foreground mt-0.5 pl-4">
        {formatCurrency(value, currency)}
      </p>
    </div>
  );
}

interface SpendingItem {
  tag: { id: string; name: string; color: string };
  amount: number;
}

interface SpendingByCategoryProps {
  data: SpendingItem[];
  currency?: string;
}

export function SpendingByCategory({
  data,
  currency = "RON",
}: SpendingByCategoryProps) {
  const t = useTranslations();

  const chartData = data.slice(0, 8).map((item) => ({
    name: `#${item.tag.name}`,
    value: item.amount,
    color: item.tag.color,
  }));

  const total = data.reduce((sum, item) => sum + item.amount, 0);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dashboard.spendingByCategory")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          {t("common.noData")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("dashboard.spendingByCategory")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={<CustomTooltip currency={currency} />}
              wrapperStyle={{ backgroundColor: "transparent", border: "none", boxShadow: "none", padding: 0 }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="text-center text-sm text-muted-foreground mt-1">
          {t("common.total")}: {formatCurrency(total, currency)}
        </div>
      </CardContent>
    </Card>
  );
}
