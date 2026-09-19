/**
 * موتور فرم‌های پنل.
 *
 * هر بخش قابل ویرایش (اطلاعات شرکت، منو، اسلایدها، متن صفحات…) یک بار
 * فیلدهایش را اینجا اعلام می‌کند، و از همان یک تعریف دو چیز ساخته می‌شود:
 * فرمی که ویراستار می‌بیند، و خواندن ورودی ارسال‌شده به شکل درست.
 *
 * جایگزین ویرایش JSON خام است — که برای ویراستار غیرفنی عملاً غیرقابل
 * استفاده بود و یک ویرگول جاافتاده کل بخش را از ذخیره بازمی‌داشت.
 */

interface Base {
  key: string;
  label: string;
  hint?: string;
}

export type Field =
  | (Base & { kind: 'text'; ltr?: boolean; placeholder?: string })
  | (Base & { kind: 'textarea'; ltr?: boolean; rows?: number })
  | (Base & { kind: 'checkbox' })
  | (Base & { kind: 'select'; options: { value: string; label: string }[] })
  /** ارجاع به تصویر کتابخانه؛ کلید رسانه ذخیره می‌شود */
  | (Base & { kind: 'image' })
  /** فهرستی از متن‌های کوتاه، هر کدام در یک خط */
  | (Base & { kind: 'lines' })
  /** چند فیلد که با هم یک شیء می‌سازند */
  | (Base & { kind: 'group'; fields: Field[] })
  /** ردیف‌های تکرارشونده که قابل افزودن، حذف و جابه‌جایی‌اند */
  | (Base & {
      kind: 'list';
      item: Field[];
      /** فیلدی که مقدارش عنوان هر ردیف بسته‌شده است */
      itemTitle?: string;
      addLabel?: string;
    });

export type FieldKind = Field['kind'];

/* ============================================================
   نام‌گذاری فیلدهای فرم
   ============================================================

   هر فیلد نامی مثل مسیر دارد: `v.site.phone`، و ردیف‌های فهرست با یک
   نشانه که با `~` شروع می‌شود: `v.~r7.label`.

   ترتیب ردیف‌ها از ترتیب نشانه‌ها در خود فرم می‌آید، نه از عدد. مرورگر
   فیلدها را به ترتیب ظاهرشان در صفحه ارسال می‌کند، پس ویراستار هر ردیفی را
   جابه‌جا، حذف یا اضافه کند، سرور همان ترتیبی را می‌بیند که روی صفحه بود —
   بدون این‌که اسکریپت صفحه لازم باشد شماره‌ها را از نو بنویسد. */

export const ROOT = 'v';

export const childName = (parent: string, key: string) => (key ? `${parent}.${key}` : parent);
export const rowName = (parent: string, token: string) => `${parent}.~${token}`;

type Tree = { [key: string]: Tree | string };

/** ورودی‌های فرم را به یک درخت تبدیل می‌کند، با حفظ ترتیب ظاهرشدن */
export function formTree(entries: Iterable<[string, FormDataEntryValue]>): Tree | string | undefined {
  const root: Tree = {};
  let selfValue: string | undefined;

  for (const [name, raw] of entries) {
    if (typeof raw !== 'string') continue;
    if (name === ROOT) {
      selfValue = raw;
      continue;
    }
    if (!name.startsWith(`${ROOT}.`)) continue;

    const segments = name.slice(ROOT.length + 1).split('.').filter(Boolean);
    let node = root;
    segments.forEach((seg, i) => {
      if (i === segments.length - 1) {
        node[seg] = raw;
        return;
      }
      // کلیدهای `~…` عدد نیستند، پس شیء جاوااسکریپت ترتیب درجشان را نگه می‌دارد
      if (typeof node[seg] !== 'object') node[seg] = {};
      node = node[seg] as Tree;
    });
  }

  return selfValue ?? (Object.keys(root).length ? root : undefined);
}

/* ============================================================
   تبدیل ورودی به مقدار نهایی
   ============================================================ */

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * ورودی خام یک فیلد را به مقدار نهایی‌اش تبدیل می‌کند.
 *
 * از روی تعریف فیلد پیش می‌رود نه از روی داده — چون چک‌باکس خاموش و
 * فهرست خالی اصلاً در ورودی ظاهر نمی‌شوند، و فقط تعریف می‌داند که باید
 * جایشان `false` و `[]` بنشیند.
 */
export function coerce(field: Field, raw: unknown): unknown {
  switch (field.kind) {
    case 'text':
    case 'select':
    case 'image':
      return str(raw).trim();
    case 'textarea':
      return str(raw).replace(/\r\n/g, '\n').trim();
    case 'checkbox':
      return raw === '1';
    case 'lines':
      return str(raw)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    case 'group':
      return coerceFields(field.fields, raw);
    case 'list': {
      const rows = raw && typeof raw === 'object' ? Object.values(raw) : [];
      return rows
        .map((row) => coerceFields(field.item, row))
        // ردیفی که کاملاً خالی مانده (مثلاً «افزودن» زده شده و رها شده) ذخیره نمی‌شود
        .filter((row) => !isBlank(row));
    }
  }
}

function coerceFields(fields: Field[], raw: unknown): Record<string, unknown> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f.key] = coerce(f, source[f.key]);
  return out;
}

/** آیا ردیف هیچ متنی ندارد؟ چک‌باکس‌ها حساب نمی‌شوند. */
function isBlank(value: unknown): boolean {
  if (typeof value === 'string') return value === '';
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.values(value).every(isBlank);
  return value == null;
}

/** کل فرم ارسال‌شده → مقدار نهایی، بر اساس فیلد ریشه */
export function parseForm(root: Field, form: FormData): unknown {
  const tree = formTree(form.entries());
  // در فیلدهای ساده، مقدار مستقیم زیر نام ریشه می‌آید
  return coerce(root, tree);
}

/** نشانهٔ تازه برای ردیف — فقط باید در یک فرم یکتا باشد */
export function newToken(): string {
  return Math.random().toString(36).slice(2, 8);
}
