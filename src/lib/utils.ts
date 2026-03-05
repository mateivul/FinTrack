import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { enUS, ro } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency = "RON",
  locale = "en"
): string {
  const localeMap: Record<string, string> = {
    en: "en-US",
    ro: "ro-RO",
  };

  try {
    return new Intl.NumberFormat(localeMap[locale] ?? "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(date: Date | string, locale = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dateLocale = locale === "ro" ? ro : enUS;
  const pattern = locale === "ro" ? "dd.MM.yyyy" : "MM/dd/yyyy";
  return format(d, pattern, { locale: dateLocale });
}

/** Returns "HH:mm" if the time is not midnight, otherwise "" */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (d.getHours() === 0 && d.getMinutes() === 0) return "";
  return format(d, "HH:mm");
}

export function formatDateRelative(date: Date | string, locale = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return locale === "ro" ? "azi" : "today";
  if (diffDays === 1) return locale === "ro" ? "ieri" : "yesterday";
  if (diffDays < 7) return locale === "ro" ? `acum ${diffDays} zile` : `${diffDays} days ago`;

  return formatDate(d, locale);
}

export function getTransactionTypeColor(type: string): string {
  switch (type) {
    case "INCOME":
      return "text-emerald-500";
    case "EXPENSE":
      return "text-red-500";
    case "TRANSFER":
      return "text-blue-500";
    default:
      return "text-muted-foreground";
  }
}

export function getProgressColor(percentage: number): string {
  if (percentage < 60) return "bg-emerald-500";
  if (percentage < 80) return "bg-yellow-500";
  if (percentage < 100) return "bg-orange-500";
  return "bg-red-500";
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}
