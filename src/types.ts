/** sheetq — umumiy turlar */

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
  universe_domain?: string;
  [key: string]: unknown;
}

export interface SpreadsheetOptions {
  /** Faqat o'qish rejimi (default: false → o'qish + yozish) */
  readonly?: boolean;
  /** Maxsus scope'lar. Berilsa `readonly` e'tiborga olinmaydi. */
  scopes?: string[];
}

// ── Model / Schema turlari ────────────────────────────────────────────────

/** Bitta katak qiymati (parse qilingandan keyin). */
export type Cell = string | number | boolean | Date | null;

/**
 * Ustun tipi — o'qishda parse, yozishda format qilish uchun.
 * Sana uchun "date" (default) yoki "date:FORMAT" (dayjs formati),
 * mas: "date:DD.MM.YYYY HH:mm:ss" — sana string bo'lib saqlangan holatlar uchun.
 */
export type ColumnType = "string" | "number" | "boolean" | "date" | `date:${string}`;

/**
 * Bitta ustun ta'rifi.
 *  • type      — o'qishda parse, yozishda format (string/number/boolean/date[:FORMAT]).
 *  • transform — o'qishda ERKIN parse: xom katakni istalgan ko'rinishga.
 *                Tip aynan shu funksiyaning return'idan olinadi.
 *                (Yozish baribir `type` bo'yicha; transform — asosan o'qish uchun.)
 */
export interface ColumnDef {
  /** Ustun harfi: "A", "B", "C"... */
  col: string;
  type?: ColumnType;
  /** O'qishni boyitish: xom katak → istalgan tip. (ixtiyoriy) */
  transform?: (raw: Cell) => unknown;
  /** Yozishni boyitish: boy tip → katakka yoziladigan xom qiymat. (ixtiyoriy) */
  serialize?: (value: any) => Cell;
}

/** field nomi → ustun ta'rifi. */
export type ColumnsMap = Record<string, ColumnDef>;

/** ColumnType literalini TypeScript tipiga aylantiradi. */
export type CellOf<Ty extends ColumnType> = Ty extends "string" ? string : Ty extends "number" ? number : Ty extends "boolean" ? boolean : Date; // "date"

/**
 * Bitta ustun ta'rifidan field tipini chiqaradi:
 *  • transform bor   → o'sha funksiyaning return tipi
 *  • type bor        → CellOf<type> | null
 *  • hech biri yo'q  → Cell
 */
export type FieldOf<Col> = Col extends { transform: (raw: Cell) => infer R } ? R : Col extends { type: infer Ty extends ColumnType } ? CellOf<Ty> | null : Cell;

/**
 * columns sxemasidan row object tipini avtomatik chiqaradi (O'QISH).
 *   { id: {type:"number"}, name: {transform:(r)=>String(r)} }
 *     → { id: number | null; name: string }
 */
export type RowOf<C extends ColumnsMap> = {
  -readonly [K in keyof C]: FieldOf<C[K]>;
};

/**
 * Bitta ustunning YOZISH tipini chiqaradi:
 *  • serialize bor   → o'sha funksiyaning kirish (param) tipi
 *  • transform bor   → Cell (xom qiymat yuborasiz)
 *  • type bor        → CellOf<type> | null
 *  • hech biri       → Cell
 */
export type WriteFieldOf<Col> = Col extends { serialize: (value: infer V) => unknown }
  ? V
  : Col extends { transform: (raw: Cell) => unknown }
    ? Cell
    : Col extends { type: infer Ty extends ColumnType }
      ? CellOf<Ty> | null
      : Cell;

/** columns sxemasidan yozish (insert/update) object tipini chiqaradi (barchasi ixtiyoriy). */
export type WriteOf<C extends ColumnsMap> = {
  -readonly [K in keyof C]?: WriteFieldOf<C[K]>;
};

/** Sheet uchun model configi (columns tipi C dan chiqariladi). */
export interface ModelConfig<C extends ColumnsMap = ColumnsMap> {
  /** field nomi → ustun ta'rifi */
  columns: C;
  /** Ma'lumot boshlanadigan qator (header'dan keyin). Default: 2 */
  startRow?: number;
}

/** find()/findOne() uchun qo'shimcha parametrlar. */
export interface FindOptions<T> {
  limit?: number;
  orderBy?: keyof T & string;
  dir?: "asc" | "desc";
  /** true → aniq tenglik (`=`). false/yo'q → search: matnda qism-matn (registrga befarq). */
  exact?: boolean;
}

/** update()/delete() uchun: qaysi rowlarga ta'sir qilish. */
export interface MatchOptions {
  /** true → aniq tenglik; false/yo'q → search (matnda qism-matn, registrga befarq). */
  exact?: boolean;
  /** Ko'pi bilan nechta rowga ta'sir qilsin (yo'q → barchasi). */
  limit?: number;
}

/** set() uchun: qaysi qatordan boshlab ustiga yozish. */
export interface SetOptions {
  /** Boshlanish qatori (default: startRow). */
  fromRow?: number;
}

/** fill() uchun: formulani pastga autoFill bilan cho'zish. */
export interface FillOptions {
  /** Formula ustuni (harf "E" yoki field nomi). */
  col: string;
  /** Formula turgan (manba) qator. */
  fromRow: number;
  /** Shu qatorgacha to'ldiriladi (inklyuziv). */
  toRow: number;
}

/** allRaw() uchun: xom o'qish diapazoni. Hech biri berilmasa — butun sheet. */
export interface RawOptions {
  /** Boshlanish qatori (default: 1 — sarlavhalar bilan birga). */
  fromRow?: number;
  /** Tugash qatori (default: oxirigacha). */
  toRow?: number;
  /** Ko'pi bilan nechta qator. */
  limit?: number;
}

/** clear() uchun: qaysi diapazonni tozalash. Hech biri berilmasa — barcha ma'lumot. */
export interface ClearOptions {
  /** Boshlanish qatori (default: startRow). */
  fromRow?: number;
  /** Tugash qatori (default: oxirigacha). */
  toRow?: number;
  /** Boshlanish ustuni (default: sxema eng chap ustuni). */
  fromCol?: string;
  /** Tugash ustuni (default: sxema eng o'ng ustuni). */
  toCol?: string;
}
