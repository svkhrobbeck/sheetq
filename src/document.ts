import type { sheets_v4 } from "googleapis";

import Model from "./model";
import { execGviz } from "./gviz";
import type { Cell, ColumnsMap, ModelConfig, RowOf, WriteOf } from "./types";

/** Document'ni quvvatlovchi bog'lanishlar (Spreadsheet beradi). */
export interface DocumentDeps {
  sheets: () => sheets_v4.Resource$Spreadsheets;
  token: () => Promise<string>;
}

/** Model'ga beriladigan ichki context — Model Document ichkarisiga bevosita kirmaydi. */
export interface ModelContext {
  spreadsheetId: string;
  sheets: () => sheets_v4.Resource$Spreadsheets;
  exec: (sheet: string, tq: string, headers?: number) => Promise<Cell[][]>;
  gid: (sheet: string) => Promise<number>;
}

/**
 * Document — bitta Google Sheets hujjati (spreadsheetId).
 * Parallel hujjatlar uchun reusable birlik. Publik API: faqat `model()`.
 */
class Document {
  private gidCache = new Map<string, number>();

  constructor(
    public readonly spreadsheetId: string,
    private readonly deps: DocumentDeps,
  ) {}

  /**
   * Varaq (sheet/tab) uchun **tipli model** ochadi. Row tipi `columns`
   * sxemasidan AVTOMATIK chiqariladi — alohida interfeys yozish shart emas.
   *
   * @typeParam C - `columns` sxemasi (literal sifatida olinadi, `const`).
   * @param sheet - Varaq (tab) nomi, masalan `"users"`.
   * @param config - Model konfiguratsiyasi: `{ columns, startRow? }`.
   *   `startRow` — ma'lumot boshlanadigan qator (header'dan keyin), default `2`.
   * @returns Shu varaq uchun tipli `Model` (find/insert/update/delete...).
   * @example
   * ```ts
   * import { columns as c } from "sheetq";
   *
   * const Users = doc.model("users", {
   *   columns: {
   *     id:    c.number("B"),
   *     name:  c.string("C"),
   *     email: c.string("D"),
   *   },
   *   startRow: 2,
   * });
   * ```
   */
  model<const C extends ColumnsMap>(sheet: string, config: ModelConfig<C>): Model<RowOf<C>, WriteOf<C>> {
    return new Model<RowOf<C>, WriteOf<C>>(sheet, config, this.context());
  }

  // ── ichki (private) — tashqariga ko'rinmaydi ────────────────────────────────

  /** Model uchun ichki context. */
  private context(): ModelContext {
    return {
      spreadsheetId: this.spreadsheetId,
      sheets: () => this.deps.sheets(),
      exec: (sheet, tq, headers) => this.exec(sheet, tq, headers),
      gid: sheet => this.gid(sheet),
    };
  }

  /** sheet nomi → numeric gid (keshlanadi). */
  private async gid(sheet: string): Promise<number> {
    const cached = this.gidCache.get(sheet);
    if (cached !== undefined) return cached;

    const res = await this.deps.sheets().get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const found = res.data.sheets?.find(s => s.properties?.title === sheet);
    const gid = found?.properties?.sheetId;
    if (gid === undefined || gid === null) {
      throw new Error(`"${sheet}" sheet topilmadi`);
    }
    this.gidCache.set(sheet, gid);
    return gid;
  }

  /** gviz so'rovini bajaradi (Model qidiruvlari shu orqali ishlaydi). */
  private async exec(sheet: string, tq: string, headers?: number): Promise<Cell[][]> {
    const [gid, token] = await Promise.all([this.gid(sheet), this.deps.token()]);
    return execGviz({ spreadsheetId: this.spreadsheetId, gid, token, tq, headers });
  }
}

export default Document;
