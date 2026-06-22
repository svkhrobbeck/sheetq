import { google } from "googleapis";

import type { ServiceAccountCredentials, SpreadsheetOptions } from "./types";

const SCOPE_READWRITE = "https://www.googleapis.com/auth/spreadsheets";
const SCOPE_READONLY = "https://www.googleapis.com/auth/spreadsheets.readonly";

export type GoogleAuthClient = InstanceType<typeof google.auth.GoogleAuth>;

export function normalizeKey(key: string): string {
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

export function resolveScopes(options: SpreadsheetOptions): string[] {
  if (options.scopes?.length) return options.scopes;
  return [options.readonly ? SCOPE_READONLY : SCOPE_READWRITE];
}

export function parseCredentialArgs(
  a: ServiceAccountCredentials | string,
  b?: string | SpreadsheetOptions,
  c?: SpreadsheetOptions,
): { credentials: ServiceAccountCredentials; options: SpreadsheetOptions } {
  if (typeof a === "string") {
    if (typeof b !== "string") {
      throw new Error("sheetq: clientEmail bilan birga privateKey berilishi shart");
    }
    return { credentials: { client_email: a, private_key: b }, options: c ?? {} };
  }

  if (!a?.client_email || !a?.private_key) {
    throw new Error("sheetq: credentials ichida client_email va private_key bo'lishi shart");
  }
  return { credentials: a, options: (b as SpreadsheetOptions) ?? {} };
}

export function createAuth(credentials: ServiceAccountCredentials, options: SpreadsheetOptions): GoogleAuthClient {
  return new google.auth.GoogleAuth({
    credentials: { ...credentials, private_key: normalizeKey(credentials.private_key) },
    scopes: resolveScopes(options),
  });
}
