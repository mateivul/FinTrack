import Papa from "papaparse";
import type { BankParser, ParsedTransaction } from "./base-parser";
import { cleanAmount, parseEuropeanDate } from "./base-parser";

export const ingParser: BankParser = {
  bankName: "ING Romania",
  supportedFormats: ["csv", "text"],

  detect(content: string): boolean {
    const upper = content.toUpperCase();
    return (
      upper.includes("ING BANK") ||
      upper.includes("ING ROMANIA") ||
      upper.includes("HOME'BANK") ||
      (upper.includes("DATA PROCESARII") && upper.includes("SUMA DEBITATA")) ||
      upper.includes("ING DIRECT")
    );
  },

  parse(content: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: ",",
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, " "),
    });

    for (const row of result.data) {
      const dateStr =
        row["data procesarii"] ||
        row["data tranzactiei"] ||
        row["data"] ||
        row["date"] ||
        "";

      const description =
        row["descriere"] ||
        row["detalii tranzactie"] ||
        row["informatii suplimentare"] ||
        row["description"] ||
        "";

      const debitStr = row["suma debitata"] || row["debit"] || row["suma"] || "";
      const creditStr = row["suma creditata"] || row["credit"] || "";

      const date = parseEuropeanDate(dateStr.trim());
      if (!date) continue;

      let amount = 0;
      let type: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";

      const debit = debitStr ? cleanAmount(debitStr) : 0;
      const credit = creditStr ? cleanAmount(creditStr) : 0;

      if (credit > 0 && debit === 0) {
        amount = credit;
        type = "INCOME";
      } else if (debit > 0) {
        amount = debit;
        type = "EXPENSE";
      } else {
        continue;
      }

      if (amount === 0) continue;

      const descLower = description.toLowerCase();
      if (descLower.includes("transfer") || descLower.includes("virament")) {
        type = "TRANSFER";
      }

      transactions.push({
        date,
        description: description.trim(),
        originalDescription: description.trim(),
        amount,
        type,
        balance: row["sold disponibil"] ? cleanAmount(row["sold disponibil"]) : undefined,
      });
    }

    return transactions;
  },
};
