/**
 * sheetq ichki yordamchilari — tashqi `utilzify` ga bog'lanmaslik uchun
 * shu yerda mustaqil saqlanadi (kichik, bog'liqliksiz funksiyalar).
 */

/**
 * Ustun harfini 0-asosli indeksga aylantiradi: "A" → 0, "B" → 1, "Z" → 25,
 * "AA" → 26 ... Row massivlarini indekslashda ishlatiladi.
 */
const cacheUtil = {
  columnIndexCache: new Map<string, number>(),
  columnNameCache: new Map<number, string>(),
};

export function getColumnIndex(columnName: string): number {
  const upperColumnName = columnName.toUpperCase();
  if (cacheUtil.columnIndexCache.has(upperColumnName)) {
    return cacheUtil.columnIndexCache.get(upperColumnName)!;
  }

  let index = 0;
  for (let i = 0; i < upperColumnName.length; i++) {
    index = index * 26 + (upperColumnName.charCodeAt(i) - 65 + 1);
  }

  const result = index - 1;
  cacheUtil.columnIndexCache.set(upperColumnName, result);
  return result;
}

/**
 * Kod kerakli muhitda ishlayotganini tekshiradi. sheetq Google service-account
 * bilan ishlaydi — faqat backend (Node.js). Browserda chaqirilsa xato beradi.
 */
export const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

export const isNode = () => typeof process !== "undefined" && Boolean(process.versions?.node);

export const checkEnvironment = (target: "frontend" | "backend"): boolean => {
  const isFrontend = isBrowser();
  const isBackend = isNode();

  if (target === "frontend" && !isFrontend) {
    throw new Error("This function can only be used in a frontend environment.");
  }

  if (target === "backend" && !isBackend) {
    throw new Error("This function can only be used in a backend environment.");
  }

  return target === "frontend" ? isFrontend : isBackend;
};

/** Noma'lum (unknown) xatodan o'qish uchun matn xabarini chiqaradi. */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
