import { defineConfig } from 'drizzle-kit';

/**
 * تنظیمات ابزار مایگریشن.
 *
 * مایگریشن‌ها فایل SQL نسخه‌دار داخل مخزن‌اند و هنگام اولین اتصال به
 * دیتابیس اجرا می‌شوند. با `npm run db:generate` بعد از هر تغییر در
 * schema.ts فایل تازه ساخته می‌شود؛ آن فایل باید کامیت شود.
 */
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? './.data/namadniroo.db',
  },
  casing: 'snake_case',
});
