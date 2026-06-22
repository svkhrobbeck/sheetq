import type { Cell } from "./types";

/**
 * sheetq — ustun ta'rifini qisqa yozish uchun yordamchilar (builder'lar).
 *
 * Oddiy tipli ustunlar uchun `{ col: "B", type: "number" }` o'rniga
 * `columns.number("B")` yozish mumkin — tip xuddi shunday aniq saqlanadi.
 *
 *   import { columns as c } from "sheetq";
 *
 *   doc.model("users", {
 *     columns: {
 *       id:    c.number("B"),
 *       name:  c.string("C"),
 *       active: c.boolean("E"),
 *       bornAt: c.date("F", "DD.MM.YYYY"),
 *     },
 *   });
 *
 * MUHIM: bu funksiyalar literal tipni saqlaydi (`type: "number"` aynan shunday,
 * `string`gacha kengaymaydi) — shu sabab model row tipi to'g'ri chiqadi.
 *
 * Eslatma: `transform` / `serialize` kerak bo'lsa, oddiy obyekt literali yozган
 * qulayroq (u allaqachon qisqa va tip to'liq ishlaydi):
 *   timestamp: { col: "A", transform: r => new Date(r as string), serialize: d => fmt(d) }
 */

/**
 * Matn (string) ustuni. O'qishda `string | null`, yozishda matn.
 * `{ col, type: "string" }` ning qisqa shakli.
 *
 * @param col - Ustun harfi: `"A"`, `"B"`, `"C"`...
 * @example
 * ```ts
 * name: c.string("C"); // ≡ { col: "C", type: "string" }
 * ```
 */
function string(col: string): { col: string; type: "string" } {
  return { col, type: "string" };
}

/**
 * Son (number) ustuni. O'qishda `number | null` (parse bo'lmasa `null`),
 * yozishda son. `{ col, type: "number" }` ning qisqa shakli.
 *
 * @param col - Ustun harfi: `"A"`, `"B"`, `"C"`...
 * @example
 * ```ts
 * id: c.number("B"); // ≡ { col: "B", type: "number" }
 * ```
 */
function number(col: string): { col: string; type: "number" } {
  return { col, type: "number" };
}

/**
 * Mantiqiy (boolean) ustun. `"TRUE"`/`"true"`/`true` → `true`, aks holda `false`.
 * O'qishda `boolean | null`. `{ col, type: "boolean" }` ning qisqa shakli.
 *
 * @param col - Ustun harfi: `"A"`, `"B"`, `"C"`...
 * @example
 * ```ts
 * active: c.boolean("E"); // ≡ { col: "E", type: "boolean" }
 * ```
 */
function boolean(col: string): { col: string; type: "boolean" } {
  return { col, type: "boolean" };
}

/**
 * Sana ustuni. Formatsiz — ISO sana; format bilan — sana **matn** ko'rinishida
 * saqlangan holatlar uchun (dayjs formati). O'qishda har ikkala holatda `Date | null`.
 *
 * @param col - Ustun harfi: `"A"`, `"B"`, `"C"`...
 * @param format - Ixtiyoriy dayjs formati, masalan `"DD.MM.YYYY HH:mm:ss"`.
 * @example
 * ```ts
 * createdAt: c.date("A");                 // ≡ { col: "A", type: "date" }
 * bornAt:    c.date("F", "DD.MM.YYYY");   // ≡ { col: "F", type: "date:DD.MM.YYYY" }
 * ```
 */
function date(col: string): { col: string; type: "date" };
function date<F extends string>(col: string, format: F): { col: string; type: `date:${F}` };
function date(col: string, format?: string): { col: string; type: string } {
  return { col, type: format ? `date:${format}` : "date" };
}

/**
 * Maxsus o'qish/yozish konverteri bilan ustun (`transform` + ixtiyoriy `serialize`
 * ning qisqa shakli). Tayyor tiplar (`string`/`number`/`date`...) yetmaganda ishlatiladi.
 *
 * @typeParam R - Field tipi — aynan `parse` funksiyasining return tipidan olinadi.
 * @param col - Ustun harfi: `"A"`, `"B"`, `"C"`...
 * @param parse - **O'QISHda**: xom katak (`raw`) → siz xohlagan qiymat (`R`).
 * @param serialize - **YOZISHda** (ixtiyoriy): qiymat (`R`) → katakka yoziladigan
 *   oddiy qiymat. Berilmasa — ustun amalda faqat o'qish uchun bo'ladi.
 * @returns `transform` (va kerak bo'lsa `serialize`) bilan ustun ta'rifi.
 * @example
 * ```ts
 * // Faqat o'qish: xom matn → Date
 * joinedAt: c.parsed("G", r => new Date(r as string)),
 *
 * // O'qish + yozish: Date ↔ "DD.MM.YYYY"
 * bornAt: c.parsed(
 *   "F",
 *   r => new Date(r as string),
 *   d => dayjs(d).format("DD.MM.YYYY"),
 * ),
 * ```
 */
function parsed<R>(
  col: string,
  parse: (raw: Cell) => R,
  serialize?: (value: R) => Cell,
): { col: string; transform: (raw: Cell) => R; serialize?: (value: R) => Cell } {
  return serialize ? { col, transform: parse, serialize } : { col, transform: parse };
}

/**
 * Ustun builder'lari to'plami — ustun ta'rifini qisqa va tipli yozish uchun.
 * Obyekt literali (`{ col, type }`) bilan **to'liq teng**, lekin qisqaroq.
 *
 * @example
 * ```ts
 * import { columns as c } from "sheetq";
 *
 * doc.model("users", {
 *   columns: {
 *     id:     c.number("B"),
 *     name:   c.string("C"),
 *     active: c.boolean("E"),
 *     bornAt: c.date("F", "DD.MM.YYYY"),
 *   },
 * });
 * ```
 */
export const columns = { string, number, boolean, date, parsed };
