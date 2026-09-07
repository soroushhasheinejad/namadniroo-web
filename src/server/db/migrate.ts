import { sql } from 'drizzle-orm';

/**
 * اجرای مایگریشن‌های اجرانشده.
 *
 * فایل‌های SQL در زمان بیلد داخل باندل قرار می‌گیرند (`?raw`)، نه این‌که
 * موقع اجرا از دیسک خوانده شوند. دلیلش این است که ساختار پوشهٔ خروجی در
 * میزبان‌های مختلف فرق می‌کند و مسیر نسبی به‌راحتی می‌شکند؛ وقتی خودِ SQL
 * بخشی از باندل باشد، هر جا که اپ اجرا شود مایگریشن‌ها همراهش هستند.
 *
 * جدول تاریخچه را خودمان نگه می‌داریم، پس اجرای دوباره بی‌ضرر است: هر فایل
 * دقیقاً یک بار اجرا می‌شود.
 */

/* Vite این فراخوانی را در زمان بیلد با شیئی از نام فایل → محتوای SQL جایگزین
   می‌کند، پس داخل باندل هیچ فایلی از دیسک خوانده نمی‌شود.
   بیرون از Vite — یعنی وقتی اسکریپت‌های خط فرمان مستقیم با Node اجرا
   می‌شوند — این تابع وجود ندارد و خطا می‌دهد؛ آنجا سراغ خواندن از دیسک
   می‌رویم. */
let bundled: Record<string, string> = {};
try {
  bundled = import.meta.glob('./migrations/*.sql', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;
} catch {
  bundled = {};
}

async function loadMigrations(): Promise<Record<string, string>> {
  if (Object.keys(bundled).length > 0) return bundled;

  const [{ readdir, readFile }, { fileURLToPath }, path] = await Promise.all([
    import('node:fs/promises'),
    import('node:url'),
    import('node:path'),
  ]);

  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
  const names = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [`./migrations/${name}`, await readFile(path.join(dir, name), 'utf8')]),
    ),
  );
}

const HISTORY_TABLE = '__migrations';

/**
 * یک فایل مایگریشن می‌تواند چند دستور داشته باشد که drizzle با این نشانه
 * از هم جدایشان می‌کند.
 */
function statements(source: string): string[] {
  return source
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function runMigrations(db: {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
}): Promise<number> {
  await db.execute(
    sql.raw(`create table if not exists ${HISTORY_TABLE} (
      name text primary key,
      applied_at timestamptz not null default now()
    )`),
  );

  const applied = (await db.execute(sql.raw(`select name from ${HISTORY_TABLE}`))) as
    | { rows?: { name: string }[] }
    | { name: string }[];

  // شکل خروجی بین درایور Postgres و PGlite فرق دارد
  const rows = Array.isArray(applied) ? applied : (applied.rows ?? []);
  const done = new Set(rows.map((r) => r.name));
  const files = await loadMigrations();

  // ترتیب اجرا بر اساس نام فایل است؛ drizzle آن‌ها را با شمارهٔ ابتدایی می‌سازد
  const pending = Object.keys(files)
    .sort()
    .filter((path) => !done.has(path.split('/').pop()!));

  for (const path of pending) {
    const name = path.split('/').pop()!;
    for (const statement of statements(files[path]!)) {
      await db.execute(sql.raw(statement));
    }
    await db.execute(sql`insert into ${sql.identifier(HISTORY_TABLE)} (name) values (${name})`);
  }

  return pending.length;
}
