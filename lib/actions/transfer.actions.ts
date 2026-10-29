"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "../appwrite";
import { isDemoBank } from "../demo-bank";
import { createTransfer } from "./dwolla.actions";
import { createTransaction } from "./transaction.actions";
import { getBank, getBankByAccountId } from "./user.actions";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

/**
 * The shareable id shown in the UI is a base64 encoded account id. Accept
 * either form so a pasted account id also works.
 */
const resolveReceiverAccountId = (value: string) => {  const trimmed = (value ?? "").trim();

  if (!trimmed) return "";

  try {
    const decoded =
      typeof atob === "function"
        ? atob(trimmed)
        : Buffer.from(trimmed, "base64").toString("binary");

    if (decoded && /^[\x20-\x7E]+$/.test(decoded)) return decoded;
  } catch {
    // Not base64, treat the value as an account id.
  }

  return trimmed;
};

/**
 * `userId` is a relationship, so it comes back as an object when the document
 * is read with its relations, but it is stored as a plain id.
 */
const resolveUserId = (bank: Bank): string => {
  const raw = bank.userId as unknown;

  if (raw && typeof raw === "object" && "$id" in raw) {
    return String((raw as { $id: string }).$id);
  }

  return String(raw ?? "");
};

const revalidateEverywhere = () => {
  revalidatePath("/");
  revalidatePath("/my-banks");
  revalidatePath("/payment-transfer");
  revalidatePath("/transaction-history");
};

/**
 * Moves money between two linked accounts.
 *
 * - demo accounts: the balance stored on the bank document is updated
 * - Plaid + Dwolla accounts: the transfer is created through Dwolla
 *
 * A transaction record is written in both cases so the history stays in sync.
 */
export const transferFunds = async ({
  senderBankId,
  receiverShareableId,
  amount,
  name,
  email,
}: {
  senderBankId: string;
  receiverShareableId: string;
  amount: string | number;
  name?: string;
  email?: string;
}) => {
  try {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false as const, error: "Enter a valid amount." };
    }

    const senderBank = await getBank({ documentId: senderBankId });

    if (!senderBank) {
      return { success: false as const, error: "Select the account you want to transfer from." };
    }

    const receiverAccountId = resolveReceiverAccountId(receiverShareableId);

    if (!receiverAccountId) {
      return { success: false as const, error: "Enter the receiver's shareable ID." };
    }

    const receiverBank = await getBankByAccountId({ accountId: receiverAccountId });

    if (!receiverBank) {
      return { success: false as const, error: "No account was found for that shareable ID." };
    }

    if (receiverBank.$id === senderBank.$id) {
      return { success: false as const, error: "Choose a different destination account." };
    }

    const senderId = resolveUserId(senderBank);
    const receiverId = resolveUserId(receiverBank);

    const transaction = {
      name: name?.trim() || "Transfer",
      amount: String(numericAmount),
      senderId,
      senderBankId: senderBank.$id,
      receiverId,
      receiverBankId: receiverBank.$id,
      email: email?.trim() || "no-reply@horizon.demo",
    };

    if (isDemoBank(senderBank) || isDemoBank(receiverBank)) {
      const { database } = await createAdminClient();

      const senderBalance = Number(senderBank.balance ?? 0);

      if (isDemoBank(senderBank) && senderBalance < numericAmount) {
        return {
          success: false as const,
          error: "Insufficient funds in the source account.",
        };
      }

      if (isDemoBank(senderBank)) {
        await database.updateDocument(
          DATABASE_ID!,
          BANK_COLLECTION_ID!,
          senderBank.$id,
          { balance: senderBalance - numericAmount }
        );
      }

      if (isDemoBank(receiverBank)) {
        await database.updateDocument(
          DATABASE_ID!,
          BANK_COLLECTION_ID!,
          receiverBank.$id,
          { balance: Number(receiverBank.balance ?? 0) + numericAmount }
        );
      }

      await createTransaction(transaction);

      revalidateEverywhere();

      return { success: true as const, error: null };
    }

    // Both accounts are real Plaid + Dwolla accounts.
    const transfer = await createTransfer({
      sourceFundingSourceUrl: senderBank.fundingSourceUrl,
      destinationFundingSourceUrl: receiverBank.fundingSourceUrl,
      amount: String(numericAmount),
    });

    if (!transfer) {
      return { success: false as const, error: "The transfer could not be created." };
    }

    await createTransaction(transaction);

    revalidateEverywhere();

    return { success: true as const, error: null };
  } catch (error) {
    console.error("Submitting the transfer failed:", error);

    return {
      success: false as const,
      error: "The transfer failed. Please try again.",
    };
  }
};
