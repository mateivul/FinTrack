"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Banknote,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Landmark,
  Shield,
  Wallet,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const CURRENCIES = ["RON", "EUR", "USD", "GBP", "CHF", "HUF"];

const ACCOUNT_TYPES = [
  { value: "CASH",       label: "Cash",       icon: Banknote,   color: "#10b981" },
  { value: "CARD",       label: "Card",       icon: CreditCard, color: "#3b82f6" },
  { value: "SAVINGS",    label: "Savings",    icon: PiggyBank,  color: "#f59e0b" },
  { value: "INVESTMENT", label: "Investment", icon: TrendingUp, color: "#8b5cf6" },
  { value: "LOAN",       label: "Loan",       icon: Landmark,   color: "#ef4444" },
  { value: "INSURANCE",  label: "Insurance",  icon: Shield,     color: "#06b6d4" },
  { value: "OTHER",      label: "Other",      icon: Wallet,     color: "#6b7280" },
] as const;

type AccountTypeValue = typeof ACCOUNT_TYPES[number]["value"];

const ACCOUNT_COLORS = [
  "#3b82f6", "#10b981", "#f97316", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f59e0b",
  "#ef4444", "#6b7280",
];

function getAccountTypeConfig(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[6];
}

interface Account {
  id: string;
  name: string;
  accountType: AccountTypeValue;
  bankName?: string;
  currency: string;
  color: string;
  currentBalance: number;
  _count: { transactions: number };
}

interface FormData {
  name: string;
  accountType: AccountTypeValue;
  bankName: string;
  currency: string;
  color: string;
  currentBalance: number;
}

const defaultForm: FormData = {
  name: "",
  accountType: "CARD",
  bankName: "",
  currency: "RON",
  color: "#3b82f6",
  currentBalance: 0,
};

export default function AccountsPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const accounts: Account[] = data?.accounts ?? [];

  function openAdd() {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(account: Account) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      accountType: account.accountType,
      bankName: account.bankName ?? "",
      currency: account.currency,
      color: account.color,
      currentBalance: account.currentBalance,
    });
    setDialogOpen(true);
  }

  function handleTypeChange(type: AccountTypeValue) {
    const config = getAccountTypeConfig(type);
    setForm((f) => ({ ...f, accountType: type, color: config.color }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Account name is required");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/accounts/${editingId}` : "/api/accounts";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          currentBalance: editingId ? Number(form.currentBalance) : 0,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || t("common.error"));
        return;
      }

      toast.success(editingId ? "Account updated!" : "Account added!");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Account deleted");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } else {
      toast.error(t("common.error"));
    }
    setDeleteId(null);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("accounts.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t("accounts.add")}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{t("accounts.noAccounts")}</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              {t("accounts.noAccountsDesc")}
            </p>
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 mr-2" />
              {t("accounts.add")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map((account) => {
            const typeConfig = getAccountTypeConfig(account.accountType);
            const Icon = typeConfig.icon;
            return (
              <Card key={account.id} className="card-hover relative overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => router.push(`/accounts/${account.id}`)}
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: `${account.color}25` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: account.color }} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{account.name}</h3>
                        <p className="text-xs text-muted-foreground">{typeConfig.label}</p>
                        {account.bankName && (
                          <p className="text-xs text-muted-foreground">{account.bankName}</p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(account)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(account.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div
                    className="mt-4 cursor-pointer"
                    onClick={() => router.push(`/accounts/${account.id}`)}
                  >
                    <p className="text-2xl font-bold">
                      {formatCurrency(account.currentBalance, account.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {account._count.transactions} {t("accounts.transactions")}
                    </p>
                  </div>

                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ backgroundColor: account.color }}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("accounts.edit") : t("accounts.add")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!editingId && (
              <div className="space-y-1.5">
                <Label>Account type</Label>
                <div className="grid grid-cols-4 gap-2">
                  {ACCOUNT_TYPES.map(({ value, label, icon: Icon, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleTypeChange(value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-medium",
                        form.accountType === value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <Icon className="w-5 h-5" style={{ color }} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("accounts.name")}</Label>
                <Input
                  placeholder={t("accounts.namePlaceholder")}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("accounts.currency")}</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                Bank / institution{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. Banca Transilvania, ING, Revolut"
                value={form.bankName}
                onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
              />
            </div>

            {editingId && (
              <div className="space-y-1.5">
                <Label>{t("accounts.currentBalance")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.currentBalance}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currentBalance: parseFloat(e.target.value) || 0 }))
                  }
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="w-3 h-3 shrink-0" />
                  Changing the balance records an automatic income or expense transaction.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("accounts.color")}</Label>
              <div className="flex gap-2 flex-wrap">
                {ACCOUNT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    className={cn(
                      "w-8 h-8 rounded-xl transition-transform",
                      form.color === color && "scale-125 ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
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
            <AlertDialogTitle>{t("accounts.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("accounts.deleteConfirm")}</AlertDialogDescription>
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
