"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { History, CheckCircle2, Clock, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ImportHistoryItem {
  id: string;
  fileName: string;
  fileType: string;
  bankName: string | null;
  transactionsImported: number;
  transactionsSkipped: number;
  status: "PROCESSING" | "REVIEW" | "COMPLETED" | "FAILED";
  createdAt: string;
  statementFrom: string | null;
  statementTo: string | null;
}

function StatusBadge({ status, t }: { status: ImportHistoryItem["status"]; t: ReturnType<typeof useTranslations> }) {
  if (status === "COMPLETED") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        {t("importHistory.statusCompleted")}
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-1">
        <XCircle className="w-3 h-3" />
        {t("importHistory.statusFailed")}
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
      <Clock className="w-3 h-3" />
      {status === "REVIEW" ? t("importHistory.statusReview") : t("importHistory.statusProcessing")}
    </Badge>
  );
}

export default function ImportHistoryPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["import-history"],
    queryFn: async () => {
      const res = await fetch("/api/import/history");
      return res.json();
    },
  });

  const history: ImportHistoryItem[] = data?.history ?? [];

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/import/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("importHistory.deleted"));
        queryClient.invalidateQueries({ queryKey: ["import-history"] });
      } else {
        toast.error(t("common.error"));
      }
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <History className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("importHistory.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("importHistory.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("importHistory.recent")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {t("importHistory.noHistory")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.bankName ?? t("importHistory.unknownBank")} &middot; {format(new Date(item.createdAt), "dd MMM yyyy, HH:mm")}
                    </p>
                    {item.statementFrom && item.statementTo && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(item.statementFrom), "dd MMM yyyy")} — {format(new Date(item.statementTo), "dd MMM yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        +{item.transactionsImported} {t("importHistory.imported")}
                      </p>
                      {item.transactionsSkipped > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {item.transactionsSkipped} {t("importHistory.skipped")}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={item.status} t={t} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmId(item.id)}
                      disabled={deletingId === item.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("importHistory.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("importHistory.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmId && handleDelete(confirmId)}
            >
              {t("importHistory.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
