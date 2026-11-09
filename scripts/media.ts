/**
 * تصاویر مخزن را وارد کتابخانهٔ رسانه می‌کند و به محصولاتِ بی‌تصویر وصلشان
 * می‌کند: از روی `products.json`، یا برای محصولی که آنجا نیست از روی فایلی
 * که نامش همان نامک محصول است.
 *
 * برخلاف `db:seed` چیزی را بازنویسی نمی‌کند: تصویری که در پنل برای یک
 * محصول انتخاب شده دست‌نخورده می‌ماند و فقط ردیف‌هایی پر می‌شوند که هنوز
 * خالی‌اند. پس هر وقت عکس تازه‌ای به `src/assets` اضافه شد، اجرایش بی‌خطر
 * است — چند بار هم که اجرا شود نتیجه یکی است.
 *
 * تصاویری که در تنظیمات یا متن صفحات با نام فایل به آن‌ها ارجاع داده شده
 * (مثل تصویر هیرو یا بنر فروشگاه) همین‌که وارد کتابخانه شوند خودبه‌خود روی
 * سایت می‌نشینند؛ این اسکریپت فقط باید وارَدشان کند.
 *
 *   npm run db:media
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { eq, isNull, and } from 'drizzle-orm';
import { getDb } from '../src/server/db/client';
import { products } from '../src/server/db/schema';
import { ingestImage } from '../src/server/media/store';

const root = path.resolve(import.meta.dirname, '..');
const DIRS = ['src/assets', 'src/assets/products'];

const mimeOf = (file: string) =>
  file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

/** نام فایل → شناسهٔ رکورد رسانه */
async function ingestAll(): Promise<Map<string, number>> {
  const byFilename = new Map<string, number>();
  let added = 0;

  for (const dir of DIRS) {
    const full = path.join(root, dir);
    if (!existsSync(full)) continue;

    for (const file of await readdir(full)) {
      if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;

      const buffer = await readFile(path.join(full, file));
      const { media, duplicate } = await ingestImage(buffer, { filename: file, mime: mimeOf(file) });
      byFilename.set(file, media.id);
      if (!duplicate) added++;
    }
  }

  console.log(`رسانه: ${byFilename.size} تصویر بررسی شد، ${added} تصویر تازه`);
  return byFilename;
}

/** تصویر محصولاتی که هنوز تصویری ندارند را از `products.json` می‌گیرد */
async function linkProducts(byFilename: Map<string, number>): Promise<void> {
  const db = await getDb();
  const rows: { id: string; image?: string }[] = JSON.parse(
    await readFile(path.join(root, 'src/data/products.json'), 'utf8'),
  );

  let linked = 0;
  const missing: string[] = [];

  for (const p of rows) {
    if (!p.image) continue;
    const mediaId = byFilename.get(path.basename(p.image));
    if (!mediaId) {
      missing.push(p.id);
      continue;
    }

    /* شرط `isNull` مهم است: اگر ویراستار در پنل تصویر دیگری انتخاب کرده
       باشد، این اسکریپت نباید آن را به نسخهٔ مخزن برگرداند. */
    const done = await db
      .update(products)
      .set({ imageMediaId: mediaId, updatedAt: new Date() })
      .where(and(eq(products.slug, p.id), isNull(products.imageMediaId)))
      .returning({ slug: products.slug });

    linked += done.length;
  }

  /* محصولاتی که از مایگریشن آمده‌اند و در `products.json` نیستند: فایلی
     هم‌نام نامکشان در `src/assets/products` (مثل fronius-eco-25-0-3-s.jpg)
     تصویرشان است. همان شرط `isNull` اینجا هم هست. */
  const bare = await db
    .select({ slug: products.slug })
    .from(products)
    .where(isNull(products.imageMediaId));

  for (const { slug } of bare) {
    const mediaId = ['.jpg', '.png', '.webp'].map((ext) => byFilename.get(slug + ext)).find(Boolean);
    if (!mediaId) continue;

    const done = await db
      .update(products)
      .set({ imageMediaId: mediaId, updatedAt: new Date() })
      .where(and(eq(products.slug, slug), isNull(products.imageMediaId)))
      .returning({ slug: products.slug });

    linked += done.length;
  }

  console.log(`محصولات: ${linked} محصول تصویر گرفت`);
  if (missing.length) {
    console.warn(`هشدار: فایل تصویر این محصول‌ها پیدا نشد: ${missing.join('، ')}`);
  }
}

async function main(): Promise<void> {
  const byFilename = await ingestAll();
  await linkProducts(byFilename);
  console.log('تمام شد.');
}

main().catch((err) => {
  console.error('وارد کردن تصاویر ناموفق بود:', err);
  process.exit(1);
});
