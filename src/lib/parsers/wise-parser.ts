import Papa from "papaparse";
import type { BankParser, ParsedTransaction } from "./base-parser";
import { cleanAmount, parseEuropeanDate } from "./base-parser";


export const wiseParser: BankParser = {
  bankName: "Wise",
  supportedFormats: ["csv"],

  detect(content: string): boolean {
    const first = content.split("\n")[0].toLowerCase();
    return (
      first.includes("transferwise") ||
      (first.includes("running balance") && first.includes("payment reference")) ||
      (first.includes("source amount") && first.includes("target amount")) ||
      (first.includes("direction") && first.includes("finished on") && first.includes("exchange rate"))
    );
  },

  parse(content: string): ParsedTransaction[] {
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    const headers = result.meta.fields ?? [];
    const isTransferFormat = headers.some((h) => h.includes("source amount") || h.includes("direction"));

    const transactions: ParsedTransaction[] = [];

    if (isTransferFormat) {
      for (const row of result.data) {
        const status = (row["status"] || "").toUpperCase();
        if (status && !["COMPLETED", "FUNDS_CONVERTED"].includes(status)) continue;

        const rawDate = row["finished on"] || row["created on"] || "";
        const date = parseEuropeanDate(rawDate.split(" ")[0]);
        if (!date) continue;

        const direction = (row["direction"] || "").toUpperCase();
        const sourceName = row["source name"] || "";
        const targetName = row["target name"] || "";
        const reference = row["reference"] || "";

        const description = reference || (direction === "IN" ? sourceName : targetName) || "Wise Transfer";

        const sourceAmount = cleanAmount(row["source amount (after fees)"] || row["source amount"] || "0");
        const targetAmount = cleanAmount(row["target amount (after fees)"] || row["target amount"] || "0");
        const amount = direction === "IN" ? targetAmount : sourceAmount;

        if (amount === 0) continue;

        transactions.push({
          date,
          description: description.trim(),
          originalDescription: description.trim(),
          amount,
          type: "TRANSFER",
          reference: reference || undefined,
        });
      }
    } else {
      for (const row of result.data) {
        const rawDate = row["date"] || "";
        const date = parseEuropeanDate(rawDate.split(" ")[0]);
        if (!date) continue;

        const description =
          row["description"] ||
          row["merchant"] ||
          row["payee name"] ||
          row["payment reference"] ||
          "";
        if (!description.trim()) continue;

        const raw = cleanAmount(row["amount"] || row["total amount"] || "0");
        if (raw === 0) continue;

        const amount = Math.abs(raw);
        const txType: "INCOME" | "EXPENSE" | "TRANSFER" = raw < 0 ? "EXPENSE" : "INCOME";

        transactions.push({
          date,
          description: description.trim(),
          originalDescription: description.trim(),
          amount,
          type: txType,
          balance: row["running balance"] ? cleanAmount(row["running balance"]) : undefined,
          reference: row["payment reference"] || undefined,
        });
      }
    }

    return transactions;
  },
};
