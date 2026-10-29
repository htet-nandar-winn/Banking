/**
 * Helpers that check whether the optional third party integrations are
 * configured.
 *
 * These live outside of the `use server` action files on purpose: every export
 * of a `use server` module becomes an async server action, so a synchronous
 * helper placed there would be awaited into a promise (which is always
 * truthy) instead of returning a boolean.
 */

export const isDwollaConfigured = () =>
  Boolean(process.env.DWOLLA_KEY?.trim() && process.env.DWOLLA_SECRET?.trim());

export const isPlaidConfigured = () =>
  Boolean(process.env.PLAID_CLIENT_ID?.trim() && process.env.PLAID_SECRET?.trim());
