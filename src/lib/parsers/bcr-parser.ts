import Papa from "papaparse";
import type { BankParser, ParsedTransaction } from "./base-parser";
import { cleanAmount, parseEuropeanDate } from "./base-parser";

export function extractBcrDescription(raw: string): string {
  const platitorMatch = raw.match(/Platitor:\s*'([^']+)'/i);
  if (platitorMatch) {
    return platitorMatch[1].trim();
  }

  const locatieMatch = raw.match(/Locatie:\s*([^.]+)\.\s*Data_Ora:/i);
  if (locatieMatch) {
    const loc = locatieMatch[1].trim();
    const merchantName = loc.replace(/^\S+\s+[A-Z]{2}\s+/, "").trim();
    return merchantName || loc;
  }

  const tranzIdx = raw.indexOf(" - Tranz:");
  if (tranzIdx !== -1) {
    return raw.substring(0, tranzIdx).trim();
  }

  return raw.trim();
}

export const bcrParser: BankParser = {
  bankName: "BCR",
  supportedFormats: ["csv", "text"],

  detect(content: string): boolean {
    const upper = content.toUpperCase();
    return (
      upper.includes("RNCB") || // BCR's BIC/IBAN prefix
      (upper.includes("DATA FINALIZARII TRANZACTIEI") && upper.includes("DEBIT (SUMA)")) ||
      (upper.includes("TRANZACTII FINALIZATE") && upper.includes("CREDIT (SUMA)"))
    );
  },

  parse(content: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    for (const row of result.data) {
      const dateStr =
        row["data finalizarii tranzactiei"] ||
        row["data tranzactiei"] ||
        row["data"] ||
        "";

      const rawDescription =
        row["tranzactii finalizate (detalii)"] ||
        row["detalii tranzactie"] ||
        row["descriere"] ||
        "";

      const debitStr = row["debit (suma)"] || row["debit"] || "";
      const creditStr = row["credit (suma)"] || row["credit"] || "";
      const balanceStr = row["sold contabil final"] || row["sold disponibil"] || "";

      const date = parseEuropeanDate(dateStr.trim());
      if (!date || !rawDescription.trim()) continue;

      const debit = debitStr ? cleanAmount(debitStr) : 0;
      const credit = creditStr ? cleanAmount(creditStr) : 0;

      let amount = 0;
      let type: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";

      if (credit > 0 && debit === 0) {
        amount = credit;
        type = "INCOME";
      } else if (debit > 0 && credit === 0) {
        amount = debit;
        type = "EXPENSE";
      } else if (debit > 0 && credit > 0) {
        amount = debit > credit ? debit : credit;
        type = debit > credit ? "EXPENSE" : "INCOME";
      } else {
        continue;
      }

      if (amount === 0) continue;

      const descLower = rawDescription.toLowerCase();
      if (descLower.includes("transfer") || descLower.includes("virament")) {
        type = "TRANSFER";
      }

      const cleanDesc = extractBcrDescription(rawDescription);

      transactions.push({
        date,
        description: cleanDesc,
        originalDescription: rawDescription.trim(),
        patternKey: cleanDesc.toLowerCase().trim(),
        amount,
        type,
        balance: balanceStr ? cleanAmount(balanceStr) : undefined,
      });
    }

    return transactions;
  },
};
