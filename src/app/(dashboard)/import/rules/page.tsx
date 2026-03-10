"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Wand2, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ImportRule {
  id: string;
  pattern: string;
  description: string;
  updatedAt: string;
  tags: { tag: Tag }[];
}

export default function ImportRulesPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [editingRule, setEditingRule] = useState<ImportRule | null>(null);
  const [editPattern, setEditPattern] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["import-rules"],
    queryFn: async () => {
      const res = await fetch("/api/import/rules");
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/import/rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-rules"] });
      toast.success(t("importRules.deleted"));
    },
    onError: () => toast.error(t("common.error")),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, pattern, description, tagIds }: { id: string; pattern: string; description: string; tagIds: string[] }) => {
      const res = await fetch(`/api/import/rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern, description, tagIds }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-rules"] });
      toast.success(t("importRules.updated"));
      setEditingRule(null);
    },
    onError: () => toast.error(t("common.error")),
  });

  function openEdit(rule: ImportRule) {
    setEditingRule(rule);
    setEditPattern(rule.pattern);
    setEditDescription(rule.description);
    setEditTagIds(rule.tags.map(({ tag }) => tag.id));
  }

  function toggleTag(tagId: string) {
    setEditTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  const rules: ImportRule[] = data?.rules ?? [];
  const allTags: Tag[] = tagsData?.tags ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <Wand2 className="w-5 h-5 text-purple-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t("importRules.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("importRules.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("importRules.autoRules")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {t("importRules.noRules")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{rule.description}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {t("importRules.pattern")}: {rule.pattern}
                    </p>
                    {rule.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {rule.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: tag.color + "22",
                              color: tag.color,
                            }}
                          >
                            #{tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(rule)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDeleteId(rule.id)}
                      disabled={deleteMutation.isPending}
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

      <p className="text-xs text-muted-foreground">
        {t("importRules.hint")}
      </p>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("importRules.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("importRules.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDeleteId) { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null); } }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingRule} onOpenChange={(o) => !o && setEditingRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("importRules.edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("importRules.description")}</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("importRules.pattern")}</Label>
              <Input
                value={editPattern}
                onChange={(e) => setEditPattern(e.target.value)}
                className="font-mono"
              />
            </div>
            {allTags.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("importRules.tags")}</Label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => {
                    const selected = editTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium border-2 transition-all"
                        style={
                          selected
                            ? { backgroundColor: tag.color + "33", color: tag.color, borderColor: tag.color }
                            : { backgroundColor: "transparent", color: tag.color, borderColor: tag.color + "55" }
                        }
                      >
                        #{tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRule(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() =>
                editingRule &&
                editMutation.mutate({
                  id: editingRule.id,
                  pattern: editPattern,
                  description: editDescription,
                  tagIds: editTagIds,
                })
              }
              disabled={editMutation.isPending || !editPattern.trim() || !editDescription.trim()}
            >
              {editMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
