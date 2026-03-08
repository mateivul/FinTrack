"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, EyeOff, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("auth.errors.invalidCredentials"));
        return;
      }

      toast.success(t("auth.welcomeBack"));
      router.push("/");
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: "linear-gradient(135deg, oklch(0.55 0.22 260) 0%, oklch(0.62 0.2 290) 50%, oklch(0.65 0.22 145) 100%)"
    }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-bold text-white" style={{ fontFamily: "Nunito, sans-serif" }}>
            FinTrack
          </span>
        </div>

        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">{t("auth.signInWith")}</CardTitle>
            <CardDescription className="text-center">
              {t("auth.noAccount")}{" "}
              <Link href="/register" className="text-primary font-semibold hover:underline">
                {t("auth.register")}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth.passwordPlaceholder")}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? t("common.loading") : t("auth.login")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
