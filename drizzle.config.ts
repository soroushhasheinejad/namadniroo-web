import { defineConfig } from 'drizzle-kit';

/**
 * تنظیمات ابزار مایگریشن.
 *
 * مایگریشن‌ها فایل SQL نسخه‌دار داخل مخزن‌اند و هنگام بالا آمدن اپ اجرا
 * می‌شوند. با `npm run db:generate` بعد از هر تغییر در schema.ts فایل تازه
 * ساخته می‌شود؛ آن فایل باید کامیت شود.
 */
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/namadniroo',
  },
  casing: 'snake_case',
});
