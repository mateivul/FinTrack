import type { BankParser, ParsedTransaction } from "./base-parser";
import { revolutParser } from "./revolut-parser";
import { btParser } from "./bt-parser";
import { ingParser } from "./ing-parser";
import { bcrParser } from "./bcr-parser";
import { genericParser } from "./generic-parser";

export type { BankParser, ParsedTransaction };
export { revolutParser, btParser, ingParser, bcrParser, genericParser };

const PARSERS: BankParser[] = [
  revolutParser,
  bcrParser,
  btParser,
  ingParser,
];

export interface DetectionResult {
  parser: BankParser | null;
  bankName: string;
  isGeneric: boolean;
}

export function detectBank(content: string): DetectionResult {
  for (const parser of PARSERS) {
    if (parser.detect(content)) {
      return { parser, bankName: parser.bankName, isGeneric: false };
    }
  }
  return { parser: genericParser, bankName: "Generic", isGeneric: true };
}

export function parseStatement(
  content: string,
  parser?: BankParser
): ParsedTransaction[] {
  const selectedParser = parser ?? detectBank(content).parser ?? genericParser;
  return selectedParser.parse(content);
}
