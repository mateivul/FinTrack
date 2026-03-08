"use client";

import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function RecurringPage() {
  const t = useTranslations();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("recurring.title")}</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
            <RefreshCw className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-semibold text-lg mb-1">{t("recurring.noRecurring")}</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t("recurring.noRecurringDesc")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
