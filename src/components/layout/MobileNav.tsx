"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Upload,
  Settings,
} from "lucide-react";

const MOBILE_NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { href: "/transactions", icon: ArrowLeftRight, labelKey: "nav.transactions" },
  { href: "/budgets", icon: Target, labelKey: "nav.budgets" },
  { href: "/import", icon: Upload, labelKey: "nav.import" },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
];

export function MobileNav() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border lg:hidden">
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[52px]",
                "transition-all duration-150",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "drop-shadow-sm")} />
              <span className="text-[10px] font-medium leading-none">
                {t(item.labelKey as Parameters<typeof t>[0]).split(" ")[0]}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
