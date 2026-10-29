"use server";

import { ID, Query } from "node-appwrite";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "../appwrite";
import { DEMO_ACCESS_TOKEN_PREFIX, DEMO_FUNDING_SOURCE_PREFIX } from "../demo-bank";
import { encryptId, parseStringify } from "../utils";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
  APPWRITE_TRANSACTION_COLLECTION_ID: TRANSACTION_COLLECTION_ID,
} = process.env;

const MAX_BALANCE = 1_000_000;

const randomDigits = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

const randomToken = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/**
 * A small, realistic transaction history so a brand new demo account does not
 * look empty. These are historical, they do not change the starting balance.
 */
const SEED_TRANSACTIONS = [
  { name: "Payroll deposit", amount: 4200, direction: "credit", category: "Transfer", channel: "online", daysAgo: 26 },
  { name: "Whole Foods Market", amount: 128.42, direction: "debit", category: "Food and Drink", channel: "in person", daysAgo: 23 },
  { name: "Blue Bottle Coffee", amount: 6.75, direction: "debit", category: "Food and Drink", channel: "in person", daysAgo: 20 },
  { name: "Netflix", amount: 15.49, direction: "debit", category: "Payment", channel: "online", daysAgo: 18 },
  { name: "Shell", amount: 62.1, direction: "debit", category: "Travel", channel: "in person", daysAgo: 14 },
  { name: "Rent", amount: 1850, direction: "debit", category: "Payment", channel: "online", daysAgo: 11 },
  { name: "Refund - Amazon", amount: 39.99, direction: "credit", category: "Payment", channel: "online", daysAgo: 7 },
  { name: "Monthly account fee", amount: 4.95, direction: "debit", category: "Bank Fees", channel: "online", daysAgo: 4 },
  { name: "Transfer to savings", amount: 250, direction: "debit", category: "Transfer", channel: "online", daysAgo: 2 },
];

const seedDemoTransactions = async ({
  bankId,
  userId,
  email,
}: {
  bankId: string;
  userId: string;
  email: string;
}) => {
  const { database } = await createAdminClient();

  await Promise.all(
    SEED_TRANSACTIONS.map((seed) =>
      database.createDocument(
        DATABASE_ID!,
        TRANSACTION_COLLECTION_ID!,
        ID.unique(),
        {
          name: seed.name,
          amount: seed.amount,
          senderId: seed.direction === "debit" ? userId : "demo-external",
          senderBankId: seed.direction === "debit" ? bankId : "demo-external-bank",
          receiverId: seed.direction === "credit" ? userId : "demo-external",
          receiverBankId: seed.direction === "credit" ? bankId : "demo-external-bank",
          email,
          channel: seed.channel,
          category: seed.category,
          date: new Date(Date.now() - seed.daysAgo * 86_400_000).toISOString(),
        }
      )
    )
  );
};

export const createDemoBankAccount = async ({
  userId,
  email,
  institutionName,
  accountName,
  accountType,
  balance,
}: {
  userId: string;
  email: string;
  institutionName: string;
  accountName: string;
  accountType: string;
  balance: string | number;
}) => {
  try {
    if (!userId) {
      return { success: false as const, error: "You must be signed in to add an account." };
    }

    const startingBalance = Number(balance);

    if (!Number.isFinite(startingBalance) || startingBalance < 0) {
      return { success: false as const, error: "Enter a valid starting balance." };
    }

    if (startingBalance > MAX_BALANCE) {
      return { success: false as const, error: `The starting balance must be below ${MAX_BALANCE}.` };
    }

    const { database } = await createAdminClient();

    const accountId = `demo-${randomToken()}${randomDigits(4)}`;

    const bank = await database.createDocument(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      ID.unique(),
      {
        bankId: "ins_demo",
        accountId,
        accessToken: `${DEMO_ACCESS_TOKEN_PREFIX}${randomToken()}`,
        fundingSourceUrl: `${DEMO_FUNDING_SOURCE_PREFIX}${accountId}`,
        shareableId: encryptId(accountId),
        userId,
        balance: startingBalance,
        institutionName: institutionName || "Horizon Demo Bank",
        accountName: accountName || "Everyday checking",
        accountType: accountType || "depository",
        mask: randomDigits(4),
        isDemo: true,
      }
    );

    try {
      await seedDemoTransactions({ bankId: bank.$id, userId, email });
    } catch (seedError) {
      // The account itself was created, a missing history is not fatal.
      console.error("Could not seed the demo transactions:", seedError);
    }

    revalidatePath("/");
    revalidatePath("/my-banks");
    revalidatePath("/payment-transfer");
    revalidatePath("/transaction-history");

    return parseStringify({ success: true, bank });
  } catch (error) {
    console.error("Error creating the demo bank account:", error);
    return { success: false as const, error: "Could not create the account. Please try again." };
  }
};

export const deleteDemoBankAccount = async ({ bankId }: { bankId: string }) => {
  try {
    if (!bankId) return { success: false as const, error: "Missing account." };

    const { database } = await createAdminClient();

    const [sent, received] = await Promise.all([
      database.listDocuments(DATABASE_ID!, TRANSACTION_COLLECTION_ID!, [
        Query.equal("senderBankId", bankId),
      ]),
      database.listDocuments(DATABASE_ID!, TRANSACTION_COLLECTION_ID!, [
        Query.equal("receiverBankId", bankId),
      ]),
    ]);

    await Promise.all(
      [...sent.documents, ...received.documents].map((transaction) =>
        database.deleteDocument(
          DATABASE_ID!,
          TRANSACTION_COLLECTION_ID!,
          transaction.$id
        )
      )
    );

    await database.deleteDocument(DATABASE_ID!, BANK_COLLECTION_ID!, bankId);

    revalidatePath("/");
    revalidatePath("/my-banks");
    revalidatePath("/payment-transfer");
    revalidatePath("/transaction-history");

    return { success: true as const, error: null };
  } catch (error) {
    console.error("Error deleting the demo bank account:", error);
    return { success: false as const, error: "Could not delete the account." };
  }
};
