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

export function parseEuropeanDate(str: string): Date | null {
  const ddmmyyyy = str.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/);
  if (ddmmyyyy) {
    return new Date(
      parseInt(ddmmyyyy[3]),
      parseInt(ddmmyyyy[2]) - 1,
      parseInt(ddmmyyyy[1])
    );
  }

  const isoDate = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return new Date(parseInt(isoDate[1]), parseInt(isoDate[2]) - 1, parseInt(isoDate[3]));
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

export function normalizeDescription(desc: string): string {
  return desc
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\-\/.,()]/g, " ")
    .trim()
    .toLowerCase();
}
