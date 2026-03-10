import Papa from "papaparse";
import type { BankParser, ParsedTransaction } from "./base-parser";
import { cleanAmount, parseEuropeanDate } from "./base-parser";

export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  type?: string;
  balance?: string;
}

export const genericParser: BankParser = {
  bankName: "Generic",
  supportedFormats: ["csv", "text"],

  detect(_content: string): boolean {
    return true;
  },

  parse(content: string, mapping?: ColumnMapping): ParsedTransaction[] {
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    if (!mapping) {
      const headers = result.meta.fields ?? [];
      mapping = autoDetectColumns(headers);
    }

    const transactions: ParsedTransaction[] = [];

    for (const row of result.data) {
      const dateStr = row[mapping.date] ?? "";
      const description = row[mapping.description] ?? "";

      const date = parseEuropeanDate(dateStr.trim());
      if (!date || !description.trim()) continue;

      let amount = 0;
      let type: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";

      if (mapping.amount) {
        const raw = cleanAmount(row[mapping.amount] ?? "0");
        if (raw > 0) {
          amount = raw;
          type = "INCOME";
        } else if (raw < 0) {
          amount = Math.abs(raw);
          type = "EXPENSE";
        }
      } else if (mapping.debit || mapping.credit) {
        const debit = mapping.debit ? cleanAmount(row[mapping.debit] ?? "0") : 0;
        const credit = mapping.credit ? cleanAmount(row[mapping.credit] ?? "0") : 0;

        if (credit > 0 && debit === 0) {
          amount = credit;
          type = "INCOME";
        } else if (debit > 0) {
          amount = debit;
          type = "EXPENSE";
        }
      }

      if (amount === 0) continue;

      if (mapping.type && row[mapping.type]) {
        const rawType = row[mapping.type].toUpperCase();
        if (rawType === "TRANSFER" || rawType === "VIRAMENT") type = "TRANSFER";
        else if (rawType === "CREDIT" || rawType === "IN") type = "INCOME";
        else if (rawType === "DEBIT" || rawType === "OUT") type = "EXPENSE";
      }

      transactions.push({
        date,
        description: description.trim(),
        originalDescription: description.trim(),
        amount,
        type,
        balance: mapping.balance ? cleanAmount(row[mapping.balance] ?? "0") : undefined,
      });
    }

    return transactions;
  },
};

export function autoDetectColumns(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase());

  const find = (...keywords: string[]): string => {
    for (const kw of keywords) {
      const idx = lower.findIndex((h) => h.includes(kw));
      if (idx !== -1) return headers[idx];
    }
    return "";
  };

  return {
    date: find("date", "data", "datum", "fecha"),
    description: find("description", "descriere", "details", "detalii", "merchant", "payee", "memo", "narrative"),
    amount: find("amount", "suma", "valoare"),
    debit: find("debit", "out", "iesiri", "paid out"),
    credit: find("credit", "in", "intrari", "paid in"),
    balance: find("balance", "sold", "solde"),
  };
}

export function detectColumns(csvText: string): { headers: string[]; sample: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    preview: 5,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return {
    headers: result.meta.fields ?? [],
    sample: result.data,
  };
}
