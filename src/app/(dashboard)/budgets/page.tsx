"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Target, MoreHorizontal, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, getProgressColor } from "@/lib/utils";

interface Budget {
  id: string;
  name: string;
  amount: number;
  currentSpent: number;
  period: string;
  alertThreshold: number;
  tagId: string | null;
  tag: { id: string; name: string; color: string } | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

const defaultForm = {
  name: "",
  tagId: "",
  amount: "",
  period: "MONTHLY" as const,
  alertThreshold: 0.8,
  rollover: false,
};

export default function BudgetsPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const res = await fetch("/api/budgets");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
      return res.json();
    },
  });

  const budgets: Budget[] = data?.budgets ?? [];
  const tags: Tag[] = tagsData?.tags ?? [];

  function openAdd() {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(budget: Budget) {
    setEditingId(budget.id);
    setForm({
      name: budget.name,
      tagId: budget.tagId ?? "",
      amount: String(budget.amount),
      period: budget.period as "MONTHLY",
      alertThreshold: budget.alertThreshold,
      rollover: false,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Budget name is required"); return; }
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) {
      toast.error("Please enter a valid amount"); return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/budgets/${editingId}` : "/api/budgets";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tagId: form.tagId || undefined,
          amount: parseFloat(form.amount),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || t("common.error"));
        return;
      }

      toast.success(editingId ? "Budget updated!" : "Budget created!");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/budgets/${id}`, { method: "DELETE" });
    toast.success("Budget deleted");
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    setDeleteId(null);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("budgets.title")}</h1>
          <p className="text-sm text-muted-foreground">{budgets.length} budgets</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t("budgets.add")}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <Target className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{t("budgets.noBudgets")}</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              {t("budgets.noBudgetsDesc")}
            </p>
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 mr-2" />
              {t("budgets.add")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgets.map((budget) => {
            const pct = Math.min((budget.currentSpent / budget.amount) * 100, 100);
            const isOverAlert = pct >= budget.alertThreshold * 100;
            const isOver = pct >= 100;

            return (
              <Card key={budget.id} className="card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {budget.tag && (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: budget.tag.color }}
                        />
                      )}
                      <div>
                        <CardTitle className="text-base">{budget.name}</CardTitle>
                        {budget.tag && (
                          <p className="text-xs text-muted-foreground">#{budget.tag.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isOver && <AlertTriangle className="w-4 h-4 text-red-500" />}
                      {isOverAlert && !isOver && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(budget)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(budget.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className={cn("font-semibold", isOver ? "text-red-500" : "text-foreground")}>
                      {formatCurrency(budget.currentSpent)} {t("budgets.spent")}
                    </span>
                    <span className="text-muted-foreground">
                      of {formatCurrency(budget.amount)}
                    </span>
                  </div>

                  <div className="w-full bg-secondary rounded-full h-3">
                    <div
                      className={cn("h-3 rounded-full transition-all duration-500", getProgressColor(pct))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{pct.toFixed(0)}% used</span>
                    {isOver ? (
                      <span className="text-red-500 font-medium">{t("budgets.over")}</span>
                    ) : (
                      <span>{formatCurrency(budget.amount - budget.currentSpent)} {t("budgets.remaining")}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("budgets.edit") : t("budgets.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("budgets.name")}</Label>
              <Input
                placeholder={t("budgets.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Tag{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select
                value={form.tagId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, tagId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All transactions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All transactions</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        #{tag.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("budgets.amount")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("budgets.period.label")}</Label>
                <Select value={form.period} onValueChange={(v) => setForm((f) => ({ ...f, period: v as "MONTHLY" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">{t("budgets.period.weekly")}</SelectItem>
                    <SelectItem value="MONTHLY">{t("budgets.period.monthly")}</SelectItem>
                    <SelectItem value="YEARLY">{t("budgets.period.yearly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>{t("budgets.alertThreshold")}</Label>
                <span className="text-sm font-medium">{Math.round(form.alertThreshold * 100)}%</span>
              </div>
              <Slider
                min={50}
                max={100}
                step={5}
                value={[form.alertThreshold * 100]}
                onValueChange={([v]) => setForm((f) => ({ ...f, alertThreshold: v / 100 }))}
              />
              <p className="text-xs text-muted-foreground">{t("budgets.alertDesc")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("budgets.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("budgets.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
