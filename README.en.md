<div align="right">

**English** · [O‘zbekcha](./README.md)

</div>

# sheetq

> Typed, server-side query layer for Google Sheets — model a sheet like a tiny ORM.

`sheetq` turns a Google Sheet into a small, type-safe data store. You describe a
sheet's columns once, and you get a fully-typed model with `find` / `insert` /
`update` / `delete` — no hand-written interfaces, no manual A1 ranges.

Searches run **server-side** through the Google Visualization API (`gviz`): instead
of pulling 10 000 rows down and filtering them in JS, `sheetq` sends a SQL-like query
to Google and gets back only the matching rows.

```ts
const Users = spreadsheet
  .doc("<spreadsheetId>") // the long id in the sheet URL
  .model("users", {
    columns: {
      id:    { col: "B", type: "number" },
      name:  { col: "C", type: "string" },
      email: { col: "D", type: "string" },
    },
  });

const user = await Users.findOne({ id: 5042 }, { exact: true });
//    ^? { id: number | null; name: string | null; email: string | null } | null
```

---

## Features

- **Type inference from the schema** — the row type is derived from `columns`; you
  never write a separate interface.
- **Server-side search** — `find` / `findOne` translate to `gviz` queries; only
  matching rows come back.
- **Read & write** — `insert`, `insertMany`, `update`, `delete`, `set`, `clear`,
  `clearRange`, plus formula auto-fill.
- **Per-column casting** — `string` / `number` / `boolean` / `date[:FORMAT]`, or your
  own `transform` (read) and `serialize` (write).
- **Letter-based columns** — map fields to real spreadsheet columns (`"A"`, `"B"`,
  `"F"`…); gaps are fine.
- **Tiny footprint** — only `googleapis` and `dayjs` as runtime dependencies.

---

## Install

```bash
yarn add sheetq
# runtime deps are installed automatically: googleapis, dayjs
```

`sheetq` is **backend-only** (Node.js ≥ 24). It authenticates with a Google
**service account** and will throw if constructed in a browser.

---

## Setup

### 1. Create a service account

1. In the [Google Cloud Console](https://console.cloud.google.com/) create a
   **service account** and download its JSON key.
2. Enable the **Google Sheets API** for the project.
3. **Share the spreadsheet** with the service account's email
   (`...@...gserviceaccount.com`) — Viewer for read-only, Editor for writing.

### 2. Create a `Spreadsheet` client

```ts
import Spreadsheet from "sheetq";
import cred from "./service-account.json" assert { type: "json" };

const spreadsheet = new Spreadsheet(cred);                 // read + write
const ro = new Spreadsheet(cred, { readonly: true });      // read-only scope

// Or pass email + key directly (e.g. from env vars):
const ss = new Spreadsheet(
  process.env.GOOGLE_CLIENT_EMAIL!,
  process.env.GOOGLE_PRIVATE_KEY!, // `\n` escapes are normalized automatically
);
```

### 3. Open a document and define models

```ts
const doc = spreadsheet.doc("<spreadsheetId>"); // the long id in the sheet URL

const Users = doc.model("users", {       // "users" = the sheet/tab name
  columns: {
    id:    { col: "B", type: "number" },
    name:  { col: "C", type: "string" },
    email: { col: "D", type: "string" },
    role:  { col: "F", type: "string" },
  },
  startRow: 2, // first data row (below the header). Default: 2
});
```

---

## Column definition

```ts
interface ColumnDef {
  col: string;                          // "A", "B", "C"... (column letter)
  type?: "string" | "number" | "boolean" | "date" | `date:${string}`;
  transform?: (raw: Cell) => unknown;   // read-side: raw cell → any value
  serialize?: (value: any) => Cell;     // write-side: rich value → cell value
}
```

### Types & casting

| `type`              | Read returns      | Write accepts    |
| ------------------- | ----------------- | ---------------- |
| `"string"`          | `string \| null`  | `string`         |
| `"number"`          | `number \| null`  | `number`         |
| `"boolean"`         | `boolean \| null` | `boolean`        |
| `"date"`            | `Date \| null`    | `Date`           |
| `"date:DD.MM.YYYY"` | `Date \| null`    | formatted string |

`"date"` parses/serializes ISO dates. Use `"date:FORMAT"` (a
[dayjs format](https://day.js.org/docs/en/display/format)) when the sheet stores
dates as formatted text — e.g. `"date:DD.MM.YYYY HH:mm:ss"`.

### `transform` & `serialize`

When a built-in `type` is not enough, provide your own converters. **`transform`** runs
on **read** (raw cell → your value); **`serialize`** runs on **write** (your value →
cell value). The field's TS type is inferred from `transform`'s return type and
`serialize`'s parameter type.

```ts
import { getFormattedDate } from "utilzify";

const Users = doc.model("users", {
  columns: {
    timestamp: {
      col: "A",
      transform: (raw) => new Date(raw as string),  // READ:  "2026-06-22" → Date
      serialize: (raw) => getFormattedDate(raw),     // WRITE: Date → "22.06.2026" string
    },
    id:   { col: "B", type: "number" },
    name: { col: "C", type: "string" },
  },
});
```

`getFormattedDate` here is just an example formatter (from `utilzify`) — use any
function, e.g. `dayjs(raw).format("DD.MM.YYYY")`.

### Two ways to define columns: object literal vs `columns` builder

A column can be written **two ways** — the result (both the type and the behavior) is
**identical**. You can mix both styles in one model.

**Way 1 — object literal (most flexible):**

```ts
doc.model("users", {
  columns: {
    id:     { col: "B", type: "number" },
    name:   { col: "C", type: "string" },
    active: { col: "E", type: "boolean" },
    bornAt: { col: "F", type: "date:DD.MM.YYYY" },
  },
});
```

**Way 2 — `columns` builder (shorter):**

```ts
import { columns as c } from "sheetq";

doc.model("users", {
  columns: {
    id:     c.number("B"),
    name:   c.string("C"),
    active: c.boolean("E"),
    bornAt: c.date("F", "DD.MM.YYYY"),
  },
});
```

> Builders preserve the literal type, so the inferred row type is exactly the same
> (`id: number | null`, `bornAt: Date | null`, …). No type information is lost.

**Each builder:**

| Builder                            | Equivalent object literal               | Field type (read)    |
| ---------------------------------- | --------------------------------------- | -------------------- |
| `c.string("C")`                    | `{ col: "C", type: "string" }`          | `string \| null`     |
| `c.number("B")`                    | `{ col: "B", type: "number" }`          | `number \| null`     |
| `c.boolean("E")`                   | `{ col: "E", type: "boolean" }`         | `boolean \| null`    |
| `c.date("F")`                      | `{ col: "F", type: "date" }`            | `Date \| null` (ISO) |
| `c.date("F", "DD.MM.YYYY")`        | `{ col: "F", type: "date:DD.MM.YYYY" }` | `Date \| null` (text)|
| `c.parsed("G", parse, serialize?)` | `{ col: "G", transform: parse, serialize }` | return type of `parse` |

- **`c.string(col)`** — text column.
- **`c.number(col)`** — numeric column (`null` when not parseable).
- **`c.boolean(col)`** — `"TRUE"`/`"true"`/`true` → `true`, otherwise `false`.
- **`c.date(col)`** — ISO date. `c.date(col, "FORMAT")` for dates stored as **text**
  (dayjs format, e.g. `"DD.MM.YYYY HH:mm:ss"`).

#### `c.parsed` — the flexible one (shorthand for transform + serialize)

`c.parsed` is shorthand for `transform` (plus optional `serialize`). Use it when the
built-in types aren't enough.

```ts
c.parsed(col, parse, serialize?)
```

- **`parse: (raw) => R`** — runs on **read**: turns the raw cell into your value.
  **The field's type (`R`) is inferred from this function's return type.**
- **`serialize?: (value: R) => Cell`** — runs on **write** (optional): turns your rich
  value back into a plain cell value. Omit it for read-only columns.

```ts
import dayjs from "dayjs";

// Read-only: raw text → Date
joinedAt: c.parsed("G", r => new Date(r as string)),

// Read + write: Date ↔ "22.06.2026" text
bornAt: c.parsed(
  "F",
  r => new Date(r as string),          // READ
  d => dayjs(d).format("DD.MM.YYYY"),   // WRITE
),
```

This is **exactly equivalent** to the object literal:

```ts
bornAt: {
  col: "F",
  transform: r => new Date(r as string),
  serialize: d => dayjs(d).format("DD.MM.YYYY"),
},
```

> **Which to use?** Builders are shorter/cleaner for simple typed columns; the object
> literal gives more control when the `transform`/`serialize` logic is involved. Mix
> freely.

### Inferring the row type

```ts
import type { InferModel } from "sheetq";

type User = InferModel<typeof Users>;
// { timestamp: Date; id: number | null; name: string | null }
```

---

## Reading

```ts
const all = await Users.all();                          // every row
const alis = await Users.find({ name: "ali" });         // fuzzy: "Ali", "Alisher"…
const u = await Users.findOne({ id: 5042 }, { exact: true });

const top = await Users.find(
  { role: "admin" },
  { orderBy: "id", dir: "desc", limit: 10, exact: true },
);
```

**Search semantics**

- Default (`exact: false`): string fields use case-insensitive `contains`; other
  fields use `=`.
- `exact: true`: every field uses strict equality.
- Multiple fields are combined with `AND`. `null` matches empty cells.

### Raw & header reads

```ts
const grid = await Users.allRaw();                       // whole sheet, Cell[][]
const slice = await Users.allRaw({ fromRow: 2, limit: 100 });
const headerRows = await Users.headers();                // string[][]
const map = await Users.headerMap();                     // { id: ["ID"], ... }
```

---

## Writing

> Requires read-write scope and **Editor** access for the service account.

```ts
await Users.insert({ id: 1, name: "Ali", email: "ali@example.com" });
await Users.insertMany([{ id: 2, name: "Vali" }, { id: 3, name: "Guli" }]);

const changed = await Users.update({ id: 5042 }, { name: "Vali" }, { exact: true });
const removed = await Users.delete({ role: "guest" });

await Users.set([{ id: 1, name: "Ali" }, { id: 2, name: "Vali" }]); // from startRow
await Users.set(rows, { fromRow: 10 });

await Users.clear({ id: 5042 }, { exact: true });        // empty matching rows' cells
await Users.clearRange({ fromRow: 5, toRow: 20 });       // empty by position

await Users.fillFormula({ col: "E", fromRow: 2, toRow: 5000 }); // drag formula down
```

---

## Error handling

```ts
import { SpreadsheetError } from "sheetq";

try {
  await Users.insert({ id: 1 });
} catch (err) {
  if (err instanceof SpreadsheetError) {
    console.error(err.message);   // "sheetq.insert (sheet: users): ..."
    console.error(err.context);   // { method: "insert", sheet: "users", ... }
  }
}
```

---

## API reference

### `new Spreadsheet(credentials, options?)` · `new Spreadsheet(email, key, options?)`

- `credentials` — service-account JSON (`{ client_email, private_key, ... }`).
- `options.readonly` — request the read-only scope (default: read-write).
- `options.scopes` — custom scopes (overrides `readonly`).
- `.doc(spreadsheetId)` → `Document`

### `Document`

- `.model(sheetName, config)` → `Model` — `config` is `{ columns, startRow? }`.

### `Model`

| Method                                 | Returns                  | Description                                |
| -------------------------------------- | ------------------------ | ------------------------------------------ |
| `find(match?, options?)`               | `T[]`                    | All matching rows (server-side `gviz`).    |
| `findOne(match?, options?)`            | `T \| null`              | First matching row.                        |
| `all(options?)`                        | `T[]`                    | All rows.                                  |
| `allRaw(options?)`                     | `Cell[][]`               | Raw grid incl. non-schema columns.         |
| `headers()`                            | `string[][]`             | Raw header rows (above `startRow`).        |
| `headerMap()`                          | `Record<field,string[]>` | Header values per field.                   |
| `insert(obj)`                          | `void`                   | Append one row.                            |
| `insertMany(objs)`                     | `void`                   | Append many rows in one request.           |
| `update(match, patch, options?)`       | `number`                 | Patch matching rows; count changed.        |
| `delete(match, options?)`              | `number`                 | Delete matching rows; count removed.       |
| `set(rows, options?)`                  | `void`                   | Overwrite from a row (no insert).          |
| `clear(match, options?)`               | `number`                 | Empty matching rows' cells; count cleared. |
| `clearRange(options?)`                 | `void`                   | Empty a row/column range.                  |
| `fillFormula({ col, fromRow, toRow })` | `boolean`                | Auto-fill a formula down; `false` if none. |
| `col(field)`                           | `string`                 | Column letter for a field.                 |
| `range(endRow?)`                       | `string`                 | A1 range for the schema.                   |
| `parse(row)` / `serialize(obj)`        | `T` / `Cell[]`           | Manual row ↔ object conversion.            |

**Options** — `FindOptions { limit?, orderBy?, dir?, exact? }`,
`MatchOptions { exact?, limit? }`, `SetOptions { fromRow? }`,
`RawOptions { fromRow?, toRow?, limit? }`,
`ClearOptions { fromRow?, toRow?, fromCol?, toCol? }`.

---

## Development

```bash
yarn install
yarn typecheck   # tsc --noEmit
yarn build       # tsup → dist/ (ESM + CJS + .d.ts)
```

## License

MIT © Suhrobbek Soatov
