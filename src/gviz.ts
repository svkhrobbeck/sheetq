import type { Cell } from "./types";

/**
 * gviz — Google Visualization API (`/gviz/tq`) orqali SERVER-SIDE qidiruv.
 * Butun varaqni tortib JS'da filter qilish O'RNIGA, SQL'simon so'rovni
 * Google serveriga yuboramiz — u filtrlaydi va faqat mos rowlarni qaytaradi.
 * 10 000 row ichidan bittasini topish = bitta so'rov.
 */

const GVIZ_BASE = "https://docs.google.com/spreadsheets/d";

export type Operator = "=" | "!=" | "<" | ">" | "<=" | ">=" | "contains" | "starts" | "ends" | "matches" | "like";

const OP_MAP: Record<Operator, string> = {
  "=": "=",
  "!=": "!=",
  "<": "<",
  ">": ">",
  "<=": "<=",
  ">=": ">=",
  contains: "contains",
  starts: "starts with",
  ends: "ends with",
  matches: "matches",
  like: "like",
};

export function operatorClause(letter: string, op: Operator, value: Cell): string {
  if (value === null && op === "=") return `${letter} is null`;
  if (value === null && op === "!=") return `${letter} is not null`;
  return `${letter} ${OP_MAP[op]} ${formatValue(value)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Qiymatni gviz so'rov literaliga aylantiradi. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) {
    const d = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    return `date '${d}'`;
  }
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

// ── javobni parse qilish ────────────────────────────────────────────────────

interface GvizCol {
  id: string;
  label: string;
  type: string;
}

interface GvizCellRaw {
  v: unknown;
  f?: string;
}

/** "Date(2024,0,15)" → JS Date */
function parseGvizDate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^Date\((.+)\)$/);
  if (!m || !m[1]) return null;
  const p = m[1].split(",").map(n => Number(n.trim()));
  const [y, mo, d, h = 0, mi = 0, s = 0] = p;
  if (y === undefined || mo === undefined || d === undefined) return null;
  return new Date(y, mo, d, h, mi, s);
}

function cellValue(cell: GvizCellRaw | null, type: string): Cell {
  if (!cell || cell.v === null || cell.v === undefined) return null;
  if (type === "date" || type === "datetime" || type === "timeofday") {
    return parseGvizDate(cell.v) ?? (cell.v as Cell);
  }
  return cell.v as Cell;
}

export interface ExecGvizParams {
  spreadsheetId: string;
  gid: number;
  token: string;
  tq: string;
  /** Header qatorlari soni (deterministik bo'lishi uchun). */
  headers?: number;
}

/**
 * gviz so'rovini yuboradi va natijani A ustunidan boshlab tekislangan
 * Cell[][] ko'rinishida qaytaradi (Model.parse to'g'ridan-to'g'ri ishlatadi).
 */
export async function execGviz(params: ExecGvizParams): Promise<Cell[][]> {
  const { spreadsheetId, gid, token, tq, headers } = params;

  let url = `${GVIZ_BASE}/${spreadsheetId}/gviz/tq` + `?tqx=out:json&gid=${gid}&tq=${encodeURIComponent(tq)}`;
  if (headers !== undefined) url += `&headers=${headers}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`gviz HTTP ${res.status} ${res.statusText}`);

  const text = await res.text();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`gviz: kutilmagan javob: ${text.slice(0, 150)}`);
  }

  const json = JSON.parse(text.slice(start, end + 1)) as {
    status?: string;
    errors?: { message?: string; detailed_message?: string }[];
    table?: { cols?: GvizCol[]; rows?: { c: (GvizCellRaw | null)[] }[] };
  };

  if (json.status === "error") {
    const msg = json.errors?.map(e => e.detailed_message || e.message).join("; ");
    throw new Error(`gviz: ${msg || "noma'lum xato"}`);
  }

  const cols = json.table?.cols ?? [];
  const rows = json.table?.rows ?? [];
  return rows.map(r => (r.c ?? []).map((c, i) => cellValue(c, cols[i]?.type ?? "string")));
}
