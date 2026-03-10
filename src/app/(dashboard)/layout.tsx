"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

interface User {
  id: string;
  name: string;
  email: string;
  language: string;
  theme: string;
  isDemo?: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/recurring/process", { method: "POST" })
      .then((res) => res.json())
      .then(({ processed }) => {
        if (processed > 0) {
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
          queryClient.invalidateQueries({ queryKey: ["recurring"] });
        }
      })
      .catch(() => {});
  }, [queryClient]);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.push("/login");
        throw new Error("Unauthorized");
      }
      const data = await res.json();
      return data.user;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl gradient-bg animate-pulse" />
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-0 overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          user={{ name: user.name, email: user.email, language: user.language }}
        />

        {user.isDemo && (
          <div className="bg-amber-500 text-amber-950 text-center text-sm py-2 px-4 font-medium shrink-0">
            Demo mode — you&apos;re exploring a sample account. Changes are visible in your session but reset when you log out.
          </div>
        )}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
