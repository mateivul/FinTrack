"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Target, MoreHorizontal, Pencil, Trash2, AlertTriangle, Share2, Users, Check, X } from "lucide-react";
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
  rollover: boolean;
  rolloverAmount: number;
  effectiveAmount: number;
  period: string;
  alertThreshold: number;
  tagId: string | null;
  tag: { id: string; name: string; color: string } | null;
  userId: string;
  sharedWith: { userId: string; user: { id: string; name: string; email: string } }[];
}

interface Invite {
  id: string;
  invitedEmail: string;
  budget: { id: string; name: string; amount: number; period: string };
  inviter: { name: string; email: string };
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
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharing, setSharing] = useState(false);

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

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: meData } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: invitesData, refetch: refetchInvites } = useQuery({
    queryKey: ["invites"],
    queryFn: async () => {
      const res = await fetch("/api/invites");
      return res.json();
    },
  });

  const budgets: Budget[] = data?.budgets ?? [];
  const tags: Tag[] = tagsData?.tags ?? [];
  const primaryCurrency: string = accountsData?.accounts?.[0]?.currency ?? "RON";
  const currentUserId: string = meData?.id ?? meData?.user?.id ?? "";
  const pendingInvites: Invite[] = invitesData?.invites ?? [];
  const shareBudget = budgets.find((b) => b.id === shareId);

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
      rollover: budget.rollover,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error(t("budgets.nameRequired")); return; }
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) {
      toast.error(t("budgets.invalidAmount")); return;
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
          tagId: form.tagId || null,
          amount: parseFloat(form.amount),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || t("common.error"));
        return;
      }

      toast.success(editingId ? t("budgets.updated") : t("budgets.created"));
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("budgets.deleted"));
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    } else {
      toast.error(t("common.error"));
    }
    setDeleteId(null);
  }

  async function handleInvite() {
    if (!shareId || !shareEmail.trim()) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/budgets/${shareId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: shareEmail.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        const key = res.status === 400 && d.error?.includes("yourself")
          ? "budgets.inviteSelf"
          : res.status === 409 && d.error?.includes("member")
          ? "budgets.alreadyMember"
          : res.status === 409
          ? "budgets.inviteAlreadySent"
          : "common.error";
        toast.error(t(key as Parameters<typeof t>[0]));
      } else {
        toast.success(t("budgets.inviteSuccess"));
        setShareEmail("");
        queryClient.invalidateQueries({ queryKey: ["budgets"] });
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleRemoveMember(budgetId: string, memberId: string) {
    await fetch(`/api/budgets/${budgetId}/invite`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: memberId }),
    });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
  }

  async function handleInviteResponse(inviteId: string, action: "accept" | "reject") {
    const res = await fetch(`/api/invites/${inviteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      refetchInvites();
      if (action === "accept") queryClient.invalidateQueries({ queryKey: ["budgets"] });
    } else {
      toast.error(t("common.error"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("budgets.title")}</h1>
          <p className="text-sm text-muted-foreground">{budgets.length} {t("budgets.count")}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t("budgets.add")}
        </Button>
      </div>

      {pendingInvites.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              {t("budgets.pendingInvites")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background border">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{invite.budget.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.inviter.name} {t("budgets.invitedBy")}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleInviteResponse(invite.id, "accept")}>
                    <Check className="w-3 h-3 mr-1" />
                    {t("budgets.accept")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleInviteResponse(invite.id, "reject")}>
                    <X className="w-3 h-3 mr-1" />
                    {t("budgets.reject")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
            const effective = budget.effectiveAmount ?? budget.amount;
            const pct = Math.min((budget.currentSpent / effective) * 100, 100);
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
                          {budget.userId === currentUserId && (
                            <DropdownMenuItem onClick={() => { setShareId(budget.id); setShareEmail(""); }}>
                              <Share2 className="w-4 h-4 mr-2" />
                              {t("budgets.share")}
                            </DropdownMenuItem>
                          )}
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
                      {formatCurrency(budget.currentSpent, primaryCurrency)} {t("budgets.spent")}
                    </span>
                    <span className="text-muted-foreground">
                      {t("common.of")} {formatCurrency(effective, primaryCurrency)}
                    </span>
                  </div>

                  <div className="w-full bg-secondary rounded-full h-3">
                    <div
                      className={cn("h-3 rounded-full transition-all duration-500", getProgressColor(pct))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{pct.toFixed(0)}{t("budgets.pctUsed")}</span>
                    {isOver ? (
                      <span className="text-red-500 font-medium">{t("budgets.over")}</span>
                    ) : (
                      <span>{formatCurrency(effective - budget.currentSpent, primaryCurrency)} {t("budgets.remaining")}</span>
                    )}
                  </div>
                  {budget.rollover && budget.rolloverAmount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      +{formatCurrency(budget.rolloverAmount, primaryCurrency)} {t("budgets.rolloverFrom")}
                    </p>
                  )}
                  {budget.sharedWith.length > 0 && (
                    <div className="flex items-center gap-1 pt-1">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {budget.sharedWith.map((s) => s.user.name).join(", ")}
                      </span>
                    </div>
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
                {t("transactions.tags")}{" "}
                <span className="text-muted-foreground font-normal">({t("common.optional")})</span>
              </Label>
              <Select
                value={form.tagId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, tagId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("budgets.allTransactions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("budgets.allTransactions")}</SelectItem>
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

      <Dialog open={!!shareId} onOpenChange={(o) => !o && setShareId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              {t("budgets.share")} — {shareBudget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {shareBudget && shareBudget.sharedWith.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("budgets.members")}</Label>
                <div className="space-y-1">
                  {shareBudget.sharedWith.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                      <div>
                        <p className="text-sm font-medium">{m.user.name}</p>
                        <p className="text-xs text-muted-foreground">{m.user.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-7"
                        onClick={() => shareId && handleRemoveMember(shareId, m.userId)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t("budgets.inviteEmail")}</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                />
                <Button onClick={handleInvite} disabled={sharing || !shareEmail.trim()}>
                  {sharing ? t("common.loading") : t("common.add")}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareId(null)}>{t("common.close")}</Button>
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
