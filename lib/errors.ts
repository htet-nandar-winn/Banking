/**
 * Converts an Appwrite / configuration error into a message that can safely be
 * shown to the user. The raw Appwrite messages are often cryptic ("missing
 * scopes") so they are translated into something actionable.
 */

type AppwriteLikeError = Error & {
  code?: number;
  type?: string;
};

const getErrorDetails = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const { code, type } = (error ?? {}) as AppwriteLikeError;

  return { message, code: code ?? 0, type: type ?? "" };
};

export const getAuthErrorMessage = (error: unknown): string => {
  const { message, type } = getErrorDetails(error);

  // The Appwrite API key does not have every permission the app needs.
  if (message.includes("missing scopes") || type === "general_unauthorized_scope") {
    return 'The Appwrite API key is missing permissions. Add the "documents.read", "documents.write", "collections.read" and "collections.write" scopes to the API key in the Appwrite console (Project → Integrations → API Keys), then restart the dev server.';
  }

  switch (type) {
    case "user_invalid_credentials":
      return "Invalid email or password. Please try again.";

    case "user_already_exists":
      return "An account with this email already exists. Try signing in instead.";

    case "user_unauthorized":
      return "Your session is no longer valid. Please sign in again.";

    case "general_unauthorized_scope":
      return "The Appwrite API key does not have the permissions required for this action.";

    case "document_already_exists":
      return "That record already exists.";

    default:
      break;
  }

  if (message.includes("Invalid credentials")) {
    return "Invalid email or password. Please try again.";
  }

  if (message.includes("already exists")) {
    return "An account with this email already exists. Try signing in instead.";
  }

  return message.trim() ||
    "Something went wrong. Please try again.";
};
