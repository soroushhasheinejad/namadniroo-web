import { getDb } from './client';

/**
 * اجرای مایگریشن‌های اجرانشده.
 *
 * چرا هنگام بالا آمدن اپ و نه به‌صورت یک مرحلهٔ جدا در دیپلوی: میزبان فقط
 * `npm start` را صدا می‌زند و جایی برای اجرای دستور میانی ندارد. اگر
 * مایگریشن دستی بماند، دیر یا زود یک انتشار بدون آن انجام می‌شود و اپ روی
 * ساختار قدیمی اجرا می‌گردد.
 *
 * خودِ drizzle جدول تاریخچه نگه می‌دارد، پس اجرای دوباره بی‌ضرر است.
 */

let done: Promise<void> | null = null;

async function run(): Promise<void> {
  const db = await getDb();
  const folder = new URL('./migrations/', import.meta.url).pathname;

  if (process.env.DATABASE_URL) {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    await migrate(db as never, { migrationsFolder: folder });
  } else {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(db as never, { migrationsFolder: folder });
  }
}

/**
 * تضمین می‌کند ساختار دیتابیس به‌روز است. چندبار صدا زدن اشکالی ندارد —
 * فقط بار اول واقعاً اجرا می‌شود.
 */
export function ensureMigrated(): Promise<void> {
  done ??= run().catch((err) => {
    // اجازه می‌دهیم دفعهٔ بعد دوباره تلاش شود؛ وگرنه یک خطای گذرای شبکه
    // اپ را تا ری‌استارت بعدی بی‌استفاده می‌کند.
    done = null;
    throw err;
  });
  return done;
}
