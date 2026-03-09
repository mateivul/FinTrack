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
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

const CURRENCIES = ["RON", "EUR", "USD", "GBP", "CHF", "HUF"];

const ACCOUNT_COLORS = [
  "#3b82f6", "#10b981", "#f97316", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f59e0b",
  "#ef4444", "#6b7280",
];

const ACCOUNT_TYPES = [
  { value: "CASH",       labelKey: "accounts.types.cash",       icon: Banknote,   color: "#10b981" },
  { value: "CARD",       labelKey: "accounts.types.card",       icon: CreditCard, color: "#3b82f6" },
  { value: "SAVINGS",    labelKey: "accounts.types.savings",    icon: PiggyBank,  color: "#f59e0b" },
  { value: "INVESTMENT", labelKey: "accounts.types.investment", icon: TrendingUp, color: "#8b5cf6" },
  { value: "LOAN",       labelKey: "accounts.types.loan",       icon: Landmark,   color: "#ef4444" },
  { value: "INSURANCE",  labelKey: "accounts.types.insurance",  icon: Shield,     color: "#06b6d4" },
  { value: "OTHER",      labelKey: "accounts.types.other",      icon: Wallet,     color: "#6b7280" },
] as const;

function getAccountTypeConfig(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[6];
}

interface AccountFormData {
  name: string;
  bankName: string;
  currency: string;
  color: string;
  currentBalance: number;
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
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountFormData>({ name: "", bankName: "", currency: "RON", color: "#3b82f6", currentBalance: 0 });
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
      toast.error(t("transactions.requiredFields"));
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

      toast.success(editingId ? t("transactions.updated") : t("transactions.added"));
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
      toast.success(t("transactions.deleted"));
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account", id] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } else {
      toast.error(t("common.error"));
    }
    setDeleteId(null);
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("accounts.deleted"));
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        router.push("/accounts");
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t("common.error"));
      }
    } finally {
      setDeletingAccount(false);
      setDeleteAccountOpen(false);
    }
  }

  function openEditAccount() {
    if (!account) return;
    setAccountForm({
      name: account.name,
      bankName: account.bankName ?? "",
      currency: account.currency,
      color: account.color,
      currentBalance: account.currentBalance,
    });
    setEditAccountOpen(true);
  }

  async function handleSaveAccount() {
    if (!accountForm.name.trim()) { toast.error(t("accounts.nameRequired")); return; }
    setSavingAccount(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountForm),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t("common.error"));
        return;
      }
      toast.success(t("accounts.updated"));
      setEditAccountOpen(false);
      queryClient.invalidateQueries({ queryKey: ["account", id] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setSavingAccount(false);
    }
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
        toast.error(d.error || t("transactions.couldNotCreateTag"));
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
      <div className="space-y-4">
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
          {t("common.back")}
        </Button>
        <p className="text-muted-foreground">{t("accounts.notFound")}</p>
      </div>
    );
  }

  const typeConfig = getAccountTypeConfig(account.accountType);
  const Icon = typeConfig.icon;

  return (
    <div className="space-y-4">
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
                  <span className="text-sm text-muted-foreground">{t(typeConfig.labelKey as Parameters<typeof t>[0])}</span>
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
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {formatCurrency(account.currentBalance, account.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {txData?.total ?? "—"} {t("accounts.transactions")}
                </p>
              </div>
              <div className="border-l border-border pl-4">
                <Button variant="outline" size="sm" onClick={openEditAccount} className="h-8">
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  {t("common.edit")}
                </Button>
              </div>
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
            {t("common.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("common.page", { page, total: totalPages })}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            {t("common.next")}
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
              <Label>{t("transactions.time")}</Label>
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
              <Label>{t("transactions.tags")}</Label>
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
                <p className="text-xs text-muted-foreground">{t("tags.noTagsDesc")}</p>
              )}
              <div className="flex gap-1.5 mt-1">
                <Input
                  placeholder={t("import.tagPlaceholder")}
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
                  {t("common.add")}
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

      <Dialog open={editAccountOpen} onOpenChange={setEditAccountOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("accounts.edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("accounts.name")}</Label>
                <Input
                  placeholder={t("accounts.namePlaceholder")}
                  value={accountForm.name}
                  onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("accounts.currency")}</Label>
                <Select
                  value={accountForm.currency}
                  onValueChange={(v) => setAccountForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                {t("accounts.bankName")}{" "}
                <span className="text-muted-foreground font-normal">({t("common.optional")})</span>
              </Label>
              <Input
                placeholder={t("accounts.bankNamePlaceholder")}
                value={accountForm.bankName}
                onChange={(e) => setAccountForm((f) => ({ ...f, bankName: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("accounts.currentBalance")}</Label>
              <Input
                type="number"
                step="0.01"
                value={accountForm.currentBalance}
                onChange={(e) => setAccountForm((f) => ({ ...f, currentBalance: parseFloat(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3 h-3 shrink-0" />
                {t("accounts.balanceAdjustInfo")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("accounts.color")}</Label>
              <div className="flex gap-2 flex-wrap">
                {ACCOUNT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccountForm((f) => ({ ...f, color }))}
                    className={cn(
                      "w-7 h-7 rounded-lg transition-transform",
                      accountForm.color === color && "scale-125 ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row items-center">
            <Button
              variant="ghost"
              className="mr-auto text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => { setEditAccountOpen(false); setDeleteAccountOpen(true); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("accounts.delete")}
            </Button>
            <Button variant="outline" onClick={() => setEditAccountOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveAccount} disabled={savingAccount}>
              {savingAccount ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accounts.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("accounts.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount ? t("common.loading") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
