"use client";

import { useState, useCallback, use } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  X,
  Check,
  Banknote,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Landmark,
  Shield,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCurrency,
  formatDate,
  formatTime,
  getTransactionTypeColor,
  cn,
} from "@/lib/utils";

const ACCOUNT_TYPES = [
  { value: "CASH",       label: "Cash",       icon: Banknote,   color: "#10b981" },
  { value: "CARD",       label: "Card",       icon: CreditCard, color: "#3b82f6" },
  { value: "SAVINGS",    label: "Savings",    icon: PiggyBank,  color: "#f59e0b" },
  { value: "INVESTMENT", label: "Investment", icon: TrendingUp, color: "#8b5cf6" },
  { value: "LOAN",       label: "Loan",       icon: Landmark,   color: "#ef4444" },
  { value: "INSURANCE",  label: "Insurance",  icon: Shield,     color: "#06b6d4" },
  { value: "OTHER",      label: "Other",      icon: Wallet,     color: "#6b7280" },
] as const;

function getAccountTypeConfig(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[6];
}

interface Account {
  id: string;
  name: string;
  accountType: string;
  bankName?: string;
  currency: string;
  color: string;
  currentBalance: number;
  _count?: { transactions: number };
}

interface Transaction {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  date: string;
  description: string;
  notes?: string;
  source: string;
  bankAccount: { id: string; name: string; currency: string; color: string };
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

interface FormState {
  amount: string;
  type: TxType;
  date: string;
  time: string;
  description: string;
  notes: string;
  tagIds: string[];
}

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  const defaultForm: FormState = {
    amount: "",
    type: "EXPENSE",
    date: format(new Date(), "yyyy-MM-dd"),
    time: format(new Date(), "HH:mm"),
    description: "",
    notes: "",
    tagIds: [],
  };
  const [form, setForm] = useState<FormState>(defaultForm);

  const { data: accountData, isLoading: accountLoading } = useQuery({
    queryKey: ["account", id],
    queryFn: async () => {
      const res = await fetch(`/api/accounts/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: "30",
    accountId: id,
    ...(search && { search }),
    ...(typeFilter !== "all" && { type: typeFilter }),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["transactions", "account", id, page, search, typeFilter],
    queryFn: async () => {
      const res = await fetch(`/api/transactions?${queryParams}`);
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

  const account: Account | undefined = accountData?.account;
  const transactions: Transaction[] = txData?.transactions ?? [];
  const tags: Tag[] = tagsData?.tags ?? [];
  const totalPages = txData?.totalPages ?? 1;

  function openAdd() {
    setEditingId(null);
    setForm({ ...defaultForm });
    setNewTagName("");
    setDialogOpen(true);
  }

  function openEdit(tx: Transaction) {
    setEditingId(tx.id);
    const txDate = new Date(tx.date);
    setForm({
      amount: String(tx.amount),
      type: tx.type,
      date: format(txDate, "yyyy-MM-dd"),
      time: format(txDate, "HH:mm"),
      description: tx.description,
      notes: tx.notes ?? "",
      tagIds: tx.tags.map((t) => t.tag.id),
    });
    setNewTagName("");
    setDialogOpen(true);
  }

  function toggleTag(tagId: string) {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId)
        ? f.tagIds.filter((i) => i !== tagId)
        : [...f.tagIds, tagId],
    }));
  }

  const handleSave = useCallback(async () => {
    if (!form.amount || !form.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/transactions/${editingId}` : "/api/transactions";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          type: form.type,
          date: `${form.date}T${form.time || "00:00"}`,
          description: form.description,
          notes: form.notes || undefined,
          bankAccountId: id,
          tags: form.tagIds,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t("common.error"));
        return;
      }

      toast.success(editingId ? "Transaction updated!" : "Transaction added!");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account", id] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setSaving(false);
    }
  }, [form, editingId, id, queryClient, t]);

  async function handleDelete(txId: string) {
    const res = await fetch(`/api/transactions/${txId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Transaction deleted");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account", id] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } else {
      toast.error(t("common.error"));
    }
    setDeleteId(null);
  }

  async function createTagInline() {
    const name = newTagName.trim().toLowerCase();
    if (!name) return;
    setCreatingTag(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: "#6b7280" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Could not create tag");
        return;
      }
      const { tag } = await res.json();
      queryClient.setQueryData(["tags"], (old: { tags: Tag[] } | undefined) => ({
        tags: [...(old?.tags ?? []), tag].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      setForm((f) => ({ ...f, tagIds: [...f.tagIds, tag.id] }));
      setNewTagName("");
    } finally {
      setCreatingTag(false);
    }
  }

  if (accountLoading) {
    return (
      <div className="max-w-5xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-5xl">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <p className="text-muted-foreground">Account not found.</p>
      </div>
    );
  }

  const typeConfig = getAccountTypeConfig(account.accountType);
  const Icon = typeConfig.icon;

  return (
    <div className="max-w-5xl space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="-ml-2"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        {t("common.back")}
      </Button>

      <Card className="relative overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${account.color}25` }}
              >
                <Icon className="w-7 h-7" style={{ color: account.color }} />
              </div>
              <div>
                <h1 className="text-xl font-bold">{account.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-muted-foreground">{typeConfig.label}</span>
                  {account.bankName && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground">{account.bankName}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">{account.currency}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {formatCurrency(account.currentBalance, account.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {txData?.total ?? "—"} transactions
              </p>
            </div>
          </div>
        </CardContent>
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: account.color }}
        />
      </Card>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={`${t("common.search")}...`}
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("transactions.filters.all")}</SelectItem>
            <SelectItem value="INCOME">{t("transactions.income")}</SelectItem>
            <SelectItem value="EXPENSE">{t("transactions.expense")}</SelectItem>
            <SelectItem value="TRANSFER">{t("transactions.transfer")}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t("transactions.add")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {txLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ArrowLeftRight className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-medium">{t("transactions.noTransactions")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("transactions.noTransactionsDesc")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      tx.type === "INCOME"
                        ? "bg-emerald-100 dark:bg-emerald-900/30"
                        : tx.type === "TRANSFER"
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-red-100 dark:bg-red-900/30"
                    )}
                  >
                    {tx.type === "INCOME" ? (
                      <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                    ) : tx.type === "TRANSFER" ? (
                      <ArrowLeftRight className="w-5 h-5 text-blue-500" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-red-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      {tx.tags.map(({ tag }) => (
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.date)}
                        {formatTime(tx.date) && ` · ${formatTime(tx.date)}`}
                      </p>
                      <Badge variant="secondary" className="text-xs py-0 h-4">
                        {t(`transactions.source.${tx.source.toLowerCase()}` as Parameters<typeof t>[0])}
                      </Badge>
                    </div>
                  </div>

                  <p
                    className={cn(
                      "text-sm font-bold shrink-0",
                      getTransactionTypeColor(tx.type)
                    )}
                  >
                    {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                    {formatCurrency(tx.amount, account.currency)}
                  </p>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(tx)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        {t("common.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(tx.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("transactions.edit") : t("transactions.add")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("transactions.type")}</Label>
              <div className="flex gap-2">
                {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((type) => (
                  <Button
                    key={type}
                    variant={form.type === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, type }))}
                    className={cn(
                      "flex-1",
                      form.type === type && type === "EXPENSE" && "bg-red-500 hover:bg-red-600",
                      form.type === type && type === "INCOME" && "bg-emerald-500 hover:bg-emerald-600",
                      form.type === type && type === "TRANSFER" && "bg-blue-500 hover:bg-blue-600"
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
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("transactions.date")} *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("transactions.description")} *</Label>
              <Input
                placeholder={t("transactions.descriptionPlaceholder")}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              {tags.length > 0 ? (
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
              ) : (
                <p className="text-xs text-muted-foreground">
                  No tags yet. <a href="/tags" className="text-primary hover:underline">Create tags</a> to organize transactions.
                </p>
              )}
              <div className="flex gap-1.5 mt-1">
                <Input
                  placeholder="New tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createTagInline())}
                  className="h-7 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs shrink-0"
                  onClick={createTagInline}
                  disabled={creatingTag || !newTagName.trim()}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("transactions.notes")}</Label>
              <Textarea
                placeholder={t("transactions.notesPlaceholder")}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("transactions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("transactions.deleteConfirm")}</AlertDialogDescription>
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
