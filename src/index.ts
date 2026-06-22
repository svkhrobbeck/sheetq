import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";

import { checkEnvironment } from "./internal/utils";
import { createAuth, parseCredentialArgs, type GoogleAuthClient } from "./auth";
import Document from "./document";
import type { ServiceAccountCredentials, SpreadsheetOptions } from "./types";

import type ModelType from "./model";

export type {
  Cell,
  CellOf,
  ClearOptions,
  ColumnDef,
  ColumnsMap,
  ColumnType,
  FieldOf,
  FillOptions,
  FindOptions,
  MatchOptions,
  ModelConfig,
  RawOptions,
  RowOf,
  ServiceAccountCredentials,
  SetOptions,
  SpreadsheetOptions,
  WriteFieldOf,
  WriteOf,
} from "./types";
export { default as Document } from "./document";
export { default as Model } from "./model";
export { columns } from "./columns";
export { SpreadsheetError, type ErrorContext } from "./errors";

/**
 * Model'dan uning O'QISH (row) tipini chiqarib oladi.
 *
 * @typeParam M - `doc.model(...)` qaytargan model tipi (`typeof Users`).
 * @example
 * ```ts
 * const Users = doc.model("users", { columns: { id: c.number("B") } });
 * type User = InferModel<typeof Users>; // { id: number | null }
 * ```
 */
export type InferModel<M> = M extends ModelType<infer T> ? T : never;

/**
 * `Spreadsheet` — sheetq'ning kirish nuqtasi. Google Sheets bilan **tipli**,
 * **server tomonda** ishlash uchun service-account klientini quradi.
 *
 * Xususiyatlari:
 *  - To'liq credentials JSON obyektini qabul qiladi (`project_id`,
 *    `universe_domain` avtomatik o'qiladi).
 *  - Eski `new Spreadsheet(email, key)` ko'rinishi ham ishlaydi.
 *  - `private_key` ichidagi `\n` belgilari avtomatik to'g'rilanadi.
 *  - Scope sozlanadi: default — o'qish+yozish; `{ readonly: true }` — faqat o'qish.
 *  - Sheets klienti va auth lazy (birinchi murojaatda) quriladi va keshlanadi.
 *  - Faqat **backend** (Node.js); browserda chaqirilsa xato beradi.
 *
 * @example
 * ```ts
 * import Spreadsheet from "sheetq";
 * import cred from "./service-account.json" assert { type: "json" };
 *
 * const ss = new Spreadsheet(cred);                    // o'qish + yozish
 * const ro = new Spreadsheet(cred, { readonly: true }); // faqat o'qish
 * const doc = ss.doc("<spreadsheetId>");
 * ```
 */
class Spreadsheet {
  private auth: GoogleAuthClient;
  private _spreadsheets: sheets_v4.Resource$Spreadsheets | null = null;

  /**
   * @param credentials - Service-account credentials JSON obyekti
   *   (`{ client_email, private_key, ... }`).
   * @param options - Ixtiyoriy sozlamalar (`readonly`, `scopes`).
   */
  constructor(credentials: ServiceAccountCredentials, options?: SpreadsheetOptions);
  /**
   * @param clientEmail - Service-account email manzili.
   * @param privateKey - Service-account maxfiy kaliti (`\n` avto-normallashtiriladi).
   * @param options - Ixtiyoriy sozlamalar (`readonly`, `scopes`).
   */
  constructor(clientEmail: string, privateKey: string, options?: SpreadsheetOptions);
  constructor(a: ServiceAccountCredentials | string, b?: string | SpreadsheetOptions, c?: SpreadsheetOptions) {
    checkEnvironment("backend");
    const { credentials, options } = parseCredentialArgs(a, b, c);
    this.auth = createAuth(credentials, options);
  }

  /**
   * Bitta hujjat (spreadsheet) bilan ishlash uchun `Document` qaytaradi.
   * Bitta `Spreadsheet` klienti ko'plab hujjatga `doc()` orqali xizmat qila oladi.
   *
   * @param spreadsheetId - Jadval URL'idagi uzun identifikator
   *   (`https://docs.google.com/spreadsheets/d/<BU_QISM>/edit`).
   * @returns Shu hujjat uchun `Document` (undan `model()` ochasiz).
   * @example
   * ```ts
   * const doc = ss.doc("<spreadsheetId>");
   * ```
   */
  doc(spreadsheetId: string): Document {
    return new Document(spreadsheetId, {
      sheets: () => this.spreadsheets,
      token: () => this.token(),
    });
  }

  /** gviz qidiruvi uchun bearer token (google-auth-library ichida keshlanadi). */
  private async token(): Promise<string> {
    const client = await this.auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("sheetq: access token olinmadi");
    return token;
  }

  /** Sheets resursi — birinchi murojaatda lazy quriladi va keshlanadi. */
  protected get spreadsheets(): sheets_v4.Resource$Spreadsheets {
    if (!this._spreadsheets) {
      this._spreadsheets = google.sheets({ version: "v4", auth: this.auth }).spreadsheets;
    }
    return this._spreadsheets;
  }
}

export { Spreadsheet };
export default Spreadsheet;
