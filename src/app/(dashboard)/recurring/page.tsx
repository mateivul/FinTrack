"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  RefreshCw, Plus, Pencil, Trash2, Play, Pause, MoreHorizontal, Zap, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn, formatCurrency } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface RecurringRule {
  id: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  frequency: string;
  nextOccurrence: string;
  isActive: boolean;
  bankAccount: { id: string; name: string; currency: string; color: string };
  tags: Array<{ tag: Tag }>;
}

interface Account {
  id: string;
  name: string;
  currency: string;
  color: string;
}

const FREQUENCIES = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"] as const;

const defaultForm = {
  description: "",
  amount: "",
  type: "EXPENSE" as "INCOME" | "EXPENSE",
  frequency: "MONTHLY" as typeof FREQUENCIES[number],
  nextOccurrence: "",
  bankAccountId: "",
  tagIds: [] as string[],
};

export default function RecurringPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recurring"],
    queryFn: async () => {
      const res = await fetch("/api/recurring");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      return res.json();
    },
  });

  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
      return res.json();
    },
  });

  const rules: RecurringRule[] = data?.rules ?? [];
  const accounts: Account[] = accountsData?.accounts ?? [];
  const tags: Tag[] = tagsData?.tags ?? [];

  function openCreate() {
    setEditingId(null);
    setForm({
      ...defaultForm,
      bankAccountId: accounts[0]?.id ?? "",
      nextOccurrence: format(new Date(), "yyyy-MM-dd"),
    });
    setDialogOpen(true);
  }

  function openEdit(rule: RecurringRule) {
    setEditingId(rule.id);
    setForm({
      description: rule.description,
      amount: String(rule.amount),
      type: rule.type,
      frequency: rule.frequency as typeof FREQUENCIES[number],
      nextOccurrence: rule.nextOccurrence.substring(0, 10),
      bankAccountId: rule.bankAccount.id,
      tagIds: rule.tags.map((t) => t.tag.id),
    });
    setDialogOpen(true);
  }

  function toggleTag(tagId: string) {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId)
        ? f.tagIds.filter((id) => id !== tagId)
        : [...f.tagIds, tagId],
    }));
  }

  async function handleSave() {
    if (!form.description || !form.amount || !form.bankAccountId) {
      toast.error(t("transactions.requiredFields"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        description: form.description,
        amount: parseFloat(form.amount),
        type: form.type,
        frequency: form.frequency,
        nextOccurrence: form.nextOccurrence,
        bankAccountId: form.bankAccountId,
        tagIds: form.tagIds,
      };
      const url = editingId ? `/api/recurring/${editingId}` : "/api/recurring";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || t("common.error")); return; }
      toast.success(editingId ? t("recurring.updated") : t("recurring.created"));
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      setDialogOpen(false);
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(rule: RecurringRule) {
    const res = await fetch(`/api/recurring/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      toast.success(rule.isActive ? t("recurring.paused") : t("recurring.active"));
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/recurring/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("recurring.deleted"));
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    } else {
      toast.error(t("common.error"));
    }
    setDeleteId(null);
  }

  async function handleRunNow(rule: RecurringRule) {
    setRunning(rule.id);
    try {
      const res = await fetch(`/api/recurring/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || t("common.error")); return; }
      toast.success(t("recurring.runNowSuccess"));
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setRunning(null);
    }
  }

  const freqLabel = (f: string) =>
    t(`recurring.frequency.${f.toLowerCase()}` as Parameters<typeof t>[0]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("recurring.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {rules.length > 0
              ? t("recurring.activeCount", { count: rules.filter((r) => r.isActive).length })
              : t("recurring.noRecurringDesc")}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          {t("recurring.add")}
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      )}

      {!isLoading && rules.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <RefreshCw className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{t("recurring.noRecurring")}</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              {t("recurring.noRecurringDesc")}
            </p>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              {t("recurring.add")}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && rules.length > 0 && (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={cn("transition-opacity", !rule.isActive && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${rule.bankAccount.color}20` }}
                  >
                    <RefreshCw className="w-5 h-5" style={{ color: rule.bankAccount.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{rule.description}</p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs shrink-0",
                          rule.type === "INCOME"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}
                      >
                        {rule.type === "INCOME" ? t("transactions.income") : t("transactions.expense")}
                      </Badge>
                      {!rule.isActive && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {t("recurring.paused")}
                        </Badge>
                      )}
                      {rule.tags.map(({ tag }) => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          className="text-xs shrink-0 py-0 h-4"
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          #{tag.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span>{freqLabel(rule.frequency)}</span>
                      <span>·</span>
                      <span>{rule.bankAccount.name}</span>
                      <span>·</span>
                      <span>
                        {t("recurring.nextOccurrence")}:{" "}
                        <span className={cn(new Date(rule.nextOccurrence.substring(0, 10)) <= new Date() && rule.isActive && "text-orange-500 font-medium")}>
                          {format(new Date(rule.nextOccurrence.substring(0, 10) + "T12:00:00"), "dd MMM yyyy")}
                        </span>
                      </span>
                    </div>
                  </div>

                  <p className={cn(
                    "text-base font-bold shrink-0",
                    rule.type === "INCOME" ? "text-emerald-500" : "text-red-500"
                  )}>
                    {rule.type === "INCOME" ? "+" : "-"}
                    {formatCurrency(rule.amount, rule.bankAccount.currency)}
                  </p>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRunNow(rule)}
                      disabled={running === rule.id || !rule.isActive}
                      title={t("recurring.runNow")}
                      className="h-8 w-8 p-0"
                    >
                      {running === rule.id
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <Zap className="w-4 h-4" />}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(rule)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          {t("recurring.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(rule)}>
                          {rule.isActive
                            ? <><Pause className="w-4 h-4 mr-2" />{t("recurring.pause")}</>
                            : <><Play className="w-4 h-4 mr-2" />{t("recurring.resume")}</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(rule.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t("recurring.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("recurring.edit") : t("recurring.add")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("recurring.description")}</Label>
              <Input
                placeholder={t("recurring.descriptionPlaceholder")}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("recurring.amount")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("recurring.type")}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as "INCOME" | "EXPENSE" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">{t("transactions.expense")}</SelectItem>
                    <SelectItem value="INCOME">{t("transactions.income")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("recurring.frequency.label")}</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as typeof FREQUENCIES[number] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>{freqLabel(f)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("recurring.nextOccurrence")}</Label>
                <Input
                  type="date"
                  value={form.nextOccurrence}
                  onChange={(e) => setForm((f) => ({ ...f, nextOccurrence: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("recurring.account")}</Label>
              <Select
                value={form.bankAccountId}
                onValueChange={(v) => setForm((f) => ({ ...f, bankAccountId: v }))}
              >
                <SelectTrigger><SelectValue placeholder={t("transactions.account")} /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tags.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("transactions.tags")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const selected = form.tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                          selected
                            ? "border-transparent"
                            : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                        )}
                        style={selected ? {
                          backgroundColor: `${tag.color}20`,
                          borderColor: tag.color,
                          color: tag.color,
                        } : undefined}
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("recurring.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("recurring.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t("recurring.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
