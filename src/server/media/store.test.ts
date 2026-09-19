import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/* دیتابیس و پوشهٔ تصاویر موقت — تست به داده‌های واقعی دست نمی‌زند.
   باید پیش از اولین اتصال تنظیم شوند، چون مسیرها هنگام اتصال خوانده می‌شوند. */
const dir = mkdtempSync(path.join(tmpdir(), 'nn-media-'));
process.env.DATABASE_PATH = path.join(dir, 'test.db');
process.env.MEDIA_DIR = path.join(dir, 'media');

const { ingestImage, variantWidths } = await import('./store');

let png: Buffer;

beforeAll(async () => {
  const sharp = (await import('sharp')).default;
  png = await sharp({
    create: { width: 900, height: 600, channels: 3, background: { r: 255, g: 196, b: 26 } },
  })
    .png()
    .toBuffer();
});

const filesFor = (key: string, width: number) =>
  variantWidths(width).map((w) => path.join(process.env.MEDIA_DIR!, key, `${w}.webp`));

describe('ingestImage', () => {
  it('برای هر اندازه یک فایل می‌سازد', async () => {
    const { media, duplicate } = await ingestImage(png, { filename: 'a.png', mime: 'image/png' });
    expect(duplicate).toBe(false);
    expect(variantWidths(media.width)).toEqual([400, 800]);
    for (const f of filesFor(media.key, 900)) expect(existsSync(f), f).toBe(true);
  });

  it('آپلود دوباره رکورد تازه نمی‌سازد', async () => {
    const first = await ingestImage(png, { filename: 'a.png', mime: 'image/png' });
    const again = await ingestImage(png, { filename: 'a-copy.png', mime: 'image/png' });
    expect(again.duplicate).toBe(true);
    expect(again.media.id).toBe(first.media.id);
  });

  it('فایل‌های گم‌شده را از نو می‌سازد وقتی رکورد هنوز هست', async () => {
    /* باگی که پیدا شد: دیتابیس روی دیسکی بازگردانده شد که فایل‌ها را
       نداشت. ingest رکورد را «تکراری» می‌دید و بی‌آن‌که چیزی بنویسد خارج
       می‌شد، و تصویر برای همیشه ۴۰۴ می‌ماند. */
    const { media } = await ingestImage(png, { filename: 'a.png', mime: 'image/png' });
    rmSync(path.join(process.env.MEDIA_DIR!, media.key), { recursive: true, force: true });
    for (const f of filesFor(media.key, 900)) expect(existsSync(f)).toBe(false);

    const again = await ingestImage(png, { filename: 'a.png', mime: 'image/png' });
    expect(again.duplicate).toBe(true);
    for (const f of filesFor(media.key, 900)) expect(existsSync(f), f).toBe(true);
  });
});
