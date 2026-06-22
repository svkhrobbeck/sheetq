<div align="right">

**O‘zbekcha** · [English](./README.en.md)

</div>

# sheetq

> Google Sheets uchun tipli (type-safe), server tomonda ishlovchi qidiruv qatlami —
> varaqni xuddi kichik ORM kabi modellashtiring.

`sheetq` Google jadvalini kichik, tipli ma'lumotlar ombariga aylantiradi. Siz varaq
ustunlarini bir marta tavsiflaysiz va to'liq tipli model olasiz: `find` / `insert` /
`update` / `delete` — qo'lda interfeys yozish ham, A1 diapazonlarini hisoblash ham
shart emas.

Qidiruvlar **server tomonda**, Google Visualization API (`gviz`) orqali ishlaydi:
10 000 ta qatorni tortib olib JS'da `filter` qilish O'RNIGA, `sheetq` Google serveriga
SQL'simon so'rov yuboradi va faqat mos qatorlarni qaytaradi. 10 000 qator ichidan
bittasini topish = bitta so'rov.

```ts
const Users = spreadsheet
  .doc("<spreadsheetId>") // jadval URL'idagi uzun id
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

## Imkoniyatlar

- **Sxemadan tip chiqarish** — qator tipi `columns` dan AVTOMATIK olinadi; alohida
  interfeys yozmaysiz.
- **Server tomonda qidiruv** — `find` / `findOne` `gviz` so'roviga aylanadi, faqat mos
  qatorlar qaytadi.
- **O'qish va yozish** — `insert`, `insertMany`, `update`, `delete`, `set`, `clear`,
  `clearRange`, hamda formulani avtomatik to'ldirish.
- **Ustun bo'yicha konvertatsiya** — `string` / `number` / `boolean` / `date[:FORMAT]`,
  yoki o'zingizning `transform` (o'qish) va `serialize` (yozish) funksiyalaringiz.
- **Harf bo'yicha ustunlar** — fieldlarni haqiqiy ustun harflariga bog'laysiz (`"A"`,
  `"B"`, `"F"`…); ustunlar orasida bo'shliq bo'lsa ham ishlaydi.
- **Yengil** — faqat `googleapis` va `dayjs` ga bog'liq.

---

## O'rnatish

```bash
yarn add sheetq
# kerakli paketlar avtomatik o'rnatiladi: googleapis, dayjs
```

`sheetq` **faqat backend** uchun (Node.js ≥ 24). U Google **service account** bilan
autentifikatsiya qiladi va browserda chaqirilsa xato beradi.

---

## Sozlash

### 1. Service account yarating

1. [Google Cloud Console](https://console.cloud.google.com/) da **service account**
   yarating va uning JSON kalitini yuklab oling.
2. Loyiha uchun **Google Sheets API** ni yoqing.
3. Jadvalni service account email'i (`...@...gserviceaccount.com`) bilan **ulashing** —
   faqat o'qish uchun "Viewer", yozish uchun "Editor".

### 2. `Spreadsheet` klientini yarating

```ts
import Spreadsheet from "sheetq";
import cred from "./service-account.json" assert { type: "json" };

// To'liq credentials JSON obyektini berasiz:
const spreadsheet = new Spreadsheet(cred);                // o'qish + yozish

// Faqat o'qish rejimi (readonly scope so'raydi):
const ro = new Spreadsheet(cred, { readonly: true });

// Yoki email + key'ni to'g'ridan-to'g'ri (mas. env'dan):
const ss = new Spreadsheet(
  process.env.GOOGLE_CLIENT_EMAIL!,
  process.env.GOOGLE_PRIVATE_KEY!, // `\n` belgilar avtomatik to'g'rilanadi
);
```

Bitta `Spreadsheet` klienti ko'plab hujjatlarga xizmat qila oladi — auth va Sheets
klienti lazy (kerak bo'lganda) quriladi va keshlanadi.

### 3. Hujjat ochib, modellar tavsiflang

```ts
const doc = spreadsheet.doc("<spreadsheetId>"); // jadval URL'idagi uzun id

const Users = doc.model("users", {       // "users" = varaq (tab) nomi
  columns: {
    id:    { col: "B", type: "number" },
    name:  { col: "C", type: "string" },
    email: { col: "D", type: "string" },
    role:  { col: "F", type: "string" },
  },
  startRow: 2, // ma'lumot boshlanadigan qator (header'dan keyin). Default: 2
});
```

---

## Ustun ta'rifi (ColumnDef)

```ts
interface ColumnDef {
  col: string;                          // "A", "B", "C"... (ustun harfi)
  type?: "string" | "number" | "boolean" | "date" | `date:${string}`;
  transform?: (raw: Cell) => unknown;   // O'QISHda: xom katak → istalgan qiymat
  serialize?: (value: any) => Cell;     // YOZISHda: boy qiymat → katak qiymati
}
```

### Tiplar va konvertatsiya

| `type`              | O'qishda qaytadi  | Yozishda qabul qiladi  |
| ------------------- | ----------------- | ---------------------- |
| `"string"`          | `string \| null`  | `string`               |
| `"number"`          | `number \| null`  | `number`               |
| `"boolean"`         | `boolean \| null` | `boolean`              |
| `"date"`            | `Date \| null`    | `Date`                 |
| `"date:DD.MM.YYYY"` | `Date \| null`    | formatlangan matn      |

`"date"` — ISO sanani parse/format qiladi. Agar sana varaqda **matn** ko'rinishida
saqlansa, `"date:FORMAT"` ishlating (FORMAT — [dayjs formati](https://day.js.org/docs/en/display/format)),
masalan: `"date:DD.MM.YYYY HH:mm:ss"`.

### `transform` va `serialize` — o'z konverteringiz

Tayyor `type` yetarli bo'lmaganda, o'z funksiyalaringizni berasiz. Eng muhimi —
ular **ikki xil yo'nalishda** ishlaydi:

- **`transform`** — **O'QISHda** ishlaydi: varaqdan kelgan xom katakni (`raw`) istalgan
  qiymatga aylantiradi. Field'ning TS tipi aynan shu funksiyaning `return` tipidan olinadi.
- **`serialize`** — **YOZISHda** ishlaydi: sizning boy qiymatingizni varaqqa
  yoziladigan oddiy qiymatga (matn/son/boolean) aylantiradi.

Aynan siz belgilab ko'rsatgan misol:

```ts
import { getFormattedDate } from "utilzify";

const usersModel = taklifnomaDoc.model("users", {
  columns: {
    timestamp: {
      col: "A",
      type: "string",
      transform: raw => new Date(raw as string), // O'QISH:  "2026-06-22 14:30" → Date obyekti
      serialize: raw => getFormattedDate(raw),     // YOZISH:  Date → "22.06.2026 14:30" matni
    },
    id:    { col: "B", type: "number" },
    name:  { col: "C", type: "string" },
    email: { col: "D", type: "string" },
    role:  { col: "F", type: "string" },
  },
  startRow: 2,
});
```

Bu nima qiladi:

- **`transform: raw => new Date(raw as string)`** — varaqdagi katakda sana matn
  ko'rinishida turadi. O'qiyotganda `sheetq` xom matnni oladi va uni JS `Date`
  obyektiga aylantiradi. Shuning uchun `users[i].timestamp` — bu haqiqiy `Date`, matn emas.
- **`serialize: raw => getFormattedDate(raw)`** — yozayotganda (`insert` / `update` / `set`)
  siz `Date` (yoki boshqa qiymat) berasiz, lekin varaqqa chiroyli, formatlangan **matn**
  yozilishi kerak. `getFormattedDate` aynan shuni qiladi.

> `getFormattedDate` — shunchaki misol formatlovchi funksiya (`utilzify` paketidan).
> O'rniga istalgan funksiya ishlatsa bo'ladi, masalan `dayjs(raw).format("DD.MM.YYYY")`.
> Yoki butun `transform`/`serialize` o'rniga shunchaki `type: "date:DD.MM.YYYY HH:mm:ss"`
> berib, xuddi shu natijaga erishish mumkin.

### Ikki xil yondashuv: obyekt literali yoki `columns` builder

Ustunni **ikki xil** yozish mumkin — natija (tip ham, xulq ham) **bir xil**. Ikkalasini
bitta modelda aralashtirib ham ishlatsa bo'ladi.

**1-usul — obyekt literali (to'liq moslashuvchan):**

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

**2-usul — `columns` builder (qisqaroq):**

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

> Builder'lar literal tipni saqlaydi, shuning uchun row tipi aynan bir xil chiqadi
> (`id: number | null`, `bornAt: Date | null`, ...). Hech qanday tip yo'qotilmaydi.

**Har bir builder:**

| Builder                         | Teng obyekt literali                                | Field tipi (o'qishda)  |
| ------------------------------- | --------------------------------------------------- | ---------------------- |
| `c.string("C")`                 | `{ col: "C", type: "string" }`                      | `string \| null`       |
| `c.number("B")`                 | `{ col: "B", type: "number" }`                      | `number \| null`       |
| `c.boolean("E")`                | `{ col: "E", type: "boolean" }`                     | `boolean \| null`      |
| `c.date("F")`                   | `{ col: "F", type: "date" }`                        | `Date \| null` (ISO)   |
| `c.date("F", "DD.MM.YYYY")`     | `{ col: "F", type: "date:DD.MM.YYYY" }`             | `Date \| null` (matn)  |
| `c.parsed("G", parse, serialize?)` | `{ col: "G", transform: parse, serialize }`      | `parse` return tipi    |

- **`c.string(col)`** — matn ustuni. O'qishda `String(...)`, yozishda matn.
- **`c.number(col)`** — son ustuni. O'qishda `Number(...)` (parse bo'lmasa `null`),
  yozishda son.
- **`c.boolean(col)`** — mantiqiy ustun. `"TRUE"`/`"true"`/`true` → `true`, aks holda
  `false`.
- **`c.date(col)`** — ISO sana. `c.date(col, "FORMAT")` — sana **matn** ko'rinishida
  saqlangan bo'lsa, dayjs formati bilan (mas. `"DD.MM.YYYY HH:mm:ss"`).

#### `c.parsed` — eng moslashuvchani (transform + serialize ning qisqa shakli)

`c.parsed` — bu obyekt literalidagi `transform` (va ixtiyoriy `serialize`)ning qisqa
yozuvi. Tayyor tiplar (`string/number/date...`) yetmaganda ishlatiladi.

```ts
c.parsed(col, parse, serialize?)
```

- **`parse: (raw) => R`** — **O'QISHda** ishlaydi: varaqdan kelgan xom katakni
  (`raw`) siz xohlagan qiymatga aylantiradi. **Field'ning tipi (`R`) aynan shu
  funksiyaning return'idan olinadi.** Masalan `r => new Date(...)` bo'lsa, field tipi
  `Date` bo'ladi.
- **`serialize?: (value: R) => Cell`** — **YOZISHda** ishlaydi (ixtiyoriy): sizning
  boy qiymatingizni (`R`) varaqqa yoziladigan oddiy qiymatga (matn/son/boolean)
  aylantiradi. Bermasangiz — faqat o'qish uchun mo'ljallangan bo'ladi.

```ts
import dayjs from "dayjs";

// Faqat o'qish: xom matn → Date
joinedAt: c.parsed("G", r => new Date(r as string)),

// O'qish + yozish: Date → "22.06.2026" matni
bornAt: c.parsed(
  "F",
  r => new Date(r as string),          // O'QISH:  "22.06.2026" → Date
  d => dayjs(d).format("DD.MM.YYYY"),   // YOZISH:  Date → "22.06.2026"
),
```

Bu quyidagi obyekt literaliga **to'liq teng**:

```ts
bornAt: {
  col: "F",
  transform: r => new Date(r as string),
  serialize: d => dayjs(d).format("DD.MM.YYYY"),
},
```

> **Qachon qaysi biri?** Oddiy tipli ustunlar uchun builder qisqaroq va tozaroq;
> `transform`/`serialize` mantiqi murakkab bo'lsa yoki bir nechta parametr kerak
> bo'lsa, obyekt literali ko'proq nazorat beradi. Ikkalasini bir modelda
> aralashtirsangiz ham bo'ladi.

### Model tipini chiqarib olish

```ts
import type { InferModel } from "sheetq";

type User = InferModel<typeof Users>;
// { timestamp: Date; id: number | null; name: string | null; ... }
```

---

## O'qish

```ts
// Hamma qator (butun sheet, obyektlarga parse qilingan)
const all = await Users.all();

// Default — "yumshoq" qidiruv: matn ustunlarida registrga befarq qism-matn
const alis = await Users.find({ name: "ali" });        // "Ali", "Alisher" ham topadi

// Aniq tenglik
const u = await Users.findOne({ id: 5042 }, { exact: true });

// Qo'shimcha parametrlar: limit / orderBy / dir / exact
const top = await Users.find(
  { role: "admin" },
  { orderBy: "id", dir: "desc", limit: 10, exact: true },
);
```

**Qidiruv qoidalari**

- Default (`exact: false`): matn (string) fieldlar registrga befarq `contains` bilan,
  qolganlari `=` bilan solishtiriladi. Foydalanuvchi qidiruv maydonchasi uchun qulay.
- `exact: true`: hamma field aniq tenglik (`=`) bilan tekshiriladi.
- match obyektidagi bir nechta field `AND` bilan birlashtiriladi.
- `null` — bo'sh kataklarga mos keladi (`is null`).

### Xom (raw) va header o'qish

```ts
// Xom o'qish — sxemada YO'Q ustunlarni HAM oladi; Cell[][] qaytaradi (parse qilmaydi)
const grid = await Users.allRaw();                       // butun sheet
const slice = await Users.allRaw({ fromRow: 2, limit: 100 });

// Header qatorlari (startRow'dan yuqoridagilar), xom ko'rinishda
const headerRows = await Users.headers();                // string[][]

// Har bir field uchun header qiymatlari
const map = await Users.headerMap();
// → { id: ["ID"], name: ["Ism"], ... }
```

---

## Yozish

> Yozish uchun o'qish-yozish scope kerak (`{ readonly: true }` BERMANG) va service
> account jadvalga **Editor** huquqiga ega bo'lishi shart.

```ts
// Oxiriga bitta / bir nechta qator qo'shish
await Users.insert({ id: 1, name: "Ali", email: "ali@example.com" });
await Users.insertMany([
  { id: 2, name: "Vali" },
  { id: 3, name: "Guli" },
]);

// Mos qatorlarni patch bilan yangilash — nechta qator o'zgargani qaytadi
const changed = await Users.update({ id: 5042 }, { name: "Vali" }, { exact: true });

// Mos qatorlarni o'chirish (qatorlar olib tashlanadi) — nechta o'chirilgani qaytadi
const removed = await Users.delete({ role: "guest" });

// Qiymatlarni belgilangan qatordan boshlab USTIGA yozish (yangi qator QO'SHMAYDI)
await Users.set([{ id: 1, name: "Ali" }, { id: 2, name: "Vali" }]); // startRow'dan
await Users.set(rows, { fromRow: 10 });                             // 10-qatordan

// Mos qatorlarning kataklarini bo'shatish (qator JOYIDA qoladi) — soni qaytadi
await Users.clear({ id: 5042 }, { exact: true });
await Users.clear({});                                  // hamma ma'lumot qatorini bo'shatadi

// Pozitsiya (diapazon) bo'yicha tozalash — match'siz
await Users.clearRange();                               // hamma ma'lumot
await Users.clearRange({ fromRow: 5, toRow: 20 });
await Users.clearRange({ fromCol: "B", toCol: "D" });

// Formulani pastga "tortish" (autoFill) — nisbiy ssilkalarni har qatorga moslaydi.
// Manba katakda formula bo'lmasa — hech narsa qilmaydi (false qaytaradi).
await Users.fillFormula({ col: "E", fromRow: 2, toRow: 5000 });
```

`update` / `delete` / `clear` xuddi `find` kabi match parametrlarini qabul qiladi
(`exact`, `limit`).

---

## Xatolarni ushlash

Har bir amal o'ralgan — xato `SpreadsheetError` ko'rinishida, qaysi metod va qaysi
varaqda yuz bergani konteksti bilan chiqadi.

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

## API qisqacha ma'lumotnoma

### `new Spreadsheet(credentials, options?)` · `new Spreadsheet(email, key, options?)`

- `credentials` — service-account JSON (`{ client_email, private_key, ... }`).
- `options.readonly` — readonly scope so'raydi (default: o'qish + yozish).
- `options.scopes` — maxsus scope'lar (`readonly`'dan ustun turadi).
- `.doc(spreadsheetId)` → `Document`

### `Document`

- `.model(sheetName, config)` → `Model` — `config` bu `{ columns, startRow? }`.

### `Model`

| Metod                                  | Qaytaradi                | Tavsif                                          |
| -------------------------------------- | ------------------------ | ----------------------------------------------- |
| `find(match?, options?)`               | `T[]`                    | Mos qatorlar (server tomonda `gviz`).           |
| `findOne(match?, options?)`            | `T \| null`              | Birinchi mos qator.                             |
| `all(options?)`                        | `T[]`                    | Hamma qator.                                    |
| `allRaw(options?)`                     | `Cell[][]`               | Xom jadval, sxemada yo'q ustunlar bilan.        |
| `headers()`                            | `string[][]`             | Xom header qatorlari (`startRow`'dan yuqori).   |
| `headerMap()`                          | `Record<field,string[]>` | Field bo'yicha header qiymatlari.               |
| `insert(obj)`                          | `void`                   | Bitta qator qo'shadi (oxiriga).                 |
| `insertMany(objs)`                     | `void`                   | Ko'p qatorni bitta so'rovda qo'shadi.           |
| `update(match, patch, options?)`       | `number`                 | Mos qatorlarni yangilaydi; soni qaytadi.        |
| `delete(match, options?)`              | `number`                 | Mos qatorlarni o'chiradi; soni qaytadi.         |
| `set(rows, options?)`                  | `void`                   | Qatordan boshlab ustiga yozadi (qo'shmaydi).    |
| `clear(match, options?)`               | `number`                 | Mos qatorlar kataklarini bo'shatadi; soni.      |
| `clearRange(options?)`                 | `void`                   | Qator/ustun diapazonini bo'shatadi.             |
| `fillFormula({ col, fromRow, toRow })` | `boolean`                | Formulani pastga to'ldiradi; yo'q bo'lsa `false`.|
| `col(field)`                           | `string`                 | Field uchun ustun harfi.                        |
| `range(endRow?)`                       | `string`                 | Sxema uchun A1 diapazoni (mas. `users!B2:F`).   |
| `parse(row)` / `serialize(obj)`        | `T` / `Cell[]`           | Qo'lda qator ↔ obyekt konvertatsiyasi.          |

**Parametrlar (Options)**

- `FindOptions` — `{ limit?, orderBy?, dir?: "asc" | "desc", exact? }`
- `MatchOptions` — `{ exact?, limit? }`
- `SetOptions` — `{ fromRow? }`
- `RawOptions` — `{ fromRow?, toRow?, limit? }`
- `ClearOptions` — `{ fromRow?, toRow?, fromCol?, toCol? }`

---

## Ishlab chiqish (Development)

```bash
yarn install
yarn typecheck   # tsc --noEmit
yarn build       # tsup → dist/ (ESM + CJS + .d.ts)
```

## Litsenziya

MIT © Suhrobbek Soatov
