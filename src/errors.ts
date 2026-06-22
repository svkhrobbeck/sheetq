import { extractErrorMessage } from "./internal/utils";

/** sheetq — kontekstli xato va takror try/catch'ni yig'uvchi `wrap()`. */

/** Xato yuz bergan o'rin haqidagi kontekst. */
export interface ErrorContext {
  /** Qaysi model metodi (`"find"`, `"insert"`, `"update"`...). */
  method: string;
  /** Qaysi varaq (agar tegishli bo'lsa). */
  sheet?: string;
  /** Qaysi hujjat (agar tegishli bo'lsa). */
  spreadsheetId?: string;
}

/**
 * sheetq amallaridan otiladigan xato. Xabar tarkibida metod va varaq nomi bo'ladi
 * (mas. `"sheetq.insert (sheet: users): ..."`), `context` esa strukturali ma'lumot beradi.
 *
 * @example
 * ```ts
 * import { SpreadsheetError } from "sheetq";
 *
 * try {
 *   await Users.insert({ id: 1 });
 * } catch (err) {
 *   if (err instanceof SpreadsheetError) {
 *     console.error(err.message);  // "sheetq.insert (sheet: users): ..."
 *     console.error(err.context);  // { method: "insert", sheet: "users", ... }
 *   }
 * }
 * ```
 */
export class SpreadsheetError extends Error {
  override readonly name = "SpreadsheetError";

  /**
   * @param message - Tayyor (formatlangan) xato xabari.
   * @param context - Xato kontekti (`method`, `sheet`, `spreadsheetId`).
   */
  constructor(
    message: string,
    public readonly context: ErrorContext,
  ) {
    super(message);
  }
}

/**
 * Async amalni o'rab, har qanday xatoni kontekst bilan `SpreadsheetError`'ga
 * aylantiradi (allaqachon `SpreadsheetError` bo'lsa — o'zgartirmasdan o'tkazadi).
 *
 * @typeParam T - O'ralayotgan amalning natija tipi.
 * @param context - Xato kontekti (`method`, ixtiyoriy `sheet`/`spreadsheetId`).
 * @param fn - Bajariladigan async amal.
 * @returns `fn` natijasi.
 */
export async function wrap<T>(context: ErrorContext, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof SpreadsheetError) throw error;
    const where = context.sheet ? ` (sheet: ${context.sheet})` : "";
    throw new SpreadsheetError(`sheetq.${context.method}${where}: ${extractErrorMessage(error)}`, context);
  }
}
