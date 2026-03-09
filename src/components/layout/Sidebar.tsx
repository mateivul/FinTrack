"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Target,
  PiggyBank,
  Upload,
  BarChart3,
  Settings,
  RefreshCw,
  TrendingUp,
  Tag,
  X,
  History,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, labelKey: "nav.dashboard", exact: true },
  { href: "/transactions", icon: ArrowLeftRight, labelKey: "nav.transactions" },
  { href: "/accounts", icon: Wallet, labelKey: "nav.accounts" },
  { href: "/tags", icon: Tag, labelKey: "nav.tags" },
  { href: "/budgets", icon: Target, labelKey: "nav.budgets" },
  { href: "/savings", icon: PiggyBank, labelKey: "nav.savings" },
  { href: "/recurring", icon: RefreshCw, labelKey: "nav.recurring" },
  { href: "/import", icon: Upload, labelKey: "nav.import", exact: true },
  { href: "/import/history", icon: History, labelKey: "nav.importHistory" },
  { href: "/import/rules", icon: Wand2, labelKey: "nav.importRules" },
  { href: "/reports", icon: BarChart3, labelKey: "nav.reports" },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 z-50 flex flex-col",
          "bg-sidebar border-r border-sidebar-border",
          "transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:static lg:z-auto lg:h-auto lg:self-stretch",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-sidebar-foreground" style={{ fontFamily: "Nunito, sans-serif" }}>
              FinTrack
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                  "transition-all duration-150",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{t(item.labelKey as Parameters<typeof t>[0])}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground">FinTrack v1.0.0</p>
        </div>
      </aside>
    </>
  );
}
