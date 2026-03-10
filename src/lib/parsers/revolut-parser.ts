import Papa from "papaparse";
import type { BankParser, ParsedTransaction } from "./base-parser";
import { cleanAmount, parseEuropeanDate } from "./base-parser";


export const revolutParser: BankParser = {
  bankName: "Revolut",
  supportedFormats: ["csv"],

  detect(content: string): boolean {
    const first = content.split("\n")[0].toLowerCase();
    if (
      first.includes("started date") ||
      (first.includes("type") && first.includes("product") && first.includes("completed date"))
    ) return true;
    if (first.includes("paid out") && first.includes("paid in")) return true;
    return false;
  },

  parse(content: string): ParsedTransaction[] {
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    const transactions: ParsedTransaction[] = [];

    for (const row of result.data) {
      const rawDate =
        row["started date"] ||
        row["completed date"] ||
        row["date"] ||
        "";
      const date = parseEuropeanDate(rawDate.split(" ")[0]);
      if (!date) continue;

      const state = (row["state"] || row["status"] || "COMPLETED").toUpperCase();
      if (["FAILED", "DECLINED", "REVERTED", "PENDING"].includes(state)) continue;

      const description =
        row["description"] ||
        row["counterparty"] ||
        row["reference"] ||
        "";
      if (!description.trim()) continue;

      let amount = 0;
      let txType: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";

      const paidOutRaw =
        row["paid out (eur)"] || row["paid out (gbp)"] || row["paid out (usd)"] ||
        row["paid out"] || row["debit"] || "";
      const paidInRaw =
        row["paid in (eur)"] || row["paid in (gbp)"] || row["paid in (usd)"] ||
        row["paid in"] || row["credit"] || "";

      if (paidInRaw && cleanAmount(paidInRaw) > 0) {
        amount = cleanAmount(paidInRaw);
        txType = "INCOME";
      } else if (paidOutRaw && cleanAmount(paidOutRaw) > 0) {
        amount = cleanAmount(paidOutRaw);
        txType = "EXPENSE";
      } else if (row["amount"] !== undefined) {
        const raw = cleanAmount(row["amount"]);
        if (raw > 0) {
          amount = raw;
          txType = "INCOME";
        } else if (raw < 0) {
          amount = Math.abs(raw);
          txType = "EXPENSE";
        }
      }

      if (amount === 0) continue;

      const revolut_type = (row["type"] || "").toUpperCase();
      switch (revolut_type) {
        case "TRANSFER":
          txType = "TRANSFER";
          break;
        case "TOPUP":
        case "TOP-UP":
        case "TOP_UP":
        case "REFUND":
        case "CASHBACK":
          txType = "INCOME";
          break;
        case "CARD_PAYMENT":
        case "ATM":
        case "FEE":
          txType = "EXPENSE";
          break;
      }

      if (txType !== "TRANSFER") {
        const dl = description.toLowerCase();
        if (dl.startsWith("transfer to") || dl.startsWith("transfer from")) {
          txType = "TRANSFER";
        }
      }

      transactions.push({
        date,
        description: description.trim(),
        originalDescription: description.trim(),
        amount,
        type: txType,
        balance: row["balance"] ? cleanAmount(row["balance"]) : undefined,
        reference: row["reference"] || undefined,
      });
    }

    return transactions;
  },
};
