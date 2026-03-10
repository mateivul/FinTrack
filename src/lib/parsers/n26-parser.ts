import Papa from "papaparse";
import type { BankParser, ParsedTransaction } from "./base-parser";
import { cleanAmount, parseEuropeanDate } from "./base-parser";


export const n26Parser: BankParser = {
  bankName: "N26",
  supportedFormats: ["csv"],

  detect(content: string): boolean {
    const first = content.split("\n")[0].toLowerCase();
    return (
      first.includes("payee") &&
      first.includes("transaction type") &&
      first.includes("payment reference")
    ) || (
      first.includes("payee") &&
      first.includes("amount (eur)")
    );
  },

  parse(content: string): ParsedTransaction[] {
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    const transactions: ParsedTransaction[] = [];

    for (const row of result.data) {
      const rawDate = row["date"] || row["booking date"] || row["value date"] || "";
      const date = parseEuropeanDate(rawDate.trim());
      if (!date) continue;

      const description =
        row["payee"] ||
        row["partner name"] ||
        row["payment reference"] ||
        row["reference"] ||
        "";
      if (!description.trim()) continue;

      const amountKey =
        Object.keys(row).find((k) => k.startsWith("amount")) || "amount (eur)";
      const raw = cleanAmount((row[amountKey] || "0").replace(/\s/g, ""));

      if (raw === 0) continue;

      let amount = Math.abs(raw);
      let txType: "INCOME" | "EXPENSE" | "TRANSFER" = raw < 0 ? "EXPENSE" : "INCOME";

      const n26Type = (row["transaction type"] || "").toLowerCase();
      if (
        n26Type.includes("outgoing transfer") ||
        n26Type.includes("transfer") ||
        n26Type.includes("überweisung")
      ) {
        txType = raw < 0 ? "TRANSFER" : "INCOME";
      } else if (
        n26Type.includes("income") ||
        n26Type.includes("incoming")
      ) {
        txType = "INCOME";
      } else if (
        n26Type.includes("direct debit") ||
        n26Type.includes("mastercard") ||
        n26Type.includes("visa") ||
        n26Type.includes("atm")
      ) {
        txType = "EXPENSE";
      }

      transactions.push({
        date,
        description: description.trim(),
        originalDescription: description.trim(),
        amount,
        type: txType,
        reference: row["payment reference"] || undefined,
      });
    }

    return transactions;
  },
};
