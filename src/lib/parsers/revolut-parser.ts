import Papa from "papaparse";
import type { BankParser, ParsedTransaction } from "./base-parser";
import { cleanAmount, parseEuropeanDate } from "./base-parser";

export const revolutParser: BankParser = {
  bankName: "Revolut",
  supportedFormats: ["csv"],

  detect(content: string): boolean {
    const firstLine = content.split("\n")[0].toLowerCase();
    return (
      firstLine.includes("type") &&
      firstLine.includes("product") &&
      firstLine.includes("started date") &&
      firstLine.includes("completed date")
    ) || (
      firstLine.includes("date") &&
      firstLine.includes("description") &&
      firstLine.includes("paid out") &&
      firstLine.includes("paid in")
    );
  },

  parse(content: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    for (const row of result.data) {
      const dateStr =
        row["Started Date"] || row["Completed Date"] || row["Date"] || "";
      const description =
        row["Description"] || row["Reference"] || row["Counterparty"] || "";
      const paidOut = row["Paid Out (EUR)"] || row["Paid Out"] || row["Amount"] || "";
      const paidIn = row["Paid In (EUR)"] || row["Paid In"] || "";
      const type = row["Type"] || "";
      const state = row["State"] || row["Status"] || "COMPLETED";

      if (state.toUpperCase() === "FAILED" || state.toUpperCase() === "DECLINED") {
        continue;
      }

      const date = parseEuropeanDate(dateStr.split(" ")[0]);
      if (!date) continue;

      let amount = 0;
      let txType: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";

      if (paidIn && cleanAmount(paidIn) > 0) {
        amount = cleanAmount(paidIn);
        txType = "INCOME";
      } else if (paidOut && cleanAmount(paidOut) > 0) {
        amount = cleanAmount(paidOut);
        txType = "EXPENSE";
      } else if (row["Amount"]) {
        const rawAmount = cleanAmount(row["Amount"]);
        if (rawAmount > 0) {
          amount = rawAmount;
          txType = "INCOME";
        } else if (rawAmount < 0) {
          amount = Math.abs(rawAmount);
          txType = "EXPENSE";
        }
      }

      if (amount === 0) continue;

      if (type.toUpperCase() === "TRANSFER") txType = "TRANSFER";
      if (type.toUpperCase() === "TOPUP" || type.toUpperCase() === "TOP-UP") txType = "INCOME";

      transactions.push({
        date,
        description: description.trim(),
        originalDescription: description.trim(),
        amount,
        type: txType,
        balance: row["Balance"] ? cleanAmount(row["Balance"]) : undefined,
        reference: row["Reference"] || undefined,
      });
    }

    return transactions;
  },
};
