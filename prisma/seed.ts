import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@fintrack.app";
const DEMO_PASSWORD = "demo1234";

function daysAgo(n: number, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const existingDemo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existingDemo) {
    await prisma.user.delete({ where: { id: existingDemo.id } });
    console.log("Cleaned up existing demo user.");
  }

  const demo = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Alex Demo",
      language: "EN",
      theme: "SYSTEM",
      emailVerified: true,
      isDemo: true,
    },
  });

  // custom tags
  const tagDefs = [
    { name: "groceries",     color: "#22c55e" },
    { name: "food",          color: "#f97316" },
    { name: "transport",     color: "#3b82f6" },
    { name: "utilities",     color: "#eab308" },
    { name: "subscriptions", color: "#a855f7" },
    { name: "entertainment", color: "#ec4899" },
    { name: "health",        color: "#ef4444" },
    { name: "shopping",      color: "#14b8a6" },
    { name: "salary",        color: "#10b981" },
    { name: "savings",       color: "#6366f1" },
    { name: "travel",        color: "#06b6d4" },
    { name: "freelance",     color: "#8b5cf6" },
  ];

  const tagMap: Record<string, string> = {};
  for (const def of tagDefs) {
    const tag = await prisma.tag.create({ data: { name: def.name, color: def.color, userId: demo.id } });
    tagMap[def.name] = tag.id;
  }

  // demo accounts
  const cardAccount = await prisma.bankAccount.create({
    data: {
      name: "Checking Account",
      accountType: "CARD",
      bankName: "N26",
      currency: "EUR",
      color: "#3b82f6",
      icon: "credit-card",
      currentBalance: 3218.45,
      userId: demo.id,
    },
  });

  const cashAccount = await prisma.bankAccount.create({
    data: {
      name: "Cash",
      accountType: "CASH",
      currency: "EUR",
      color: "#10b981",
      icon: "banknote",
      currentBalance: 185.00,
      userId: demo.id,
    },
  });

  const savingsAccount = await prisma.bankAccount.create({
    data: {
      name: "Savings",
      accountType: "SAVINGS",
      bankName: "Trade Republic",
      currency: "EUR",
      color: "#f59e0b",
      icon: "piggy-bank",
      currentBalance: 8750.00,
      userId: demo.id,
    },
  });

  // demo import history 
  const importMonth1 = await prisma.importHistory.create({
    data: {
      fileName: "N26_2025-02.csv",
      fileType: "csv",
      bankName: "N26",
      transactionsImported: 18,
      transactionsSkipped: 2,
      status: "COMPLETED",
      statementFrom: daysAgo(59),
      statementTo: daysAgo(31),
      userId: demo.id,
    },
  });

  const importMonth2 = await prisma.importHistory.create({
    data: {
      fileName: "N26_2025-01.csv",
      fileType: "csv",
      bankName: "N26",
      transactionsImported: 21,
      transactionsSkipped: 1,
      status: "COMPLETED",
      statementFrom: daysAgo(90),
      statementTo: daysAgo(60),
      userId: demo.id,
    },
  });

  // demo import rules
  const importRules = [
    { pattern: "NETFLIX",        description: "Netflix",             tagNames: ["subscriptions", "entertainment"] },
    { pattern: "SPOTIFY",        description: "Spotify",             tagNames: ["subscriptions"] },
    { pattern: "LIDL",           description: "Lidl supermarket",    tagNames: ["groceries"] },
    { pattern: "ALDI",           description: "Aldi supermarket",    tagNames: ["groceries"] },
    { pattern: "REWE",           description: "REWE supermarket",    tagNames: ["groceries"] },
    { pattern: "UBER",           description: "Uber ride",           tagNames: ["transport"] },
    { pattern: "DB BAHN",        description: "Deutsche Bahn",       tagNames: ["transport", "travel"] },
    { pattern: "EDEKA",          description: "Edeka supermarket",   tagNames: ["groceries"] },
    { pattern: "STADTWERKE",     description: "Utilities",           tagNames: ["utilities"] },
    { pattern: "SALARY",         description: "Monthly salary",      tagNames: ["salary"] },
  ];

  for (const rule of importRules) {
    await prisma.importRule.create({
      data: {
        userId: demo.id,
        pattern: rule.pattern,
        description: rule.description,
        tags: {
          create: rule.tagNames.map((name) => ({ tagId: tagMap[name] })),
        },
      },
    });
  }

  // and some demo transactions
  type TxRow = {
    amount: number;
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    date: Date;
    description: string;
    accountId: string;
    toAccountId?: string;
    tagNames: string[];
    importHistoryId?: string;
    source?: "MANUAL" | "IMPORT" | "RECURRING";
  };

  const txData: TxRow[] = [
    // tranzactions
    { amount: 3200, type: "INCOME",   date: daysAgo(2),  description: "Salary March",           accountId: cardAccount.id,   tagNames: ["salary"],                       source: "MANUAL" },
    { amount: 650,  type: "INCOME",   date: daysAgo(5),  description: "Freelance — web project", accountId: cardAccount.id,  tagNames: ["freelance"],                     source: "MANUAL" },
    { amount: 62,   type: "EXPENSE",  date: daysAgo(1),  description: "Lidl",                   accountId: cardAccount.id,   tagNames: ["groceries"],                     source: "MANUAL" },
    { amount: 38,   type: "EXPENSE",  date: daysAgo(2),  description: "Rewe",                   accountId: cardAccount.id,   tagNames: ["groceries"],                     source: "MANUAL" },
    { amount: 24,   type: "EXPENSE",  date: daysAgo(3),  description: "Uber ride",              accountId: cardAccount.id,   tagNames: ["transport"],                     source: "MANUAL" },
    { amount: 97,   type: "EXPENSE",  date: daysAgo(4),  description: "Stadtwerke electricity",  accountId: cardAccount.id,  tagNames: ["utilities"],                     source: "MANUAL" },
    { amount: 15.99,type: "EXPENSE",  date: daysAgo(5),  description: "Netflix",                accountId: cardAccount.id,   tagNames: ["subscriptions", "entertainment"],source: "MANUAL" },
    { amount: 9.99, type: "EXPENSE",  date: daysAgo(5),  description: "Spotify",                accountId: cardAccount.id,   tagNames: ["subscriptions"],                 source: "MANUAL" },
    { amount: 20,   type: "EXPENSE",  date: daysAgo(6),  description: "ChatGPT Plus",           accountId: cardAccount.id,   tagNames: ["subscriptions"],                 source: "MANUAL" },
    { amount: 55,   type: "EXPENSE",  date: daysAgo(7),  description: "Aldi",                   accountId: cardAccount.id,   tagNames: ["groceries"],                     source: "MANUAL" },
    { amount: 42,   type: "EXPENSE",  date: daysAgo(8),  description: "Pharmacy",               accountId: cardAccount.id,   tagNames: ["health"],                        source: "MANUAL" },
    { amount: 88,   type: "EXPENSE",  date: daysAgo(9),  description: "Zara jacket",            accountId: cardAccount.id,   tagNames: ["shopping"],                      source: "MANUAL" },
    { amount: 34,   type: "EXPENSE",  date: daysAgo(10), description: "Restaurant Vapiano",     accountId: cashAccount.id,   tagNames: ["food"],                          source: "MANUAL" },
    { amount: 18,   type: "EXPENSE",  date: daysAgo(11), description: "DB Bahn ticket",         accountId: cardAccount.id,   tagNames: ["transport"],                     source: "MANUAL" },
    { amount: 500,  type: "TRANSFER", date: daysAgo(6),  description: "Transfer to savings",    accountId: cardAccount.id,   toAccountId: savingsAccount.id, tagNames: ["savings"], source: "MANUAL" },

    // older transactions
    { amount: 3200, type: "INCOME",  date: daysAgo(32), description: "Salary February",         accountId: cardAccount.id,  tagNames: ["salary"],                         source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 400,  type: "INCOME",  date: daysAgo(38), description: "Freelance — design work", accountId: cardAccount.id,  tagNames: ["freelance"],                      source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 58,   type: "EXPENSE", date: daysAgo(33), description: "Lidl",                    accountId: cardAccount.id,  tagNames: ["groceries"],                      source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 45,   type: "EXPENSE", date: daysAgo(34), description: "Rewe",                    accountId: cardAccount.id,  tagNames: ["groceries"],                      source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 97,   type: "EXPENSE", date: daysAgo(35), description: "Stadtwerke electricity",  accountId: cardAccount.id,  tagNames: ["utilities"],                      source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 15.99,type: "EXPENSE", date: daysAgo(36), description: "Netflix",                 accountId: cardAccount.id,  tagNames: ["subscriptions", "entertainment"], source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 9.99, type: "EXPENSE", date: daysAgo(36), description: "Spotify",                 accountId: cardAccount.id,  tagNames: ["subscriptions"],                  source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 28,   type: "EXPENSE", date: daysAgo(37), description: "Edeka",                   accountId: cardAccount.id,  tagNames: ["groceries"],                      source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 240,  type: "EXPENSE", date: daysAgo(38), description: "Dentist",                 accountId: cardAccount.id,  tagNames: ["health"],                         source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 52,   type: "EXPENSE", date: daysAgo(39), description: "Uber ride",               accountId: cardAccount.id,  tagNames: ["transport"],                      source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 78,   type: "EXPENSE", date: daysAgo(40), description: "H&M",                     accountId: cardAccount.id,  tagNames: ["shopping"],                       source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 45,   type: "EXPENSE", date: daysAgo(41), description: "Cinema Cinestar",         accountId: cashAccount.id,  tagNames: ["entertainment"],                  source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 29,   type: "EXPENSE", date: daysAgo(42), description: "Burger restaurant",       accountId: cashAccount.id,  tagNames: ["food"],                           source: "IMPORT", importHistoryId: importMonth1.id },
    { amount: 500,  type: "TRANSFER",date: daysAgo(34), description: "Transfer to savings",     accountId: cardAccount.id,  toAccountId: savingsAccount.id, tagNames: ["savings"], source: "IMPORT", importHistoryId: importMonth1.id },

    // even older transactions
    { amount: 3200, type: "INCOME",  date: daysAgo(62), description: "Salary January",          accountId: cardAccount.id,  tagNames: ["salary"],                         source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 520,  type: "INCOME",  date: daysAgo(70), description: "Freelance — consulting",  accountId: cardAccount.id,  tagNames: ["freelance"],                      source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 72,   type: "EXPENSE", date: daysAgo(62), description: "Rewe",                    accountId: cardAccount.id,  tagNames: ["groceries"],                      source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 55,   type: "EXPENSE", date: daysAgo(63), description: "Lidl",                    accountId: cardAccount.id,  tagNames: ["groceries"],                      source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 99,   type: "EXPENSE", date: daysAgo(64), description: "Stadtwerke electricity",  accountId: cardAccount.id,  tagNames: ["utilities"],                      source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 15.99,type: "EXPENSE", date: daysAgo(65), description: "Netflix",                 accountId: cardAccount.id,  tagNames: ["subscriptions", "entertainment"], source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 9.99, type: "EXPENSE", date: daysAgo(65), description: "Spotify",                 accountId: cardAccount.id,  tagNames: ["subscriptions"],                  source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 139,  type: "EXPENSE", date: daysAgo(66), description: "Zara winter coat",        accountId: cardAccount.id,  tagNames: ["shopping"],                       source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 68,   type: "EXPENSE", date: daysAgo(67), description: "New Year dinner",         accountId: cashAccount.id,  tagNames: ["food", "entertainment"],           source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 320,  type: "EXPENSE", date: daysAgo(68), description: "Ryanair flight — Malaga", accountId: cardAccount.id,  tagNames: ["travel"],                         source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 22,   type: "EXPENSE", date: daysAgo(69), description: "DB Bahn ticket",          accountId: cardAccount.id,  tagNames: ["transport"],                      source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 45,   type: "EXPENSE", date: daysAgo(70), description: "Edeka",                   accountId: cardAccount.id,  tagNames: ["groceries"],                      source: "IMPORT", importHistoryId: importMonth2.id },
    { amount: 500,  type: "TRANSFER",date: daysAgo(63), description: "Transfer to savings",     accountId: cardAccount.id,  toAccountId: savingsAccount.id, tagNames: ["savings"], source: "IMPORT", importHistoryId: importMonth2.id },
  ];

  for (const tx of txData) {
    await prisma.transaction.create({
      data: {
        amount: tx.amount,
        type: tx.type,
        date: tx.date,
        description: tx.description,
        bankAccountId: tx.accountId,
        toAccountId: tx.toAccountId,
        userId: demo.id,
        source: tx.source ?? "MANUAL",
        importHistoryId: tx.importHistoryId,
        tags: tx.tagNames.length
          ? { create: tx.tagNames.map((name) => ({ tagId: tagMap[name] })) }
          : undefined,
      },
    });
  }

  // demo budgets
  const budgets = [
    { name: "Groceries",     tag: "groceries",     amount: 250 },
    { name: "Food & Dining", tag: "food",          amount: 150 },
    { name: "Transport",     tag: "transport",     amount: 100 },
    { name: "Subscriptions", tag: "subscriptions", amount: 60  },
    { name: "Entertainment", tag: "entertainment", amount: 80  },
    { name: "Shopping",      tag: "shopping",      amount: 200 },
  ];

  for (const b of budgets) {
    await prisma.budget.create({
      data: { name: b.name, tagId: tagMap[b.tag], amount: b.amount, period: "MONTHLY", alertThreshold: 0.8, userId: demo.id },
    });
  }

  // demo savings goals
  await prisma.savingsGoal.create({
    data: { name: "Emergency Fund (6 months)", targetAmount: 15000, currentAmount: 8750, deadline: new Date(Date.now() + 10 * 30 * 24 * 60 * 60 * 1000), color: "#10b981", monthlyContribution: 500, userId: demo.id },
  });
  await prisma.savingsGoal.create({
    data: { name: "Japan Trip 2026", targetAmount: 4000, currentAmount: 1200, deadline: new Date(Date.now() + 9 * 30 * 24 * 60 * 60 * 1000), color: "#06b6d4", monthlyContribution: 300, userId: demo.id },
  });
  await prisma.savingsGoal.create({
    data: { name: "New MacBook Pro", targetAmount: 2500, currentAmount: 900, deadline: new Date(Date.now() + 5 * 30 * 24 * 60 * 60 * 1000), color: "#8b5cf6", monthlyContribution: 350, userId: demo.id },
  });

  // recurring rules
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);

  const recurring = [
    { description: "Netflix",        amount: 15.99, type: "EXPENSE" as const, tags: ["subscriptions", "entertainment"] },
    { description: "Spotify",        amount: 9.99,  type: "EXPENSE" as const, tags: ["subscriptions"] },
    { description: "ChatGPT Plus",   amount: 20,    type: "EXPENSE" as const, tags: ["subscriptions"] },
    { description: "Salary",         amount: 3200,  type: "INCOME"  as const, tags: ["salary"] },
    { description: "Rent",           amount: 950,   type: "EXPENSE" as const, tags: ["utilities"] },
  ];

  for (const r of recurring) {
    await prisma.recurringRule.create({
      data: {
        description: r.description,
        amount: r.amount,
        type: r.type,
        frequency: "MONTHLY",
        nextOccurrence: nextMonth,
        bankAccountId: cardAccount.id,
        userId: demo.id,
        isActive: true,
        tags: { create: r.tags.map((name) => ({ tagId: tagMap[name] })) },
      },
    });
  }

  console.log("Demo user seeded successfully!");
  console.log(`  Email: ${DEMO_EMAIL} | Password: ${DEMO_PASSWORD}`);
  console.log(`  Currency: EUR | Accounts: 3 | Transactions: ${txData.length}`);
  console.log(`  Imports: 2 | Import rules: ${importRules.length} | Budgets: ${budgets.length} | Goals: 3 | Recurring: ${recurring.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
