export interface ParsedTransaction {
  date: Date;
  description: string;
  originalDescription: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  balance?: number;
  reference?: string;
  patternKey?: string;
  metadata?: Record<string, string>;
}

export interface BankParser {
  bankName: string;
  supportedFormats: Array<"pdf" | "csv" | "xlsx" | "ofx" | "qif" | "text">;
  detect(content: string): boolean;
  parse(content: string): ParsedTransaction[];
}

export function cleanAmount(str: string): number {  
  const cleaned = str
    .replace(/[^\d.,\-+]/g, "")
    .trim();

  if (cleaned.match(/^\d{1,3}(\.\d{3})*(,\d+)?$/)) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }

  if (cleaned.match(/^\d{1,3}(,\d{3})*(\.\d+)?$/)) {
    return parseFloat(cleaned.replace(/,/g, ""));
  }

  return parseFloat(cleaned.replace(",", ".")) || 0;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  ianuarie: 0, februarie: 1, martie: 2, aprilie: 3, mai: 4, iunie: 5,
  iulie: 6, august: 7, septembrie: 8, octombrie: 9, noiembrie: 10, decembrie: 11,
};

export function parseEuropeanDate(str: string): Date | null {
  if (!str) return null;
  const s = str.trim();

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  }

  const dmy = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/);
  if (dmy) {
    return new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]));
  }

  const dmyShort = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2})$/);
  if (dmyShort) {
    const year = +dmyShort[3] + (+dmyShort[3] >= 50 ? 1900 : 2000);
    return new Date(Date.UTC(year, +dmyShort[2] - 1, +dmyShort[1]));
  }

  const ymd = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (ymd) {
    return new Date(Date.UTC(+ymd[1], +ymd[2] - 1, +ymd[3]));
  }

  const dMonY = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dMonY) {
    const month = MONTH_NAMES[dMonY[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      return new Date(Date.UTC(+dMonY[3], month, +dMonY[1]));
    }
  }

  const monDY = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monDY) {
    const month = MONTH_NAMES[monDY[1].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      return new Date(Date.UTC(+monDY[3], month, +monDY[2]));
    }
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }

  return null;
}

export function normalizeDescription(desc: string): string {
  return desc
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\-\/.,()]/g, " ")
    .trim()
    .toLowerCase();
}
