"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
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
  CheckSquare,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
import { formatCurrency, formatDate, formatTime, getTransactionTypeColor, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

interface Transaction {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  date: string;
  description: string;
  notes?: string;
  source: string;
  bankAccount: { id: string; name: string; currency: string; color: string };
  toAccount?: { id: string; name: string; currency: string; color: string } | null;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Account {
  id: string;
  name: string;
  currency: string;
}

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

interface FormState {
  amount: string;
  type: TxType;
  date: string;
  time: string;
  description: string;
  notes: string;
  bankAccountId: string;
  toAccountId: string;
  tagIds: string[];
}

const defaultForm: FormState = {
  amount: "",
  type: "EXPENSE",
  date: format(new Date(), "yyyy-MM-dd"),
  time: format(new Date(), "HH:mm"),
  description: "",
  notes: "",
  bankAccountId: "",
  toAccountId: "",
  tagIds: [],
};

export default function TransactionsPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tagIdFilter, setTagIdFilter] = useState(() => searchParams.get("tagId") ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [descSuggestions, setDescSuggestions] = useState<string[]>([]);
  const [showDescSuggestions, setShowDescSuggestions] = useState(false);
  const descDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleDescriptionChange(value: string) {
    setForm((f) => ({ ...f, description: value }));
    if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
    if (!value.trim()) {
      setDescSuggestions([]);
      setShowDescSuggestions(false);
      return;
    }
    descDebounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/transactions/descriptions?q=${encodeURIComponent(value)}`);
      if (res.ok) {
        const { descriptions } = await res.json();
        setDescSuggestions(descriptions);
        setShowDescSuggestions(descriptions.length > 0);
      }
    }, 250);
  }

  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setEditingId(null);
      setForm({ ...defaultForm });
      setNewTagName("");
      setDialogOpen(true);
      router.replace("/transactions");
    }
  }, [searchParams, router]);

  useEffect(() => {
    const tagId = searchParams.get("tagId");
    if (tagId) {
      setTagIdFilter(tagId);
      setPage(1);
    }
  }, [searchParams]);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: "30",
    ...(search && { search }),
    ...(typeFilter !== "all" && { type: typeFilter }),
    ...(tagIdFilter && { tagId: tagIdFilter }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", page, search, typeFilter, tagIdFilter, dateFrom, dateTo],
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

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const transactions: Transaction[] = data?.transactions ?? [];
  const tags: Tag[] = tagsData?.tags ?? [];
  const accounts: Account[] = accountsData?.accounts ?? [];
  const totalPages = data?.totalPages ?? 1;

  function openAdd() {
    setEditingId(null);
    setForm({ ...defaultForm, bankAccountId: accounts[0]?.id ?? "" });
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
      bankAccountId: tx.bankAccount.id,
      toAccountId: tx.toAccount?.id ?? "",
      tagIds: tx.tags.map((t) => t.tag.id),
    });
    setNewTagName("");
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

  const handleSave = useCallback(async () => {
    if (!form.amount || !form.bankAccountId) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.type === "TRANSFER" && !form.toAccountId) {
      toast.error("Please select a destination account for the transfer");
      return;
    }
    if (form.type === "TRANSFER" && form.toAccountId === form.bankAccountId) {
      toast.error("Source and destination accounts must be different");
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
          bankAccountId: form.bankAccountId,
          toAccountId: form.type === "TRANSFER" ? form.toAccountId : undefined,
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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    } finally {
      setSaving(false);
    }
  }, [form, editingId, queryClient, t]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Transaction deleted");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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

  function toggleSelectMode() {
    setSelectMode((s) => !s);
    setSelectedIds(new Set());
    setSelectAllFiltered(false);
  }

  function toggleSelectId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectAllFiltered(false);
  }

  function toggleSelectAll() {
    if (selectedIds.size === transactions.length && transactions.length > 0) {
      setSelectedIds(new Set());
      setSelectAllFiltered(false);
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      const body = selectAllFiltered
        ? {
            all: true,
            ...(typeFilter !== "all" && { type: typeFilter }),
            ...(search && { search }),
            ...(tagIdFilter && { tagId: tagIdFilter }),
          }
        : { ids: Array.from(selectedIds) };

      const res = await fetch("/api/transactions/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || t("common.error"));
        return;
      }

      toast.success(`${result.deleted} transaction${result.deleted !== 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      setSelectMode(false);
      setSelectAllFiltered(false);
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setBulkDeleting(false);
    }
  }

  const deleteCount = selectAllFiltered ? (data?.total ?? 0) : selectedIds.size;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("transactions.title")}</h1>
          {data?.total !== undefined && (
            <p className="text-sm text-muted-foreground">{data.total} total</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant={selectMode ? "secondary" : "outline"} onClick={toggleSelectMode}>
            <CheckSquare className="w-4 h-4 mr-2" />
            {selectMode ? "Cancel" : "Select"}
          </Button>
          {!selectMode && (
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 mr-2" />
              {t("transactions.add")}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search") + "..."}
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

            <Select
              value={typeFilter}
              onValueChange={(v) => { setTypeFilter(v); setPage(1); }}
            >
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

            <Input
              type="date"
              className="w-36"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              title={t("transactions.filters.dateFrom")}
            />
            <Input
              type="date"
              className="w-36"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              title={t("transactions.filters.dateTo")}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                className="text-muted-foreground hover:text-foreground"
                title={t("transactions.filters.clearFilters")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardHeader>
      </Card>

      {tagIdFilter && (() => {
        const activeTag = tags.find((t) => t.id === tagIdFilter);
        if (!activeTag) return null;
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtered by tag:</span>
            <button
              onClick={() => { setTagIdFilter(""); setPage(1); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors hover:opacity-80"
              style={{
                backgroundColor: `${activeTag.color}20`,
                borderColor: activeTag.color,
                color: activeTag.color,
              }}
            >
              #{activeTag.name}
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })()}

      {selectMode && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-accent/60 rounded-xl border border-border">
          <Checkbox
            checked={selectedIds.size > 0 && selectedIds.size === transactions.length}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium">
            {selectAllFiltered
              ? `All ${data?.total} transactions selected`
              : selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : "Select transactions"}
          </span>
          {selectedIds.size === transactions.length && transactions.length > 0 && (data?.total ?? 0) > transactions.length && !selectAllFiltered && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setSelectAllFiltered(true)}
            >
              Select all {data?.total} transactions
            </button>
          )}
          {(selectedIds.size > 0 || selectAllFiltered) && (
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete {selectAllFiltered ? `all ${data?.total}` : selectedIds.size}
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
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
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors group",
                    selectMode ? "cursor-pointer" : "hover:bg-accent/30",
                    selectedIds.has(tx.id) && "bg-accent/60"
                  )}
                  onClick={selectMode ? () => toggleSelectId(tx.id) : undefined}
                >
                  {selectMode && (
                    <Checkbox
                      checked={selectedIds.has(tx.id)}
                      onCheckedChange={() => toggleSelectId(tx.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                  )}

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
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          #{tag.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.date)}
                        {formatTime(tx.date) && ` · ${formatTime(tx.date)}`}
                        {tx.type === "TRANSFER" && tx.toAccount
                          ? ` · ${tx.bankAccount.name} → ${tx.toAccount.name}`
                          : ` · ${tx.bankAccount.name}`}
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
                    {formatCurrency(tx.amount, tx.bankAccount.currency)}
                  </p>

                  {!selectMode && <DropdownMenu>
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
                  </DropdownMenu>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
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
              <Label>{t("transactions.description")}</Label>
              <div className="relative">
                <Input
                  placeholder={t("transactions.descriptionPlaceholder")}
                  value={form.description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  onFocus={() => descSuggestions.length > 0 && setShowDescSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDescSuggestions(false), 150)}
                  autoComplete="off"
                />
                {showDescSuggestions && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
                    {descSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setForm((f) => ({ ...f, description: s }));
                          setShowDescSuggestions(false);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {form.type === "TRANSFER" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>From Account *</Label>
                  <Select
                    value={form.bankAccountId}
                    onValueChange={(v) => setForm((f) => ({ ...f, bankAccountId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="From..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>To Account *</Label>
                  <Select
                    value={form.toAccountId}
                    onValueChange={(v) => setForm((f) => ({ ...f, toAccountId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="To..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((a) => a.id !== form.bankAccountId)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>{t("transactions.account")} *</Label>
                <Select
                  value={form.bankAccountId}
                  onValueChange={(v) => setForm((f) => ({ ...f, bankAccountId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              ) : (
                <p className="text-xs text-muted-foreground">
                  No tags yet. Create one below or visit the{" "}
                  <a href="/tags" className="text-primary hover:underline">Tags page</a>.
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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteCount} transaction{deleteCount !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteCount} transaction{deleteCount !== 1 ? "s" : ""} and
              reverse their effect on account balances. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? "Deleting..." : `Delete ${deleteCount}`}
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
