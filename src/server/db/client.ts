import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as schema from './schema';

/**
 * اتصال به دیتابیس.
 *
 * دو حالت دارد و انتخاب بین آن‌ها خودکار است:
 *
 * - اگر `DATABASE_URL` تعریف شده باشد → Postgres واقعی (روی سرور).
 * - اگر تعریف نشده باشد → PGlite، یعنی همان Postgres که به WebAssembly
 *   کامپایل شده و داده را در یک پوشهٔ محلی نگه می‌دارد.
 *
 * دلیل حالت دوم: کسی که مخزن را تازه clone می‌کند باید فقط با
 * `npm install && npm run dev` سایت را ببیند، بدون نصب Postgres. چون PGlite
 * واقعاً Postgres است (نه یک شبیه‌ساز مثل SQLite)، همان مایگریشن‌ها و همان
 * SQL در هر دو حالت اجرا می‌شود و رفتار محیط توسعه با سرور یکی می‌ماند.
 */

type Database = PgDatabase<any, typeof schema>;

let instance: Database | null = null;
let connecting: Promise<Database> | null = null;

async function connect(): Promise<Database> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const [{ drizzle }, postgres] = await Promise.all([
      import('drizzle-orm/postgres-js'),
      import('postgres').then((m) => m.default),
    ]);

    /* سقف اتصال‌ها پایین نگه داشته شده: این اپ روی یک نمونه اجرا می‌شود و
       دیتابیس‌های مدیریت‌شده سقف اتصال محدودی دارند. */
    const sql = postgres(url, {
      max: 8,
      idle_timeout: 30,
      connect_timeout: 10,
      // درایور به‌طور پیش‌فرض روی خطای اتصال کل پروسه را نمی‌خواباند؛
      // خطا به لایهٔ بالا برمی‌گردد و آنجا لاگ می‌شود.
      onnotice: () => {},
    });

    return drizzle(sql, { schema }) as unknown as Database;
  }

  const [{ PGlite }, { drizzle }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
  ]);

  const dataDir = process.env.PGLITE_DIR ?? './.data/pglite';

  // PGlite فقط پوشهٔ خودش را می‌سازد، نه مسیر والد را
  const { mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(dataDir), { recursive: true });

  const client = new PGlite(dataDir);
  return drizzle(client, { schema }) as unknown as Database;
}

/**
 * اتصال مشترک، با ساختار به‌روزشده.
 *
 * اولین فراخوانی اتصال را می‌سازد و مایگریشن‌ها را اجرا می‌کند؛ بقیه همان را
 * می‌گیرند — از جمله فراخوانی‌های هم‌زمان، که همگی منتظر همان یک Promise
 * می‌مانند تا دو استخر اتصال ساخته نشود.
 *
 * مایگریشن اینجا انجام می‌شود و نه هنگام بالا آمدن اپ، چون آن‌وقت حتی
 * ساختن صفحات ثابت در زمان بیلد هم به دیتابیس وصل می‌شد. این‌طوری فقط
 * چیزی که واقعاً به داده نیاز دارد اتصال را برقرار می‌کند.
 */
export function getDb(): Promise<Database> {
  if (instance) return Promise.resolve(instance);

  connecting ??= connect()
    .then(async (db) => {
      const { runMigrations } = await import('./migrate');
      const applied = await runMigrations(db as never);
      if (applied > 0) console.log(`[db] ${applied} مایگریشن اجرا شد`);

      instance = db;
      connecting = null;
      return db;
    })
    .catch((err) => {
      // اجازه می‌دهیم درخواست بعدی دوباره تلاش کند
      connecting = null;
      throw err;
    });

  return connecting;
}

export { schema };
export type { Database };
