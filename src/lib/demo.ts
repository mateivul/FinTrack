import { NextResponse } from "next/server";
import { SessionData } from "./auth";
import { prisma } from "./prisma";

export const DEMO_EMAIL = "demo@fintrack.app";

export function isDemoUser(session: Partial<SessionData>): boolean {
  return session.isDemo === true;
}

export function demoGuard(session: Partial<SessionData>): NextResponse | null {
  if (!isDemoUser(session)) return null;
  return NextResponse.json({ success: true, demo: true });
}

export async function cloneDemoUser() {
  const template = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: {
      tags: true,
      bankAccounts: true,
      savingsGoals: true,
      importHistories: true,
      recurringRules: { include: { tags: true } },
      transactions: { include: { tags: true } },
      importRules: { include: { tags: true } },
      budgets: true,
    },
  });

  if (!template) throw new Error("Demo template not found");

  await prisma.user.deleteMany({
    where: {
      isEphemeral: true,
      createdAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    },
  });

  return await prisma.$transaction(
    async (tx) => {
      const ephemeralEmail = `demo+${Date.now()}@ephemeral.fintrack.app`;

      const user = await tx.user.create({
        data: {
          email: ephemeralEmail,
          passwordHash: template.passwordHash,
          name: template.name,
          language: template.language,
          theme: template.theme,
          emailVerified: true,
          isEphemeral: true,
        },
      });

      const tagMap = new Map<string, string>();
      for (const tag of template.tags) {
        const newTag = await tx.tag.create({
          data: { name: tag.name, color: tag.color, userId: user.id },
        });
        tagMap.set(tag.id, newTag.id);
      }

      const accountMap = new Map<string, string>();
      for (const account of template.bankAccounts) {
        const newAccount = await tx.bankAccount.create({
          data: {
            name: account.name,
            accountType: account.accountType,
            bankName: account.bankName,
            currency: account.currency,
            accountNumber: account.accountNumber,
            color: account.color,
            icon: account.icon,
            currentBalance: account.currentBalance,
            isActive: account.isActive,
            userId: user.id,
          },
        });
        accountMap.set(account.id, newAccount.id);
      }

      const importHistoryMap = new Map<string, string>();
      for (const history of template.importHistories) {
        const newHistory = await tx.importHistory.create({
          data: {
            fileName: history.fileName,
            fileType: history.fileType,
            bankName: history.bankName,
            transactionsImported: history.transactionsImported,
            transactionsSkipped: history.transactionsSkipped,
            status: history.status,
            statementFrom: history.statementFrom,
            statementTo: history.statementTo,
            userId: user.id,
            createdAt: history.createdAt,
          },
        });
        importHistoryMap.set(history.id, newHistory.id);
      }

      const recurringRuleMap = new Map<string, string>();
      for (const rule of template.recurringRules) {
        const newRule = await tx.recurringRule.create({
          data: {
            description: rule.description,
            amount: rule.amount,
            type: rule.type,
            frequency: rule.frequency,
            nextOccurrence: rule.nextOccurrence,
            bankAccountId: accountMap.get(rule.bankAccountId)!,
            userId: user.id,
            isActive: rule.isActive,
          },
        });
        recurringRuleMap.set(rule.id, newRule.id);
        for (const rt of rule.tags) {
          const newTagId = tagMap.get(rt.tagId);
          if (newTagId) {
            await tx.recurringRuleTag.create({
              data: { recurringRuleId: newRule.id, tagId: newTagId },
            });
          }
        }
      }

      for (const txn of template.transactions) {
        const newTxn = await tx.transaction.create({
          data: {
            amount: txn.amount,
            type: txn.type,
            date: txn.date,
            description: txn.description,
            originalDescription: txn.originalDescription,
            notes: txn.notes,
            bankAccountId: accountMap.get(txn.bankAccountId)!,
            toAccountId: txn.toAccountId ? accountMap.get(txn.toAccountId) ?? undefined : undefined,
            userId: user.id,
            isRecurring: txn.isRecurring,
            recurringRuleId: txn.recurringRuleId ? recurringRuleMap.get(txn.recurringRuleId) ?? undefined : undefined,
            source: txn.source,
            importHistoryId: txn.importHistoryId ? importHistoryMap.get(txn.importHistoryId) ?? undefined : undefined,
            createdAt: txn.createdAt,
          },
        });
        for (const tt of txn.tags) {
          const newTagId = tagMap.get(tt.tagId);
          if (newTagId) {
            await tx.transactionTag.create({
              data: { transactionId: newTxn.id, tagId: newTagId },
            });
          }
        }
      }

      for (const rule of template.importRules) {
        const newRule = await tx.importRule.create({
          data: {
            userId: user.id,
            pattern: rule.pattern,
            description: rule.description,
            createdAt: rule.createdAt,
          },
        });
        for (const rt of rule.tags) {
          const newTagId = tagMap.get(rt.tagId);
          if (newTagId) {
            await tx.importRuleTag.create({
              data: { importRuleId: newRule.id, tagId: newTagId },
            });
          }
        }
      }

      for (const budget of template.budgets) {
        await tx.budget.create({
          data: {
            name: budget.name,
            tagId: budget.tagId ? (tagMap.get(budget.tagId) ?? undefined) : undefined,
            amount: budget.amount,
            period: budget.period,
            alertThreshold: budget.alertThreshold,
            isShared: false,
            rollover: budget.rollover,
            userId: user.id,
            createdAt: budget.createdAt,
          },
        });
      }

      for (const goal of template.savingsGoals) {
        await tx.savingsGoal.create({
          data: {
            name: goal.name,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            deadline: goal.deadline,
            icon: goal.icon,
            color: goal.color,
            monthlyContribution: goal.monthlyContribution,
            userId: user.id,
            createdAt: goal.createdAt,
          },
        });
      }

      return user;
    },
    { timeout: 30000 }
  );
}
