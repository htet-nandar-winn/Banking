'use server';

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { cookies } from "next/headers";
import { encryptId, extractCustomerIdFromUrl, parseStringify } from "../utils";
import { getAuthErrorMessage } from "../errors";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";

import { isDwollaConfigured, isPlaidConfigured } from '@/lib/config';
import { plaidClient } from '@/lib/plaid';
import { revalidatePath } from "next/cache";
import {
  addFundingSource,
  createDwollaCustomer,
} from "./dwolla.actions";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

export const getUserInfo = async ({ userId }: getUserInfoProps): Promise<User> => {
  const { database } = await createAdminClient();

  const user = await database.listDocuments(
    DATABASE_ID!,
    USER_COLLECTION_ID!,
    [Query.equal('userId', [userId])]
  )

  if (user.total === 0) {
    throw new Error(
      'No profile was found for this account. Please sign up again to create one.'
    );
  }

  const document = user.documents[0] as Record<string, any>;

  // The profile is stored with lower camel case attribute names, but older
  // documents may still use the capitalised ones.
  const firstName = document.firstName ?? document.FirstName ?? '';
  const lastName = document.lastName ?? document.LastName ?? '';

  return parseStringify({
    ...document,
    firstName,
    lastName,
    name: document.name ?? `${firstName} ${lastName}`.trim(),
  });
}

export const signIn = async ({ email, password }: signInProps): Promise<
  { success: true; user: User } | { success: false; error: string }
> => {
  try {
    const { account } = await createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    const user = await getUserInfo({ userId: session.userId })

    return { success: true, user: parseStringify(user) };
  } catch (error) {
    console.error('Error signing in:', error);
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

export const signUp = async ({
  password,
  ...userData
}: SignUpParams): Promise<
  { success: true; user: User } | { success: false; error: string }
> => {
  const { email, firstName, lastName } = userData;

  let newUserAccount;
  let newUserProfileId: string | undefined;

  try {
    const { account, database } = await createAdminClient();

    newUserAccount = await account.create(
      ID.unique(),
      email,
      password,
      `${firstName} ${lastName}`
    );

    if(!newUserAccount) throw new Error('Error creating user')

    // Dwolla is optional at sign up. When it is not configured the customer is
    // created later on, the first time the user links a bank.
    let dwollaCustomerUrl = '';
    let dwollaCustomerId = '';

    if (isDwollaConfigured()) {
      const customerUrl = await createDwollaCustomer({
        ...userData,
        type: 'personal'
      })

      if(!customerUrl) throw new Error('Error creating Dwolla customer')

      dwollaCustomerUrl = customerUrl;
      dwollaCustomerId = extractCustomerIdFromUrl(customerUrl);
    } else {
      console.warn(
        'Dwolla is not configured - the Dwolla customer will be created when the first bank is linked.'
      );
    }

    const newUser = await database.createDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      ID.unique(),
      {
        email,
        firstName,
        lastName,
        address1: userData.address1,
        city: userData.city,
        state: userData.state,
        postalCode: userData.postalCode,
        dateOfBirth: userData.dateOfBirth,
        ssn: userData.ssn,
        userId: newUserAccount.$id,
        dwollaCustomerId,
        dwollaCustomerUrl
      }
    )

    newUserProfileId = newUser.$id;

    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return { success: true, user: parseStringify(newUser) };
  } catch (error) {
    console.error('Error creating user:', error);

    // Do not leave a half created account behind: without a profile document
    // the user would not be able to sign in again.
    try {
      const { database, user } = await createAdminClient();

      if (newUserProfileId) {
        await database.deleteDocument(
          DATABASE_ID!,
          USER_COLLECTION_ID!,
          newUserProfileId
        );
      }

      if (newUserAccount?.$id) {
        await user.delete(newUserAccount.$id);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up the sign up:', cleanupError);
    }

    return {
      success: false,
      error: getAuthErrorMessage(error),
    };
  }
}

export async function getLoggedInUser(): Promise<User | null> {
  try {
    const { account } = await createSessionClient();
    const result = await account.get();

    const user = await getUserInfo({ userId: result.$id})

    return parseStringify(user);
  } catch (error) {
    // "No session" / missing scopes just mean the visitor is not signed in,
    // which is not worth logging.
    const message = error instanceof Error ? error.message : '';
    const code = (error as { code?: number })?.code;

    if (code === 401 || message.includes('missing scopes') || message === 'No session') {
      return null;
    }

    console.error("Error getting logged-in user:", error);
    return null;
  }
}

export const logoutAccount = async () => {
  try {
    // Always clear the cookie, even if the remote session is already gone.
    cookies().delete('appwrite-session');

    const { account } = await createSessionClient();

    await account.deleteSession('current');

    return { success: true as const };
  } catch (error) {
    return { success: true as const };
  }
}

export const createLinkToken = async (user: User): Promise<
  { linkToken: string; error: null } | { linkToken: null; error: string }
> => {
  if (!isPlaidConfigured()) {
    return {
      linkToken: null,
      error:
        'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env.local to link a bank.',
    };
  }

  try {
    const tokenParams = {
      user: {
        client_user_id: user.$id
      },
      client_name: `${user.firstName} ${user.lastName}`,
      products: ['auth'] as Products[],
      language: 'en',
      country_codes: ['US'] as CountryCode[],
    }

    const response = await plaidClient.linkTokenCreate(tokenParams);

    return parseStringify({ linkToken: response.data.link_token, error: null })
  } catch (error) {
    console.error('Error creating the Plaid link token:', error);
    return { linkToken: null, error: getAuthErrorMessage(error) };
  }
}

// The Dwolla customer is created when the first bank is linked, so users that
// signed up before Dwolla was configured still get a customer.
export const ensureDwollaCustomer = async (user: User) => {
  if (user.dwollaCustomerId) return user.dwollaCustomerId;

  if (!isDwollaConfigured()) {
    throw new Error(
      'Dwolla is not configured. Add DWOLLA_KEY and DWOLLA_SECRET to .env.local to link a bank.'
    );
  }

  const dwollaCustomerUrl = await createDwollaCustomer({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    type: 'personal',
    address1: user.address1,
    city: user.city,
    state: user.state,
    postalCode: user.postalCode,
    dateOfBirth: user.dateOfBirth,
    ssn: user.ssn,
  });

  if (!dwollaCustomerUrl) throw new Error('Error creating Dwolla customer');

  const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);

  const { database } = await createAdminClient();

  await database.updateDocument(
    DATABASE_ID!,
    USER_COLLECTION_ID!,
    user.$id,
    { dwollaCustomerId, dwollaCustomerUrl }
  );

  return dwollaCustomerId;
}

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  try {
    const { database } = await createAdminClient();

    const bankAccount = await database.createDocument(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      ID.unique(),
      {
        userId,
        bankId,
        accountId,
        accessToken,
        fundingSourceUrl,
        shareableId,
      }
    )

    return parseStringify(bankAccount);
  } catch (error) {
    console.log(error);
  }
}

export const exchangePublicToken = async ({
  publicToken,
  user,
}: exchangePublicTokenProps) => {
  try {
    // Exchange public token for access token and item ID
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    
    // Get account information from Plaid using the access token
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accountData = accountsResponse.data.accounts[0];

    // Create a processor token for Dwolla using the access token and account ID
    const request: ProcessorTokenCreateRequest = {
      access_token: accessToken,
      account_id: accountData.account_id,
      processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
    };

    const processorTokenResponse = await plaidClient.processorTokenCreate(request);
    const processorToken = processorTokenResponse.data.processor_token;

     // Make sure the user has a Dwolla customer before adding a funding source
    const dwollaCustomerId = await ensureDwollaCustomer(user);

    // Create a funding source URL for the account using the Dwolla customer ID, processor token, and bank name
     const fundingSourceUrl = await addFundingSource({
      dwollaCustomerId: dwollaCustomerId,
      processorToken,
      bankName: accountData.name,
    });
    
    // If the funding source URL is not created, throw an error
    if (!fundingSourceUrl) throw new Error('Error creating the Dwolla funding source');

    // Create a bank account using the user ID, item ID, account ID, access token, funding source URL, and shareableId ID
    await createBankAccount({
      userId: user.$id,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl,
      shareableId: encryptId(accountData.account_id),
    });

    // Revalidate the path to reflect the changes
    revalidatePath("/");

    // Return a success message
    return parseStringify({
      publicTokenExchange: "complete",
    });
  } catch (error) {
    console.error("An error occurred while creating exchanging token:", error);
    return parseStringify({
      publicTokenExchange: "failed",
      error: getAuthErrorMessage(error),
    });
  }
}

export const getBanks = async ({ userId }: getBanksProps) => {
  try {
    const { database } = await createAdminClient();

    const banks = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    )

    return parseStringify(banks.documents);
  } catch (error) {
    console.log(error)
  }
}

export const getBank = async ({ documentId }: getBankProps) => {
  try {
    // The dashboard asks for a bank before one exists, in that case there is
    // nothing to look up.
    if (!documentId) return null;

    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('$id', [documentId])]
    )

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error)
  }
}

export const getBankByAccountId = async ({ accountId }: getBankByAccountIdProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('accountId', [accountId])]
    )

    if(bank.total !== 1) return null;

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error)
  }
}