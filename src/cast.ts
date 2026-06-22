import { dateFormatOf, formatDate, parseDate } from "./dates";
import type { Cell, ColumnType } from "./types";

/** sheetq — tip konvertatsiyasi: o'qishda parse, yozishda format. */

/** Istalgan qiymatni katakka yoziladigan oddiy qiymatga keltiradi (type'siz holatlar uchun). */
export function coerceWrite(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function isDate(type: ColumnType): boolean {
  return type === "date" || type.startsWith("date:");
}

/** Sheets'dan o'qilgan xom qiymatni belgilangan tipga keltiradi. */
export function toValue(raw: unknown, type: ColumnType): Cell {
  if (raw === "" || raw === null || raw === undefined) return null;

  if (type === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  if (type === "boolean") {
    return raw === true || raw === "TRUE" || raw === "true";
  }
  if (isDate(type)) {
    return parseDate(raw, dateFormatOf(type));
  }
  return String(raw); // "string"
}

/** Object qiymatini Sheets katakka yoziladigan ko'rinishga keltiradi. */
export function fromValue(value: Cell, type: ColumnType): string | number | boolean {
  if (value === null || value === undefined) return "";

  if (type === "number") {
    return typeof value === "number" ? value : Number(value);
  }
  if (type === "boolean") {
    return Boolean(value);
  }
  if (isDate(type)) {
    return formatDate(value, dateFormatOf(type));
  }
  return String(value); // "string"
}
