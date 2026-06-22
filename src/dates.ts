import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import type { Cell, ColumnType } from "./types";

/**
 * sheetq — sana ishlovi (dayjs).
 * Ustun tipi "date" (default) yoki "date:FORMAT" bo'lishi mumkin.
 * FORMAT — dayjs formati, mas: "date:DD.MM.YYYY HH:mm:ss".
 * Bu, ayniqsa, sana sheetda STRING bo'lib saqlangan holatlar uchun.
 */
dayjs.extend(customParseFormat);

/** "date:DD.MM.YYYY" → "DD.MM.YYYY"; oddiy "date" → undefined. */
export function dateFormatOf(type: ColumnType): string | undefined {
  return type.startsWith("date:") ? type.slice(5) : undefined;
}

/** Xom qiymatni Date'ga aylantiradi. format berilsa — aynan shu format bo'yicha parse. */
export function parseDate(raw: unknown, format?: string): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (raw === null || raw === undefined || raw === "") return null;

  const d = format ? dayjs(String(raw), format) : dayjs(String(raw));
  return d.isValid() ? d.toDate() : null;
}

/** Date'ni katakka yoziladigan stringga aylantiradi. format berilsa — shu formatda. */
export function formatDate(value: Cell, format?: string): string {
  const d = value instanceof Date ? dayjs(value) : dayjs(String(value));
  if (!d.isValid()) return "";
  return format ? d.format(format) : d.toISOString();
}
