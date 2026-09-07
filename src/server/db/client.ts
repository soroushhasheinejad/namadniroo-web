import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

/**
 * اتصال به دیتابیس.
 *
 * موتور SQLite است و کل دیتابیس یک فایل روی دیسک پایدار. برای این سایت
 * انتخاب درستی است: حجم داده کم است، خواندن بسیار بیشتر از نوشتن است، و
 * کوئری بدون رفت‌وبرگشت شبکه انجام می‌شود — یعنی سریع‌تر از یک دیتابیس
 * شبکه‌ای، بدون هزینهٔ ماهانهٔ جداگانه.
 *
 * محدودیتی که باید بدانید: بکاپ خودکار ندارد. فایل دیتابیس باید دوره‌ای
 * کپی شود (بخش بکاپ در DEPLOY.md).
 *
 * محیط توسعه و سرور دقیقاً یک موتور را اجرا می‌کنند؛ فقط مسیر فایل فرق
 * می‌کند.
 */

export function databaseFile(): string {
  return process.env.DATABASE_PATH ?? './.data/namadniroo.db';
}

type Database = ReturnType<typeof drizzle<typeof schema>>;

let instance: Database | null = null;
let connecting: Promise<Database> | null = null;

async function connect(): Promise<Database> {
  const file = path.resolve(databaseFile());
  mkdirSync(path.dirname(file), { recursive: true });

  const client = createClient({ url: `file:${file}` });

  /* WAL باعث می‌شود خواندن و نوشتن هم‌زمان همدیگر را بلوکه نکنند — بدون آن،
     یک ذخیره در پنل می‌توانست چند بازدیدکننده را لحظه‌ای معطل کند.
     `foreign_keys` در SQLite به‌صورت پیش‌فرض خاموش است و باید در هر اتصال
     روشن شود، وگرنه ارجاع‌های تعریف‌شده در اسکیما رعایت نمی‌شوند. */
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA foreign_keys = ON');
  await client.execute('PRAGMA busy_timeout = 5000');

  return drizzle(client, { schema });
}

/**
 * اتصال مشترک، با ساختار به‌روزشده.
 *
 * اولین فراخوانی اتصال را می‌سازد و مایگریشن‌ها را اجرا می‌کند؛ بقیه همان را
 * می‌گیرند — از جمله فراخوانی‌های هم‌زمان، که همگی منتظر همان یک Promise
 * می‌مانند تا دو اتصال ساخته نشود.
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
      const applied = await runMigrations(db);
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
