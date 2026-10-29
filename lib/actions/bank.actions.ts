"use server";

import {
  ACHClass,
  CountryCode,
  TransferAuthorizationCreateRequest,
  TransferCreateRequest,
  TransferNetwork,
  TransferType,
} from "plaid";

import { plaidClient } from "../plaid";
import { isDemoBank } from "../demo-bank";
import { parseStringify } from "../utils";

import { getTransactionsByBankId } from "./transaction.actions";
import { getBanks, getBank } from "./user.actions";

/**
 * Builds the account shape the UI expects from a locally stored demo bank.
 */
const buildDemoAccount = (bank: Bank): Account => ({
  id: bank.accountId,
  availableBalance: Number(bank.balance ?? 0),
  currentBalance: Number(bank.balance ?? 0),
  institutionId: bank.bankId || "ins_demo",
  name: bank.accountName || bank.institutionName || "Demo account",
  officialName: bank.institutionName || "Horizon Demo Bank",
  mask: bank.mask || "0000",
  type: bank.accountType || "depository",
  subtype: bank.accountType || "checking",
  appwriteItemId: bank.$id,
  shareableId: bank.shareableId,
});

// Get multiple bank accounts
export const getAccounts = async ({ userId }: getAccountsProps) => {
  try {
    // get banks from db
    const banks = await getBanks({ userId });

    // `getBanks` returns `undefined` when the query fails, so fall back to an
    // empty list instead of letting `Promise.all` blow up on `undefined`.
    const settled = await Promise.all(
      (banks ?? []).map(async (bank: Bank): Promise<Account | null> => {
        if (isDemoBank(bank)) return buildDemoAccount(bank);

        // A single unlinked / broken Plaid item must not take the whole
        // dashboard down, so failures are contained per bank.
        try {
          const accountsResponse = await plaidClient.accountsGet({
            access_token: bank.accessToken,
          });
          const accountData = accountsResponse.data.accounts[0];

          const institution = await getInstitution({
            institutionId: accountsResponse.data.item.institution_id!,
          });

          return {
            id: accountData.account_id,
            availableBalance: accountData.balances.available!,
            currentBalance: accountData.balances.current!,
            institutionId: institution?.institution_id ?? "",
            name: accountData.name,
            officialName: accountData.official_name ?? "",
            mask: accountData.mask!,
            type: accountData.type as string,
            subtype: accountData.subtype! as string,
            appwriteItemId: bank.$id,
            shareableId: bank.shareableId,
          };
        } catch (bankError) {
          console.error(`Could not load the Plaid account ${bank.$id}:`, bankError);
          return null;
        }
      })
    );

    const accounts = settled.filter((account): account is Account => Boolean(account));

    const totalBanks = accounts.length;
    const totalCurrentBalance = accounts.reduce((total, account) => {
      return total + Number(account.currentBalance ?? 0);
    }, 0);

    return parseStringify({ data: accounts, totalBanks, totalCurrentBalance });
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
    return parseStringify({ data: [], totalBanks: 0, totalCurrentBalance: 0 });
  }
};

// Get one bank account
export const getAccount = async ({ appwriteItemId }: getAccountProps) => {
  try {
    // get bank from db
    const bank = await getBank({ documentId: appwriteItemId });

    // The user has no linked bank yet.
    if (!bank) return;

    const transferTransactionsData = await getTransactionsByBankId({
      bankId: bank.$id,
    });

    const transferTransactions = (transferTransactionsData?.documents ?? []).map(
      (transferData: Transaction) => ({
        id: transferData.$id,
        name: transferData.name!,
        amount: Number(transferData.amount ?? 0),
        date: transferData.date ?? transferData.$createdAt,
        paymentChannel: transferData.channel,
        category: transferData.category,
        type: transferData.senderBankId === bank.$id ? "debit" : "credit",
      })
    );

    // Demo accounts are fully local: the bank document holds the balance and
    // the transactions live in Appwrite, Plaid is never called.
    if (isDemoBank(bank)) {
      const sortedTransactions = [...transferTransactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return parseStringify({
        data: buildDemoAccount(bank),
        transactions: sortedTransactions,
      });
    }

    // get account info from plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: bank.accessToken,
    });
    const accountData = accountsResponse.data.accounts[0];

    // get institution info from plaid
    const institution = await getInstitution({
      institutionId: accountsResponse.data.item.institution_id!,
    });

    const transactions = await getTransactions({
      accessToken: bank?.accessToken,
    });

    const account = {
      id: accountData.account_id,
      availableBalance: accountData.balances.available!,
      currentBalance: accountData.balances.current!,
      institutionId: institution?.institution_id ?? "",
      name: accountData.name,
      officialName: accountData.official_name,
      mask: accountData.mask!,
      type: accountData.type as string,
      subtype: accountData.subtype! as string,
      appwriteItemId: bank.$id,
      shareableId: bank.shareableId,
    };

    // sort transactions by date such that the most recent transaction is first
    const allTransactions = [...(transactions ?? []), ...transferTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return parseStringify({
      data: account,
      transactions: allTransactions,
    });
  } catch (error) {
    console.error("An error occurred while getting the account:", error);
  }
};

// Get bank info
export const getInstitution = async ({
  institutionId,
}: getInstitutionProps) => {
  try {
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: ["US"] as CountryCode[],
    });

    const intitution = institutionResponse.data.institution;

    return parseStringify(intitution);
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
  }
};

// Get transactions
export const getTransactions = async ({
  accessToken,
}: getTransactionsProps) => {
  let hasMore = true;
  let transactions: any = [];

  try {
    // Iterate through each page of new transaction updates for item
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
      });

      const data = response.data;

      transactions = response.data.added.map((transaction) => ({
        id: transaction.transaction_id,
        name: transaction.name,
        paymentChannel: transaction.payment_channel,
        type: transaction.payment_channel,
        accountId: transaction.account_id,
        amount: transaction.amount,
        pending: transaction.pending,
        category: transaction.category ? transaction.category[0] : "",
        date: transaction.date,
        image: transaction.logo_url,
      }));

      hasMore = data.has_more;
    }

    return parseStringify(transactions);
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
  }
};