import Papa from "papaparse";
import type { BankParser, ParsedTransaction } from "./base-parser";
import { cleanAmount, parseEuropeanDate } from "./base-parser";

export const btParser: BankParser = {
  bankName: "Banca Transilvania",
  supportedFormats: ["csv", "text"],

  detect(content: string): boolean {
    const upper = content.toUpperCase();
    return (
      upper.includes("BANCA TRANSILVANIA") ||
      upper.includes("BT24") ||
      (upper.includes("DATA TRANZACTIE") && upper.includes("DEBIT")) ||
      (upper.includes("DATA VALUTEI") && upper.includes("REFERINTA"))
    );
  },

  parse(content: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    const lines = content.split("\n");
    let dataStart = -1;
    let headers: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      if (
        line.includes("data") &&
        (line.includes("debit") || line.includes("credit") || line.includes("suma"))
      ) {
        dataStart = i;
        headers = lines[i].split(/[,;|\t]/).map((h: string) => h.trim().toLowerCase());
        break;
      }
    }

    if (dataStart === -1) {
      const result = Papa.parse<Record<string, string>>(content, {
        header: true,
        skipEmptyLines: true,
        delimiter: ",",
        transformHeader: (h) => h.trim().toLowerCase(),
      });

      return parseBTRows(result.data);
    }

    const dataText = lines.slice(dataStart).join("\n");
    const result = Papa.parse<Record<string, string>>(dataText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    return parseBTRows(result.data);
  },
};

function parseBTRows(rows: Record<string, string>[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const dateStr =
      row["data tranzactie"] ||
      row["data"] ||
      row["date"] ||
      row["data operatiunii"] ||
      "";

    const description =
      row["descriere"] ||
      row["detalii"] ||
      row["referinta"] ||
      row["description"] ||
      row["details"] ||
      "";

    const debitStr = row["debit"] || row["suma debitata"] || row["iesiri"] || "";
    const creditStr = row["credit"] || row["suma creditata"] || row["intrari"] || "";

    const date = parseEuropeanDate(dateStr.trim());
    if (!date || !description) continue;

    let amount = 0;
    let type: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";

    const debit = debitStr ? cleanAmount(debitStr) : 0;
    const credit = creditStr ? cleanAmount(creditStr) : 0;

    if (credit > 0 && debit === 0) {
      amount = credit;
      type = "INCOME";
    } else if (debit > 0 && credit === 0) {
      amount = debit;
      type = "EXPENSE";
    } else if (debit > 0 && credit > 0) {
      if (credit > debit) {
        amount = credit;
        type = "INCOME";
      } else {
        amount = debit;
        type = "EXPENSE";
      }
    } else {
      continue;
    }

    if (amount === 0) continue;

    if (
      description.toLowerCase().includes("transfer") ||
      description.toLowerCase().includes("virament")
    ) {
      type = "TRANSFER";
    }

    transactions.push({
      date,
      description: description.trim(),
      originalDescription: description.trim(),
      amount,
      type,
      balance: row["sold"] ? cleanAmount(row["sold"]) : undefined,
    });
  }

  return transactions;
}
