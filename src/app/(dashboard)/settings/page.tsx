"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sun, Moon, Monitor, Globe, User, Lock, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [profileForm, setProfileForm] = useState({ name: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      return res.json();
    },
  });

  const user = data?.user;

  useEffect(() => {
    if (user?.name && !profileForm.name) {
      setProfileForm({ name: user.name });
    }
  }, [user?.name]);

  async function handleProfileSave() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileForm.name }),
      });
      if (res.ok) {
        toast.success(t("settings.profileUpdated"));
        queryClient.invalidateQueries({ queryKey: ["me"] });
      } else {
        toast.error(t("common.error"));
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSave() {
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      toast.error(t("auth.errors.passwordsMismatch"));
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      if (res.ok) {
        toast.success(t("settings.passwordUpdated"));
        setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      } else {
        const d = await res.json();
        toast.error(d.error || t("common.error"));
      }
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLanguageChange(lang: "en" | "ro") {
    document.cookie = `locale=${lang}; path=/; max-age=31536000`;
    await fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang.toUpperCase() }),
    });
    toast.success(lang === "en" ? t("settings.languageChangedEn") : t("settings.languageChangedRo"));
    router.refresh();
  }

  async function handleDeleteAccount() {
    const res = await fetch("/api/user", { method: "DELETE" });
    if (!res.ok) { toast.error(t("common.error")); return; }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const THEMES = [
    { value: "light", label: t("settings.themeLight"), icon: <Sun className="w-5 h-5" /> },
    { value: "dark", label: t("settings.themeDark"), icon: <Moon className="w-5 h-5" /> },
    { value: "system", label: t("settings.themeSystem"), icon: <Monitor className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              {t("settings.theme")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    theme === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  )}
                >
                  {icon}
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {t("settings.language")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleLanguageChange("en")}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:bg-accent transition-all"
              >
                <span className="text-2xl">🇬🇧</span>
                <div className="text-left">
                  <p className="font-semibold">English</p>
                  <p className="text-xs text-muted-foreground">en</p>
                </div>
              </button>
              <button
                onClick={() => handleLanguageChange("ro")}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:bg-accent transition-all"
              >
                <span className="text-2xl">🇷🇴</span>
                <div className="text-left">
                  <p className="font-semibold">Română</p>
                  <p className="text-xs text-muted-foreground">ro</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {t("settings.profile")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("settings.name")}</Label>
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.email")}</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <Button onClick={handleProfileSave} disabled={savingProfile}>
              {savingProfile ? t("common.loading") : t("common.save")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {t("settings.changePassword")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("settings.currentPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.newPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.confirmNewPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.confirmNewPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirmNewPassword: e.target.value }))}
              />
            </div>
            <Button onClick={handlePasswordSave} disabled={savingPassword}>
              {savingPassword ? t("common.loading") : t("settings.changePassword")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              {t("settings.exportData")}
            </CardTitle>
            <CardDescription>{t("settings.exportDataDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <a href="/api/user/export" download>
                <Download className="w-4 h-4 mr-2" />
                {t("settings.exportData")}
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              {t("settings.dangerZone")}
            </CardTitle>
            <CardDescription>{t("settings.deleteAccountConfirm")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => { setDeleteStep(1); setDeleteConfirmEmail(""); }}
            >
              {t("settings.deleteAccount")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteStep > 0} onOpenChange={(o) => !o && setDeleteStep(0)}>
        <DialogContent>
          {deleteStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>{t("settings.deleteAccount")}</DialogTitle>
                <DialogDescription>{t("settings.deleteAccountConfirm")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteStep(0)}>{t("common.cancel")}</Button>
                <Button
                  variant="destructive"
                  onClick={() => { setDeleteStep(2); setDeleteConfirmEmail(""); }}
                >
                  {t("settings.deleteConfirmContinue")}
                </Button>
              </DialogFooter>
            </>
          )}
          {deleteStep === 2 && (
            <>
              <DialogHeader>
                <DialogTitle>{t("settings.deleteConfirmTitle")}</DialogTitle>
                <DialogDescription>
                  {t("settings.deleteConfirmDesc")}{" "}
                  <span className="font-semibold text-foreground">{user?.email}</span>{" "}
                  {t("settings.deleteConfirmDescSuffix")}
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder={user?.email ?? "your@email.com"}
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                autoFocus
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteStep(0)}>{t("common.cancel")}</Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmEmail !== user?.email}
                >
                  {t("settings.deleteAccount")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
