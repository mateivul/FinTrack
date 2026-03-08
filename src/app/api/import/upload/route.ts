import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectBank, parseStatement } from "@/lib/parsers";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const accountId = formData.get("accountId") as string;
    const textContent = formData.get("text") as string | null;

    if (!accountId) {
      return NextResponse.json({ error: "Bank account ID is required" }, { status: 400 });
    }

    const account = await prisma.bankAccount.findFirst({
      where: { id: accountId, userId: session.userId },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    let content = "";
    let fileName = "pasted-text.txt";
    let fileType = "text";

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
      }

      fileName = file.name;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      fileType = ext;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (ext === "pdf") {
        try {
          const { PDFParse } = require("pdf-parse") as { PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> } };
          const pdfData = await new PDFParse({ data: buffer }).getText();
          content = pdfData.text;
          fileType = "pdf";
        } catch (err) {
          console.error("PDF parse error:", err);
          return NextResponse.json({ error: "Could not parse PDF file. Make sure it is not password-protected and contains selectable text (not a scanned image)." }, { status: 400 });
        }
      } else if (ext === "xlsx" || ext === "xls") {
        try {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          content = XLSX.utils.sheet_to_csv(sheet);
          fileType = "xlsx";
        } catch {
          return NextResponse.json({ error: "Could not parse Excel file" }, { status: 400 });
        }
      } else if (ext === "csv" || ext === "txt" || ext === "ofx" || ext === "qif") {
        content = buffer.toString("utf-8");
        fileType = ext;
      } else {
        return NextResponse.json({ error: "Unsupported file format" }, { status: 400 });
      }
    } else if (textContent) {
      content = textContent;
      fileType = "text";
    } else {
      return NextResponse.json({ error: "No file or text provided" }, { status: 400 });
    }

    const detection = detectBank(content);
    const preview = content.split("\n").slice(0, 8).join("\n");
    console.log("[import] detected bank:", detection.bankName, "| isGeneric:", detection.isGeneric);
    console.log("[import] content preview:\n", preview);

    const parsed = parseStatement(content, detection.parser ?? undefined);
    console.log("[import] parsed transactions:", parsed.length);

    if (parsed.length === 0) {
      return NextResponse.json({
        error: "No transactions found in the file. Please check the format.",
        debug: {
          detectedBank: detection.bankName,
          isGeneric: detection.isGeneric,
          contentPreview: preview,
        },
      }, { status: 400 });
    }

    const duplicateChecks = await Promise.all(
      parsed.map(async (tx) => {
        const existing = await prisma.transaction.findFirst({
          where: {
            userId: session.userId,
            bankAccountId: accountId,
            date: {
              gte: new Date(tx.date.getTime() - 86400000), 
              lte: new Date(tx.date.getTime() + 86400000),
            },
            amount: tx.amount,
            originalDescription: {
              contains: (tx.originalDescription ?? tx.description).substring(0, 60),
              mode: "insensitive",
            },
          },
        });
        const key = tx.patternKey ?? tx.description.toLowerCase().trim();
        return { ...tx, patternKey: key, isDuplicate: existing !== null, existingId: existing?.id };
      })
    );

    const patternKeys = duplicateChecks.map((tx) => tx.patternKey).filter(Boolean) as string[];
    const matchingRules = patternKeys.length
      ? await prisma.importRule.findMany({
          where: { userId: session.userId, pattern: { in: patternKeys } },
          include: { tags: { select: { tagId: true } } },
        })
      : [];
    const ruleByPattern = new Map(matchingRules.map((r) => [r.pattern, r]));

    const enrichedTransactions = duplicateChecks.map((tx) => {
      const rule = ruleByPattern.get(tx.patternKey);
      if (rule) {
        return {
          ...tx,
          description: rule.description,
          tagIds: rule.tags.map((t) => t.tagId),
          ruleApplied: true,
        };
      }
      return { ...tx, ruleApplied: false };
    });

    const importHistory = await prisma.importHistory.create({
      data: {
        fileName,
        fileType,
        bankName: detection.bankName,
        status: "REVIEW",
        userId: session.userId,
      },
    });

    return NextResponse.json({
      importHistoryId: importHistory.id,
      bankName: detection.bankName,
      isGenericParser: detection.isGeneric,
      transactions: enrichedTransactions,
      totalFound: parsed.length,
      duplicatesFound: enrichedTransactions.filter((t) => t.isDuplicate).length,
    });
  } catch (error) {
    console.error("Import upload error:", error);
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}
