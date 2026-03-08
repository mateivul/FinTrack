"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Tag, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

const TAG_COLORS = [
  "#3b82f6", "#10b981", "#f97316", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f59e0b",
  "#ef4444", "#6b7280", "#14b8a6", "#a855f7",
];

interface TagItem {
  id: string;
  name: string;
  color: string;
  _count: { transactions: number };
}

const defaultForm = { name: "", color: "#3b82f6" };

export default function TagsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const tags: TagItem[] = data?.tags ?? [];

  function openAdd() {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(tag: TagItem) {
    setEditingId(tag.id);
    setForm({ name: tag.name, color: tag.color });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/tags/${editingId}` : "/api/tags";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim().toLowerCase(), color: form.color }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "An error occurred");
        return;
      }

      toast.success(editingId ? "Tag updated!" : "Tag created!");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Tag deleted");
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    } else {
      toast.error("An error occurred");
    }
    setDeleteId(null);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tags</h1>
          <p className="text-sm text-muted-foreground">
            {tags.length} tag{tags.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          New Tag
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : tags.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <Tag className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No tags yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Create tags to organize your transactions. Tags work across all accounts.
            </p>
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Create your first tag
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {tags.map((tag) => (
            <Card
              key={tag.id}
              className="card-hover relative overflow-hidden cursor-pointer"
              onClick={() => router.push(`/transactions?tagId=${tag.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${tag.color}25` }}
                  >
                    <Tag className="w-5 h-5" style={{ color: tag.color }} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 -mt-1 -mr-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => openEdit(tag)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(tag.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="font-semibold text-sm">#{tag.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tag._count.transactions} transactions
                </p>
                <div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{ backgroundColor: tag.color }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Tag" : "New Tag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. groceries, vacation, work"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <p className="text-xs text-muted-foreground">
                Names are saved in lowercase.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map((color) => (
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
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm text-muted-foreground">Preview:</span>
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${form.color}20`,
                  color: form.color,
                  border: `1.5px solid ${form.color}`,
                }}
              >
                #{form.name || "tag-name"}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? The tag will be removed from all transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
