import type { sheets_v4 } from "googleapis";

import { getColumnIndex } from "./internal/utils";
import { coerceWrite, fromValue, toValue } from "./cast";
import type { ModelContext } from "./document";
import { wrap } from "./errors";
import { formatValue } from "./gviz";
import type { Cell, ClearOptions, ColumnDef, FillOptions, FindOptions, MatchOptions, ModelConfig, RawOptions, SetOptions } from "./types";

type Match<T> = Partial<T>;

/**
 * `Model` — bitta varaq (sheet) va uning ustun sxemasini ifodalaydi. U orqali
 * o'qish (`find`/`findOne`/`all`), yozish (`insert`/`update`/`delete`/`set`...) va
 * xom kirish (`allRaw`/`headers`) amallari bajariladi.
 *
 * Odatda to'g'ridan-to'g'ri `new Model()` chaqirilmaydi — `doc.model(...)` orqali
 * yaratiladi (shunda tiplar avtomatik chiqadi).
 *
 * @typeParam T - O'qishda qaytadigan row obyekti tipi.
 * @typeParam W - Yozishda (insert/update) qabul qilinadigan obyekt tipi.
 */
class Model<T extends Record<string, unknown> = Record<string, Cell>, W = Partial<T>> {
  readonly startRow: number;
  readonly fields: string[];

  constructor(
    public readonly sheet: string,
    public readonly config: ModelConfig,
    private readonly ctx: ModelContext,
  ) {
    this.fields = Object.keys(config.columns);
    if (!this.fields.length) {
      throw new Error(`sheetq: "${sheet}" model uchun columns bo'sh bo'lishi mumkin emas`);
    }
    this.startRow = config.startRow ?? 2;
  }

  /**
   * field nomidan ustun harfini qaytaradi (mas. `"name"` → `"C"`). IntelliSense
   * faqat sxemada mavjud field nomlarini taklif qiladi.
   *
   * @param field - Sxemadagi field nomi.
   * @returns Ustun harfi (`"A"`, `"B"`...).
   * @throws Agar field sxemada bo'lmasa.
   */
  col(field: keyof T & string): string {
    const def = this.config.columns[field];
    if (!def) throw new Error(`sheetq: "${field}" ustuni "${this.sheet}" modelida yo'q`);
    return def.col;
  }

  /** Sxemaning eng chap va eng o'ng ustun harflari. */
  private bounds(): { first: string; last: string } {
    let minIdx = Infinity;
    let maxIdx = -Infinity;
    let first = "A";
    let last = "A";

    for (const field of this.fields) {
      const letter = this.config.columns[field]!.col;
      const idx = getColumnIndex(letter);
      if (idx < minIdx) {
        minIdx = idx;
        first = letter;
      }
      if (idx > maxIdx) {
        maxIdx = idx;
        last = letter;
      }
    }

    return { first, last };
  }

  /**
   * Sxema bo'yicha to'liq A1 diapazonini quradi (mas. `"users!B2:F"`).
   *
   * @param endRow - Ixtiyoriy oxirgi qator. Berilmasa diapazon ochiq qoladi
   *   (`"users!B2:F"`), berilsa yopiladi (`range(100)` → `"users!B2:F100"`).
   * @returns A1 diapazon matni.
   */
  range(endRow?: number): string {
    const { first, last } = this.bounds();
    return `${this.sheet}!${first}${this.startRow}:${last}${endRow ?? ""}`;
  }

  /**
   * Xom qatorni (A ustunidan boshlangan massiv) tipli obyektga aylantiradi.
   * Har bir field uchun `transform` bo'lsa o'sha, aks holda `type` bo'yicha parse qiladi.
   *
   * @param row - Xom katak qiymatlari massivi (A ustunidan boshlab).
   * @returns Sxema bo'yicha tipli row obyekti.
   */
  parse(row: Cell[]): T {
    const obj: Record<string, unknown> = {};
    for (const field of this.fields) {
      const def = this.config.columns[field]!;
      obj[field] = this.parseCell(def, row[getColumnIndex(def.col)] ?? null);
    }
    return obj as T;
  }

  /**
   * Obyektni A ustunidan boshlangan xom qator massiviga aylantiradi. Qiymatlar
   * to'g'ri ustun joylariga qo'yiladi; oradagi bo'sh ustunlar `""` bilan to'ldiriladi.
   *
   * @param obj - Yozish (write) obyekti.
   * @returns Katakka yoziladigan oddiy qiymatlar massivi.
   */
  serialize(obj: W): (string | number | boolean)[] {
    let maxIdx = 0;
    for (const field of this.fields) {
      maxIdx = Math.max(maxIdx, getColumnIndex(this.config.columns[field]!.col));
    }

    const source = obj as Record<string, unknown>;
    const row: (string | number | boolean)[] = new Array(maxIdx + 1).fill("");
    for (const field of this.fields) {
      if (!(field in source)) continue;
      const def = this.config.columns[field]!;
      row[getColumnIndex(def.col)] = this.formatCell(def, source[field]);
    }
    return row;
  }

  /** Xom katak → field qiymati: transform bor bo'lsa o'sha, aks holda type bo'yicha. */
  private parseCell(def: ColumnDef, raw: Cell): unknown {
    if (def.transform) return def.transform(raw);
    return toValue(raw, def.type ?? "string");
  }

  /**
   * field qiymati → katakka yoziladigan qiymat.
   *  • serialize bor → o'sha funksiya (boy tip → xom)
   *  • type bor      → type bo'yicha format
   *  • aks holda     → xom qiymatni o'zicha
   */
  private formatCell(def: ColumnDef, value: unknown): string | number | boolean {
    if (def.serialize) return coerceWrite(def.serialize(value));
    if (def.type) return fromValue(value as Cell, def.type);
    return coerceWrite(value);
  }

  // ── qidiruv (server-side, gviz orqali) ─────────────────────────────────────

  /**
   * Mos keladigan **birinchi** qatorni qaytaradi (topilmasa `null`). Qidiruv server
   * tomonda (`gviz`) bajariladi.
   *
   * @param match - field → qiymat shartlari (barchasi `AND`). Bo'sh `{}` — har qanday.
   * @param options - `exact` (aniq tenglik), `orderBy`, `dir`, `limit`.
   *   Default (`exact: false`): matn fieldlarda registrga befarq qism-matn qidiruv.
   * @returns Birinchi mos row yoki `null`.
   * @example
   * ```ts
   * await Users.findOne({ name: "ali" });               // "Ali", "Alisher" ham
   * await Users.findOne({ id: 5042 }, { exact: true });  // aynan teng
   * ```
   */
  async findOne(match: Match<T> = {}, options: FindOptions<T> = {}): Promise<T | null> {
    const rows = await this.query(match, { ...options, limit: 1 });
    return rows[0] ?? null;
  }

  /**
   * Mos keladigan **barcha** qatorlarni qaytaradi (server tomonda `gviz`).
   *
   * @param match - field → qiymat shartlari (barchasi `AND`). Bo'sh `{}` — hammasi.
   * @param options - `exact`, `orderBy`, `dir`, `limit`.
   * @returns Mos rowlar massivi (yo'q bo'lsa `[]`).
   * @example
   * ```ts
   * await Users.find({ role: "admin" }, { orderBy: "id", dir: "desc", exact: true });
   * ```
   */
  async find(match: Match<T> = {}, options: FindOptions<T> = {}): Promise<T[]> {
    return this.query(match, options);
  }

  /**
   * Varaqdagi barcha qatorlarni o'qiydi (sxema ustunlari bo'yicha parse qilingan).
   *
   * @param options - `orderBy`, `dir`, `limit` (shart `match` yo'q).
   * @returns Barcha rowlar massivi.
   * @example
   * ```ts
   * const users = await Users.all();
   * const first100 = await Users.all({ orderBy: "id", limit: 100 });
   * ```
   */
  async all(options: FindOptions<T> = {}): Promise<T[]> {
    return this.query({}, options);
  }

  /**
   * **Xom** o'qish — sxemada belgilanmagan ustunlarni HAM oladi, butun varaq bo'ylab.
   * Natija ikki o'lchovli massiv (`Cell[][]`) — parse qilinmaydi.
   *
   * @param options - `fromRow` (default 1 — sarlavhalar bilan), `toRow`, `limit`.
   * @returns Xom kataklar jadvali (`Cell[][]`).
   * @example
   * ```ts
   * await Users.allRaw();                          // butun varaq
   * await Users.allRaw({ fromRow: 2, limit: 100 }); // 2-qatordan 100 ta
   * ```
   */
  async allRaw(options: RawOptions = {}): Promise<Cell[][]> {
    return wrap({ method: "allRaw", sheet: this.sheet }, async () => {
      const res = await this.sheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: this.sheet, // butun sheet — barcha ustun va qator
      });
      const all = (res.data.values ?? []) as Cell[][];

      const fromIdx = (options.fromRow ?? 1) - 1;
      let rows = options.toRow !== undefined ? all.slice(fromIdx, options.toRow) : all.slice(fromIdx);
      if (options.limit !== undefined) rows = rows.slice(0, options.limit);
      return rows;
    });
  }

  /** find/findOne umumiy yadrosi. */
  private async query(match: Match<T>, options: FindOptions<T>): Promise<T[]> {
    return wrap({ method: "find", sheet: this.sheet }, async () => {
      let tq = "select *";

      const where = this.buildWhere(match, options.exact ?? false);
      if (where) tq += ` where ${where}`;
      if (options.orderBy) tq += ` order by ${this.col(options.orderBy)} ${options.dir ?? "asc"}`;
      if (options.limit !== undefined) tq += ` limit ${options.limit}`;

      const rows = await this.ctx.exec(this.sheet, tq, this.startRow - 1);
      return rows.map(row => this.parse(row));
    });
  }

  // ── header qatorlari (ma'lumotdan yuqoridagilar) ────────────────────────────

  /**
   * Header (sarlavha) qatorlarini xom ko'rinishda o'qiydi — `startRow`'dan
   * yuqoridagilarning hammasi (A ustunidan tekislangan).
   *
   * @returns Header qatorlari (`startRow=2` → 1 qator, `startRow=4` → 3 qator).
   *   `startRow=1` bo'lsa `[]`.
   */
  async headers(): Promise<string[][]> {
    return wrap({ method: "headers", sheet: this.sheet }, async () => {
      const count = this.startRow - 1;
      if (count <= 0) return [];

      const { last } = this.bounds();
      const res = await this.sheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheet}!A1:${last}${count}`,
      });
      return (res.data.values ?? []) as string[][];
    });
  }

  /**
   * Har bir field uchun header qatorlaridagi qiymatlarni (ustun bo'yicha) qaytaradi.
   *
   * @returns field → header qiymatlari massivi.
   * @example
   * ```ts
   * // 2 ta header qatori bo'lsa:
   * await Users.headerMap(); // { name: ["Ism", "string"], age: ["Yosh", "number"] }
   * ```
   */
  async headerMap(): Promise<Record<keyof T & string, string[]>> {
    const rows = await this.headers();
    const out = {} as Record<keyof T & string, string[]>;
    for (const field of this.fields) {
      const idx = getColumnIndex(this.config.columns[field]!.col);
      out[field as keyof T & string] = rows.map(r => r[idx] ?? "");
    }
    return out;
  }

  // ── yozish ──────────────────────────────────────────────────────────────

  /**
   * Bitta yangi qator qo'shadi (varaq oxiriga). Qiymatlar sxema bo'yicha to'g'ri
   * ustunlarga joylanadi va format qilinadi.
   *
   * @param obj - Yozish obyekti (sxemadagi fieldlardan ixtiyoriy to'plam).
   * @example
   * ```ts
   * await Users.insert({ id: 1, name: "Ali", email: "ali@example.com" });
   * ```
   */
  async insert(obj: W): Promise<void> {
    return wrap({ method: "insert", sheet: this.sheet }, async () => {
      await this.appendRows([this.serialize(obj)]);
    });
  }

  /**
   * Bir nechta yangi qatorni **bitta so'rovda** qo'shadi (oxiriga).
   *
   * @param objs - Yozish obyektlari massivi. Bo'sh massiv — hech narsa qilmaydi.
   * @example
   * ```ts
   * await Users.insertMany([{ id: 2, name: "Vali" }, { id: 3, name: "Guli" }]);
   * ```
   */
  async insertMany(objs: W[]): Promise<void> {
    if (!objs.length) return;
    return wrap({ method: "insertMany", sheet: this.sheet }, async () => {
      await this.appendRows(objs.map(o => this.serialize(o)));
    });
  }

  /**
   * Mos qatorlarni topib, `patch`dagi maydonlarni yangilaydi (faqat berilgan
   * fieldlar o'zgaradi, qolganlari tegilmaydi).
   *
   * @param match - Qaysi qatorlar (field → qiymat, `AND`).
   * @param patch - Yangilanadigan fieldlar va ularning yangi qiymatlari.
   * @param options - `exact` (aniq tenglik), `limit` (ko'pi bilan nechta qator).
   * @returns Yangilangan qatorlar soni.
   * @example
   * ```ts
   * await Users.update({ id: 5042 }, { name: "Vali" }, { exact: true });
   * ```
   */
  async update(match: Match<T>, patch: W, options: MatchOptions = {}): Promise<number> {
    return wrap({ method: "update", sheet: this.sheet }, async () => {
      const rowNumbers = await this.locate(match, options);
      if (!rowNumbers.length) return 0;

      const data: { range: string; values: (string | number | boolean)[][] }[] = [];
      for (const rowNumber of rowNumbers) {
        for (const [field, value] of Object.entries(patch as Record<string, unknown>)) {
          const def = this.config.columns[field];
          if (!def) continue;
          data.push({
            range: `${this.sheet}!${def.col}${rowNumber}`,
            values: [[this.formatCell(def, value)]],
          });
        }
      }
      if (!data.length) return 0;

      await this.sheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { valueInputOption: "RAW", data },
      });
      return rowNumbers.length;
    });
  }

  /**
   * Mos qatorlarni **butunlay o'chiradi** (qatorlar varaqdan olib tashlanadi,
   * pastdagilar yuqoriga suriladi).
   *
   * @param match - Qaysi qatorlar (field → qiymat, `AND`).
   * @param options - `exact`, `limit`.
   * @returns O'chirilgan qatorlar soni.
   * @example
   * ```ts
   * await Users.delete({ role: "guest" });
   * ```
   */
  async delete(match: Match<T>, options: MatchOptions = {}): Promise<number> {
    return wrap({ method: "delete", sheet: this.sheet }, async () => {
      const rowNumbers = await this.locate(match, options);
      if (!rowNumbers.length) return 0;

      const sheetId = await this.ctx.gid(this.sheet);
      // pastdan yuqoriga — indekslar siljib ketmasligi uchun
      const requests = rowNumbers
        .sort((a, b) => b - a)
        .map(rowNumber => ({
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
          },
        }));

      await this.sheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests },
      });
      return rowNumbers.length;
    });
  }

  /**
   * Ma'lumotni belgilangan qatordan boshlab **ustiga yozadi** (overwrite).
   * `insert`'dan farqi: yangi qator qo'shmaydi, mavjud kataklarni almashtiradi.
   *
   * @param rows - Yoziladigan obyektlar massivi. Bo'sh massiv — hech narsa qilmaydi.
   * @param options - `fromRow` (boshlanish qatori, default `startRow`).
   * @example
   * ```ts
   * await Users.set([{ id: 1, name: "Ali" }, { id: 2, name: "Vali" }]); // startRow'dan
   * await Users.set(rows, { fromRow: 10 });                              // 10-qatordan
   * ```
   */
  async set(rows: W[], options: SetOptions = {}): Promise<void> {
    if (!rows.length) return;
    return wrap({ method: "set", sheet: this.sheet }, async () => {
      const { first } = this.bounds();
      const firstIdx = getColumnIndex(first);
      const values = rows.map(row => this.serialize(row).slice(firstIdx));

      await this.sheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheet}!${first}${options.fromRow ?? this.startRow}`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    });
  }

  /**
   * Mos qatorlarning kataklarini **bo'shatadi** (qator JOYIDA qoladi).
   * `delete`'dan farqi: qator o'chmaydi, faqat ma'lumot tozalanadi.
   *
   * @param match - Qaysi qatorlar (field → qiymat, `AND`). Bo'sh `{}` — hammasi.
   * @param options - `exact`, `limit`.
   * @returns Bo'shatilgan qatorlar soni.
   * @example
   * ```ts
   * await Users.clear({ id: 5042 }, { exact: true }); // shu qatorni bo'shatadi
   * await Users.clear({});                            // hamma qatorlarni bo'shatadi
   * ```
   */
  async clear(match: Match<T>, options: MatchOptions = {}): Promise<number> {
    return wrap({ method: "clear", sheet: this.sheet }, async () => {
      const rowNumbers = await this.locate(match, options);
      if (!rowNumbers.length) return 0;

      const { first, last } = this.bounds();
      await this.sheets.values.batchClear({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          ranges: rowNumbers.map(n => `${this.sheet}!${first}${n}:${last}${n}`),
        },
      });
      return rowNumbers.length;
    });
  }

  /**
   * **Pozitsiya** (qator/ustun diapazoni) bo'yicha tozalaydi — `match`'ga bog'liq emas.
   * Hech narsa berilmasa, barcha ma'lumot tozalanadi (`startRow`'dan oxirigacha,
   * sxema ustunlari bo'yicha).
   *
   * @param options - `fromRow`/`toRow` (qatorlar), `fromCol`/`toCol` (ustunlar).
   * @example
   * ```ts
   * await Users.clearRange();                             // hammasi
   * await Users.clearRange({ fromRow: 5, toRow: 20 });    // 5..20 qatorlar
   * await Users.clearRange({ fromCol: "B", toCol: "D" }); // faqat B..D ustunlar
   * ```
   */
  async clearRange(options: ClearOptions = {}): Promise<void> {
    return wrap({ method: "clearRange", sheet: this.sheet }, async () => {
      const { first, last } = this.bounds();
      const fromCol = options.fromCol ?? first;
      const toCol = options.toCol ?? last;
      const fromRow = options.fromRow ?? this.startRow;

      await this.sheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheet}!${fromCol}${fromRow}:${toCol}${options.toRow ?? ""}`,
      });
    });
  }

  /**
   * Formulani pastga **"tortadi"** (autoFill) — `fromRow`'dagi mavjud formulani
   * `toRow`'gacha har qatorga nisbiy ssilkalarni moslab cho'zadi (qo'ldagi Ctrl+D /
   * drag bilan bir xil). Manba katakda formula bo'lmasa — tegmaydi.
   *
   * @param opts - `col` (formula ustuni — harf `"E"` yoki field nomi), `fromRow`
   *   (manba qator), `toRow` (shu qatorgacha to'ldiriladi, inklyuziv).
   * @returns `true` — formula tortildi; `false` — manba katakda formula yo'q yoki
   *   `toRow <= fromRow`.
   * @example
   * ```ts
   * await Users.fillFormula({ col: "E", fromRow: 2, toRow: 5000 });
   * ```
   */
  async fillFormula({ col, fromRow, toRow }: FillOptions): Promise<boolean> {
    if (toRow <= fromRow) return false;
    return wrap({ method: "fillFormula", sheet: this.sheet }, async () => {
      const letter = /^[A-Z]+$/.test(col) ? col : this.col(col as keyof T & string);

      // manba katakda formula bormi? (FORMULA renderi "=" bilan boshlanadi)
      const seed = await this.sheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheet}!${letter}${fromRow}`,
        valueRenderOption: "FORMULA",
      });
      const cell = seed.data.values?.[0]?.[0];
      if (typeof cell !== "string" || !cell.startsWith("=")) return false; // formula yo'q — tegmaymiz

      const colIndex = getColumnIndex(letter);
      const sheetId = await this.ctx.gid(this.sheet);

      await this.sheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              autoFill: {
                useAlternateSeries: false,
                sourceAndDestination: {
                  source: {
                    sheetId,
                    startRowIndex: fromRow - 1,
                    endRowIndex: fromRow,
                    startColumnIndex: colIndex,
                    endColumnIndex: colIndex + 1,
                  },
                  dimension: "ROWS",
                  fillLength: toRow - fromRow,
                },
              },
            },
          ],
        },
      });
      return true;
    });
  }

  private async appendRows(values: (string | number | boolean)[][]): Promise<void> {
    const { last } = this.bounds();
    await this.sheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheet}!A${this.startRow}:${last}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  }

  /** match'ga mos fizik row raqamlarini topadi (values API + JS solishtirish). */
  private async locate(match: Match<T>, options: MatchOptions): Promise<number[]> {
    const { last } = this.bounds();
    const res = await this.sheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheet}!A${this.startRow}:${last}`,
    });
    const rows = (res.data.values ?? []) as unknown[][];
    const exact = options.exact ?? false;

    const found: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (this.matchesRow(rows[i]!, match, exact)) {
        found.push(this.startRow + i);
        if (options.limit && found.length >= options.limit) break;
      }
    }
    return found;
  }

  /** Bitta xom rowni match shartiga solishtiradi (find bilan bir xil mantiq). */
  private matchesRow(row: unknown[], match: Match<T>, exact: boolean): boolean {
    for (const [field, value] of Object.entries(match) as [keyof T & string, Cell | undefined][]) {
      if (value === undefined) continue;
      const def = this.config.columns[field]!;
      const cell = this.parseCell(def, (row[getColumnIndex(def.col)] ?? null) as Cell);

      if (value === null) {
        if (cell !== null) return false;
      } else if (!exact && typeof value === "string") {
        if (typeof cell !== "string" || !cell.toLowerCase().includes(value.toLowerCase())) {
          return false;
        }
      } else if (value instanceof Date) {
        if (!(cell instanceof Date) || cell.getTime() !== value.getTime()) return false;
      } else if (cell !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * match (field → qiymat) dan gviz WHERE bandi quradi (barchasi AND).
   * exact=false → matnlar uchun registrga befarq `contains`; qolganlari `=`.
   * exact=true  → hamma uchun aniq `=`.
   */
  private buildWhere(match: Match<T>, exact: boolean): string {
    const parts: string[] = [];
    for (const [field, value] of Object.entries(match) as [keyof T & string, Cell | undefined][]) {
      if (value === undefined) continue;
      const letter = this.col(field);

      if (value === null) {
        parts.push(`${letter} is null`);
      } else if (!exact && typeof value === "string") {
        parts.push(`lower(${letter}) contains ${formatValue(value.toLowerCase())}`);
      } else {
        parts.push(`${letter} = ${formatValue(value)}`);
      }
    }
    return parts.join(" and ");
  }

  // ── ichki yordamchilar (yozish/headers metodlari shulardan foydalanadi) ──

  protected get sheets(): sheets_v4.Resource$Spreadsheets {
    return this.ctx.sheets();
  }

  protected get spreadsheetId(): string {
    return this.ctx.spreadsheetId;
  }
}

export default Model;
