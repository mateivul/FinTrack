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
    if (account.accountType === "CASH") {
      return NextResponse.json({ error: "Cash accounts cannot be used for statement imports" }, { status: 400 });
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

      if (ext !== "csv") {
        return NextResponse.json({ error: "Only CSV files are supported" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      content = buffer.toString("utf-8");
      fileType = "csv";
    } else if (textContent) {
      content = textContent;
      fileType = "text";
    } else {
      return NextResponse.json({ error: "No file or text provided" }, { status: 400 });
    }

    const detection = detectBank(content);

    const parsed = parseStatement(content, detection.parser ?? undefined);

    if (parsed.length === 0) {
      return NextResponse.json({
        error: "No transactions found in the file. Please check the format.",
      }, { status: 400 });
    }

    const minDate = new Date(Math.min(...parsed.map((t) => t.date.getTime())) - 86400000);
    const maxDate = new Date(Math.max(...parsed.map((t) => t.date.getTime())) + 86400000);
    const existingTxs = await prisma.transaction.findMany({
      where: {
        userId: session.userId,
        bankAccountId: accountId,
        date: { gte: minDate, lte: maxDate },
      },
      select: { id: true, amount: true, date: true, originalDescription: true },
    });

    const duplicateChecks = parsed.map((tx) => {
      const txTime = tx.date.getTime();
      const descKey = (tx.originalDescription ?? tx.description).substring(0, 60).toLowerCase();
      const existing = existingTxs.find(
        (e) =>
          e.amount === tx.amount &&
          Math.abs(new Date(e.date).getTime() - txTime) <= 86400000 &&
          (e.originalDescription ?? "").toLowerCase().includes(descKey)
      );
      const key = tx.patternKey ?? tx.description.toLowerCase().trim();
      return { ...tx, patternKey: key, isDuplicate: existing !== undefined, existingId: existing?.id };
    });

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
