/**
 * Helpers for the built-in demo banking mode.
 *
 * Plaid and Dwolla need real API credentials. Until those are configured the
 * app can still be used end to end by creating accounts locally: the bank
 * document in Appwrite is the source of truth for the balance, and transfers
 * only move money between those documents.
 *
 * This file must stay a plain module (no "use server") so the helpers can be
 * imported from both server actions and client components.
 */

export const DEMO_ACCESS_TOKEN_PREFIX = "demo_";

export const DEMO_FUNDING_SOURCE_PREFIX = "demo://";

export const isDemoBank = (bank: Partial<Bank> | null | undefined): boolean => {
  if (!bank) return false;

  if (bank.isDemo) return true;

  return (
    typeof bank.accessToken === "string" &&
    bank.accessToken.startsWith(DEMO_ACCESS_TOKEN_PREFIX)
  );
};

export const isDemoFundingSource = (url?: string | null) =>
  typeof url === "string" && url.startsWith(DEMO_FUNDING_SOURCE_PREFIX);

/** Institutions offered by the "connect a bank" form. */
export const DEMO_INSTITUTIONS = [
  { id: "ins_demo_horizon", name: "Horizon Demo Bank" },
  { id: "ins_demo_atlas", name: "Atlas Savings" },
  { id: "ins_demo_northwind", name: "Northwind Credit Union" },
  { id: "ins_demo_meridian", name: "Meridian Trust" },
] as const;

/** Account types offered by the "connect a bank" form. */
export const DEMO_ACCOUNT_TYPES = [
  { value: "depository", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit card" },
] as const;

export const isDemoAccountType = (value: string) =>
  DEMO_ACCOUNT_TYPES.some((type) => type.value === value);
