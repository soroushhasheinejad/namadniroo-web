import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { media, type Media } from '../db/schema';
import { TAGS, invalidate } from '../cache';

/**
 * ذخیره و بهینه‌سازی تصاویر.
 *
 * تا امروز تصاویر داخل `src/assets/` بودند و Astro در زمان بیلد بهینه‌شان
 * می‌کرد. حالا که ویراستار از پنل تصویر آپلود می‌کند، آن مسیر جواب نمی‌دهد:
 * تصویر تازه بعد از بیلد می‌آید، پس باید همان لحظه بهینه شود.
 *
 * هر تصویر هنگام آپلود به چند اندازه در قالب WebP تبدیل می‌شود و روی یک
 * دیسک پایدار می‌نشیند. صفحات با srcset اندازهٔ مناسب را برمی‌دارند — همان
 * چیزی که پیش از این Astro تولید می‌کرد.
 *
 * محل ذخیره یک پوشه است نه فضای ابری: راه‌اندازی‌اش هیچ کلید و سرویس
 * بیرونی نمی‌خواهد، و چون آدرس‌ها (`/media/…`) از محل واقعی فایل مستقل‌اند،
 * انتقال بعدی به فضای ابری هیچ آدرسی را نمی‌شکند.
 */

/** اندازه‌هایی که از هر تصویر ساخته می‌شود */
export const WIDTHS = [400, 800, 1200, 1920] as const;

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

export function mediaDir(): string {
  return process.env.MEDIA_DIR ?? './.data/media';
}

/** اندازه‌های موجود برای تصویری با این عرض اصلی */
export function variantWidths(originalWidth: number | null): number[] {
  if (!originalWidth) return [...WIDTHS];
  const fitting = WIDTHS.filter((w) => w <= originalWidth);
  // تصویر کوچک‌تر از کوچک‌ترین اندازه، فقط یک نسخه به اندازهٔ خودش دارد
  return fitting.length > 0 ? fitting : [originalWidth];
}

export function variantUrl(key: string, width: number): string {
  return `/media/${key}/${width}.webp`;
}

/** srcset آمادهٔ استفاده در تگ img */
export function buildSrcset(key: string, originalWidth: number | null): string {
  return variantWidths(originalWidth)
    .map((w) => `${variantUrl(key, w)} ${w}w`)
    .join(', ');
}

/* ============================================================
   آپلود
   ============================================================ */

export interface IngestResult {
  media: Media;
  /** true یعنی همین فایل از قبل بود و دوباره ذخیره نشد */
  duplicate: boolean;
}

/**
 * یک تصویر را می‌گیرد، نسخه‌های بهینه را می‌سازد و رکوردش را ثبت می‌کند.
 *
 * کلید فایل از محتوای خودش ساخته می‌شود، پس آپلود دوبارهٔ یک تصویر رکورد
 * تازه نمی‌سازد و فضا هدر نمی‌رود.
 */
export async function ingestImage(
  buffer: Buffer,
  options: { filename: string; mime: string; alt?: string; uploadedBy?: number },
): Promise<IngestResult> {
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`حجم فایل بیش از ${MAX_UPLOAD_BYTES / 1024 / 1024} مگابایت است`);
  }
  if (!ALLOWED_MIME.has(options.mime)) {
    throw new Error(`نوع فایل پشتیبانی نمی‌شود: ${options.mime}`);
  }

  const key = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const db = await getDb();

  const [existing] = await db.select().from(media).where(eq(media.key, key)).limit(1);
  if (existing) {
    // فقط متن جایگزین را به‌روز می‌کنیم، اگر تازه‌ای داده شده
    if (options.alt && options.alt !== existing.alt) {
      const [updated] = await db
        .update(media)
        .set({ alt: options.alt })
        .where(eq(media.id, existing.id))
        .returning();
      invalidate(TAGS.media);
      return { media: updated!, duplicate: true };
    }
    return { media: existing, duplicate: true };
  }

  const sharp = (await import('sharp')).default;
  const image = sharp(buffer, { animated: options.mime === 'image/gif' });
  const meta = await image.metadata();

  const width = meta.width ?? null;
  const height = meta.height ?? null;
  const dir = path.join(mediaDir(), key);
  await mkdir(dir, { recursive: true });

  /* همهٔ اندازه‌ها با هم ساخته می‌شوند. sharp کار را روی رشتهٔ جداگانه‌ای
     انجام می‌دهد، پس این‌ها واقعاً موازی‌اند و آپلود منتظر یکی‌یکی نمی‌ماند. */
  await Promise.all(
    variantWidths(width).map(async (w) => {
      const out = await sharp(buffer)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      await writeFile(path.join(dir, `${w}.webp`), out);
    }),
  );

  const largest = variantWidths(width).at(-1)!;

  const [row] = await db
    .insert(media)
    .values({
      key,
      url: variantUrl(key, largest),
      mime: 'image/webp',
      width,
      height,
      bytes: buffer.byteLength,
      alt: options.alt ?? null,
      uploadedBy: options.uploadedBy ?? null,
    })
    .returning();

  invalidate(TAGS.media);
  return { media: row!, duplicate: false };
}

/* ============================================================
   خواندن و حذف
   ============================================================ */

/** محتوای یک نسخه، یا null اگر نبود */
export async function readVariant(key: string, width: number): Promise<Buffer | null> {
  // جلوگیری از خروج از پوشه با کلید دستکاری‌شده
  if (!/^[a-f0-9]{6,64}$/.test(key)) return null;

  const file = path.join(mediaDir(), key, `${width}.webp`);
  if (!existsSync(file)) return null;
  return readFile(file);
}

export async function listMedia(): Promise<Media[]> {
  const db = await getDb();
  return db.select().from(media).orderBy(media.id);
}

export async function updateAlt(id: number, alt: string): Promise<void> {
  const db = await getDb();
  await db.update(media).set({ alt }).where(eq(media.id, id));
  invalidate(TAGS.media);
}

export async function deleteMedia(id: number): Promise<void> {
  const db = await getDb();
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  if (!row) return;

  await db.delete(media).where(eq(media.id, id));
  await rm(path.join(mediaDir(), row.key), { recursive: true, force: true });
  invalidate(TAGS.media, TAGS.products, TAGS.projects, TAGS.articles);
}
