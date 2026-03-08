"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  RefreshCw,
  Zap,
  Plus,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

interface ParsedTx {
  date: string;
  description: string;
  originalDescription: string;
  patternKey?: string;
  ruleApplied?: boolean;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  isDuplicate: boolean;
  skip: boolean;
  tagIds: string[];
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
  color: string;
}

export default function ImportPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [importHistoryId, setImportHistoryId] = useState("");
  const [bankName, setBankName] = useState("");
  const [transactions, setTransactions] = useState<ParsedTx[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [creatingTag, setCreatingTag] = useState(false);

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

  const accounts: Account[] = accountsData?.accounts ?? [];
  const tags: Tag[] = tagsData?.tags ?? [];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  async function handleUpload() {
    if (!accountId) {
      toast.error(t("import.errors.noAccount"));
      return;
    }
    if (!file && !pasteText.trim()) {
      toast.error("Please upload a file or paste text");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("accountId", accountId);
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("text", pasteText);
      }

      const res = await fetch("/api/import/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("import.errors.parseFailed"));
        return;
      }

      setImportHistoryId(data.importHistoryId);
      setBankName(data.bankName);
      setTransactions(
        data.transactions.map((tx: Omit<ParsedTx, "skip"> & { tagIds?: string[] }) => ({
          ...tx,
          skip: tx.isDuplicate,
          tagIds: tx.tagIds ?? [],
        }))
      );
      setSelectAll(true);
      setStep(3);
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    const toImport = transactions.filter((t) => !t.skip);
    if (toImport.length === 0) {
      toast.error("No transactions to import");
      return;
    }

    setConfirming(true);
    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importHistoryId,
          accountId,
          transactions,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("common.error"));
        return;
      }

      toast.success(`${data.imported} transactions imported!`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setStep(4);
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setConfirming(false);
    }
  }

  function editDescription(txIdx: number, desc: string) {
    setTransactions((txs) =>
      txs.map((tx, i) => (i === txIdx ? { ...tx, description: desc } : tx))
    );
  }

  function toggleTxTag(txIdx: number, tagId: string) {
    setTransactions((txs) =>
      txs.map((tx, i) => {
        if (i !== txIdx) return tx;
        return {
          ...tx,
          tagIds: tx.tagIds.includes(tagId)
            ? tx.tagIds.filter((id) => id !== tagId)
            : [...tx.tagIds, tagId],
        };
      })
    );
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create tag");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["tags"] });
      setNewTagName("");
      setShowNewTagForm(false);
      toast.success(`Tag "${data.tag.name}" created`);
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setCreatingTag(false);
    }
  }

  function resetWizard() {
    setStep(1);
    setFile(null);
    setPasteText("");
    setAccountId("");
    setTransactions([]);
    setImportHistoryId("");
    setBankName("");
    setSelectAll(true);
  }

  const activeAccount = accounts.find((a) => a.id === accountId);
  const toImportCount = transactions.filter((t) => !t.skip).length;
  const duplicateCount = transactions.filter((t) => t.isDuplicate).length;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("import.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("import.subtitle")}</p>
      </div>

      <div className="flex items-center gap-2">
        {([1, 2, 3, 4] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
              step >= s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              {step > s ? <CheckCircle className="w-5 h-5" /> : s}
            </div>
            <span className={cn(
              "text-sm hidden sm:block",
              step === s ? "font-semibold text-foreground" : "text-muted-foreground"
            )}>
              {t(`import.step${s}` as Parameters<typeof t>[0])}
            </span>
            {idx < 3 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("import.step1")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{t("import.selectAccount")} *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!showPaste && (
              <div
                className={cn(
                  "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer",
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("fileInput")?.click()}
              >
                <input
                  id="fileInput"
                  type="file"
                  accept=".pdf,.csv,.xlsx,.xls,.ofx,.qif,.txt"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />

                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                      <Upload className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">{t("import.dragDrop")}</p>
                      <p className="text-sm text-muted-foreground">{t("import.supported")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("import.maxSize")}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      {t("import.browse")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="text-center">
              <button
                className="text-sm text-primary hover:underline"
                onClick={() => { setShowPaste((s) => !s); setFile(null); }}
              >
                {showPaste ? t("import.browse") : t("import.pasteText")}
              </button>
            </div>

            {showPaste && (
              <div className="space-y-2">
                <Label>Paste CSV or text content</Label>
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste your bank statement CSV content here..."
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleUpload}
              disabled={uploading || !accountId || (!file && !pasteText.trim())}
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t("import.detecting")}
                </>
              ) : (
                <>
                  {t("common.next")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{t("import.detected")}: {bankName}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("import.transactionsFound", { count: transactions.length })}
                      {duplicateCount > 0 && ` · ${duplicateCount} duplicates`}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {t("common.back")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                id="selectAll"
                checked={selectAll}
                onCheckedChange={(checked) => {
                  setSelectAll(!!checked);
                  setTransactions((txs) =>
                    txs.map((tx) => ({ ...tx, skip: tx.isDuplicate ? tx.skip : !checked }))
                  );
                }}
              />
              <label htmlFor="selectAll" className="text-sm cursor-pointer">
                Select all ({toImportCount} / {transactions.length})
              </label>
            </div>

            {!showNewTagForm ? (
              <button
                type="button"
                onClick={() => setShowNewTagForm(true)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="w-3 h-3" /> New tag
              </button>
            ) : (
              <form onSubmit={handleCreateTag} className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  className="text-xs border rounded px-2 py-1 bg-background w-28 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 p-0.5 bg-transparent"
                />
                <Button type="submit" size="sm" variant="ghost" disabled={creatingTag} className="h-7 w-7 p-0">
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => { setShowNewTagForm(false); setNewTagName(""); }}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </form>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {transactions.map((tx, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "px-4 py-3 transition-colors",
                      tx.skip ? "opacity-50 bg-muted/30" : "hover:bg-accent/30",
                      tx.isDuplicate && "border-l-4 border-l-yellow-400"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        className="mt-1"
                        checked={!tx.skip}
                        onCheckedChange={(checked) => {
                          setTransactions((txs) =>
                            txs.map((t, i) => i === idx ? { ...t, skip: !checked } : t)
                          );
                        }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={tx.description}
                            onChange={(e) => editDescription(idx, e.target.value)}
                            disabled={tx.skip}
                            className="text-sm font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none flex-1 min-w-0 disabled:pointer-events-none"
                          />
                          {tx.ruleApplied && (
                            <span title="Auto-filled from previous import">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                            </span>
                          )}
                          {tx.isDuplicate && (
                            <Badge className="bg-yellow-100 text-yellow-700 text-xs shrink-0">
                              Duplicate
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1.5">
                          {formatDate(tx.date)}
                        </p>
                        {tags.length === 0 && !tx.skip && (
                          <p className="text-xs text-muted-foreground">
                            No tags yet —{" "}
                            <a href="/tags" className="underline hover:text-foreground">create tags</a>
                            {" "}to categorize transactions
                          </p>
                        )}
                        {tags.length > 0 && !tx.skip && (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag) => {
                              const selected = tx.tagIds.includes(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => toggleTxTag(idx, tag.id)}
                                  className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs border transition-all",
                                    selected
                                      ? "border-transparent font-medium"
                                      : "border-border text-muted-foreground hover:text-foreground"
                                  )}
                                  style={selected ? {
                                    backgroundColor: `${tag.color}20`,
                                    borderColor: tag.color,
                                    color: tag.color,
                                  } : undefined}
                                >
                                  #{tag.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <p className={cn(
                        "text-sm font-bold shrink-0",
                        tx.type === "INCOME" ? "text-emerald-500" : "text-red-500"
                      )}>
                        {tx.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(tx.amount, activeAccount?.currency ?? "RON")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Importing {toImportCount} of {transactions.length} transactions
            </p>
            <Button onClick={handleConfirm} disabled={confirming || toImportCount === 0} size="lg">
              {confirming ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t("import.importing")}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t("import.confirm", { count: toImportCount })}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Import Complete!</h2>
            <p className="text-muted-foreground mb-8">
              {toImportCount} transactions have been imported successfully.
              {duplicateCount > 0 && ` ${duplicateCount} duplicates were skipped.`}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={resetWizard}>
                Import Another
              </Button>
              <Button asChild>
                <a href="/transactions">View Transactions</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
