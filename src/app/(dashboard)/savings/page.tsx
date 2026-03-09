"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, PiggyBank, MoreHorizontal, Pencil, Trash2, Sparkles, ArrowDownToLine } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon: string;
  color: string;
  monthlyContribution?: number;
}

const GOAL_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f97316",
  "#ec4899", "#06b6d4", "#84cc16", "#f59e0b",
];

const defaultForm = {
  name: "",
  targetAmount: "",
  currentAmount: "0",
  deadline: "",
  color: "#10b981",
  monthlyContribution: "",
};

export default function SavingsPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositAccountId, setDepositAccountId] = useState("");
  const [depositing, setDepositing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["savings"],
    queryFn: async () => {
      const res = await fetch("/api/savings");
      return res.json();
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      return res.json();
    },
    staleTime: 60000,
  });

  const goals: SavingsGoal[] = data?.goals ?? [];
  const accounts: { id: string; name: string; currency: string }[] = accountsData?.accounts ?? [];
  const primaryCurrency: string = accounts[0]?.currency ?? "RON";

  function openAdd() {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(goal: SavingsGoal) {
    setEditingId(goal.id);
    setForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      deadline: goal.deadline ? format(new Date(goal.deadline), "yyyy-MM-dd") : "",
      color: goal.color,
      monthlyContribution: String(goal.monthlyContribution ?? ""),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error(t("savings.nameRequired")); return; }
    if (!form.targetAmount || isNaN(parseFloat(form.targetAmount)) || parseFloat(form.targetAmount) <= 0) {
      toast.error(t("savings.invalidAmount")); return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/savings/${editingId}` : "/api/savings";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          targetAmount: parseFloat(form.targetAmount),
          currentAmount: parseFloat(form.currentAmount || "0"),
          monthlyContribution: form.monthlyContribution ? parseFloat(form.monthlyContribution) : undefined,
          deadline: form.deadline || undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || t("common.error"));
        return;
      }

      toast.success(editingId ? t("savings.updated") : t("savings.created"));
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["savings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeposit() {
    const amount = parseFloat(depositAmount);
    if (!depositGoal || !amount || isNaN(amount) || amount <= 0 || !depositAccountId) return;
    setDepositing(true);
    try { 
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          type: "EXPENSE",
          date: new Date().toISOString(),
          description: t("savings.depositDescription", { name: depositGoal.name }),
          bankAccountId: depositAccountId,
          tags: [],
        }),
      });
      if (!txRes.ok) { toast.error(t("common.error")); return; }
      const goalRes = await fetch(`/api/savings/${depositGoal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentAmount: depositGoal.currentAmount + amount }),
      });
      if (!goalRes.ok) { toast.error(t("common.error")); return; }

      toast.success(t("savings.deposited"));
      setDepositGoal(null);
      setDepositAmount("");
      queryClient.invalidateQueries({ queryKey: ["savings"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setDepositing(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/savings/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("savings.deleted"));
      queryClient.invalidateQueries({ queryKey: ["savings"] });
    } else {
      toast.error(t("common.error"));
    }
    setDeleteId(null);
  }

  function getMilestoneMessage(pct: number): string | null {
    if (pct >= 100) return "🎉 " + t("savings.milestones.100");
    if (pct >= 75 && pct < 76) return "🚀 " + t("savings.milestones.75");
    if (pct >= 50 && pct < 51) return "⚡ " + t("savings.milestones.50");
    if (pct >= 25 && pct < 26) return "✨ " + t("savings.milestones.25");
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("savings.title")}</h1>
          <p className="text-sm text-muted-foreground">{goals.length} {t("savings.count")}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t("savings.add")}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <PiggyBank className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{t("savings.noGoals")}</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              {t("savings.noGoalsDesc")}
            </p>
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 mr-2" />
              {t("savings.add")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            const milestone = getMilestoneMessage(pct);

            return (
              <Card key={goal.id} className="card-hover overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: goal.color }} />

                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{goal.name}</CardTitle>
                      {pct >= 100 && <Sparkles className="w-4 h-4 text-yellow-500" />}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(goal)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(goal.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {milestone && (
                    <div className="text-xs font-medium text-center py-1.5 px-3 rounded-lg bg-accent">
                      {milestone}
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-2xl font-bold">
                        {formatCurrency(goal.currentAmount, primaryCurrency)}
                      </span>
                      <span className="text-sm text-muted-foreground self-end">
                        {t("common.of")} {formatCurrency(goal.targetAmount, primaryCurrency)}
                      </span>
                    </div>
                    <div className="relative w-full bg-secondary rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: goal.color }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs font-medium" style={{ color: goal.color }}>
                        {pct.toFixed(0)}%
                      </span>
                      {goal.deadline && (
                        <span className="text-xs text-muted-foreground">
                          {t("savings.estimatedCompletion")}: {formatDate(goal.deadline)}
                        </span>
                      )}
                    </div>
                  </div>

                  {goal.monthlyContribution && (
                    <p className="text-xs text-muted-foreground">
                      {t("savings.monthlyContribution")}: {formatCurrency(goal.monthlyContribution!, primaryCurrency)}
                    </p>
                  )}

                  {pct < 100 && (
                    <Button
                      size="sm"
                      className="w-full"
                      style={{ backgroundColor: goal.color, color: "#fff" }}
                      onClick={() => { setDepositGoal(goal); setDepositAmount(""); setDepositAccountId(accounts[0]?.id ?? ""); }}
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />
                      {t("savings.addFunds")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("savings.edit") : t("savings.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("savings.name")}</Label>
              <Input
                placeholder={t("savings.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("savings.targetAmount")}</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.targetAmount}
                  onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("savings.currentAmount")}</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.currentAmount}
                  onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  {t("savings.deadline")}{" "}
                  <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
                </Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t("savings.monthly")}{" "}
                  <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
                </Label>
                <Input
                  type="number" step="0.01" min="0"
                  placeholder="0.00"
                  value={form.monthlyContribution}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyContribution: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("savings.color")}</Label>
              <div className="flex gap-2 flex-wrap">
                {GOAL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    className={cn(
                      "w-8 h-8 rounded-xl transition-transform",
                      form.color === color ? "scale-125 ring-2 ring-offset-2 ring-primary" : ""
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!depositGoal} onOpenChange={(open) => { if (!open) { setDepositGoal(null); setDepositAmount(""); setDepositAccountId(""); } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("savings.addFunds")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{depositGoal?.name}</p>
            <div className="space-y-1.5">
              <Label>{t("transactions.fromAccount")}</Label>
              <Select value={depositAccountId} onValueChange={setDepositAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("transactions.account")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("savings.depositAmount")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDeposit()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDepositGoal(null); setDepositAmount(""); setDepositAccountId(""); }}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleDeposit} disabled={depositing || !depositAmount || parseFloat(depositAmount) <= 0 || !depositAccountId}>
              {depositing ? t("common.loading") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("savings.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("savings.deleteConfirm")}</AlertDialogDescription>
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
