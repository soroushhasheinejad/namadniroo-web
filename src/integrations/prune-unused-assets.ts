import type { AstroIntegration } from 'astro';
import { readdir, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

/**
 * فایل‌های تصویری منتشرشده ولی بی‌استفاده را از خروجی بیلد پاک می‌کند.
 *
 * چرا لازم است: هر تصویری که در کد `import` شود، Vite نسخهٔ اصلی‌اش را در
 * خروجی می‌گذارد — حتی اگر ما فقط از نسخهٔ WebPِ ساخته‌شده با getImage
 * استفاده کنیم. نتیجه حدود ۳٫۵ مگابایت JPG بود که هیچ صفحه‌ای به آن لینک
 * نمی‌داد و فقط حجم دیپلوی را بالا می‌برد.
 *
 * روش کار محافظه‌کارانه است: اول همهٔ فایل‌های متنی خروجی (HTML، CSS، JS —
 * هم سمت کلاینت هم سمت سرور) خوانده می‌شوند، بعد فقط تصویری حذف می‌شود که
 * نامش در هیچ‌کدام نیامده باشد. اگر روزی جایی به‌شکل غیرمنتظره‌ای به تصویر
 * ارجاع داده شود، آن تصویر پیدا و نگه داشته می‌شود.
 */

/** فقط فرمت‌های اصلی؛ خروجی بهینه‌شده (webp/avif) هرگز حذف نمی‌شود. */
const PRUNABLE = /\.(jpe?g|png|tiff?)$/i;
const TEXT_FILES = /\.(html|css|js|mjs|cjs|json|xml|txt)$/i;

/**
 * فهرست موجودی دارایی‌ها را از مانیفست سمت سرور حذف می‌کند.
 *
 * مانیفست یک آرایهٔ `"assets":[…]` دارد که نام *همهٔ* فایل‌های تولیدشده در
 * آن آمده — چه استفاده شوند چه نه. اگر آن را هم جست‌وجو کنیم، هر تصویری
 * «استفاده‌شده» به نظر می‌رسد و هیچ‌وقت چیزی پاک نمی‌شود. این آرایه ارجاع
 * واقعی نیست، فقط سیاهه است، پس کنار گذاشته می‌شود.
 */
function stripAssetInventory(text: string): string {
  return text.replace(/"assets":\[[^\]]*\]/g, '"assets":[]');
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out; // پوشه وجود ندارد (مثلاً بیلد بدون سرور)
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

export default function pruneUnusedAssets(): AstroIntegration {
  return {
    name: 'namadniroo:prune-unused-assets',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        // `dir` پوشهٔ کلاینت است؛ خروجی سرور کنار آن قرار دارد
        const clientDir = new URL('./', dir).pathname;
        const outDir = path.resolve(clientDir, '..');

        const files = await walk(outDir);
        const candidates = files.filter((f) => PRUNABLE.test(f) && f.includes('_astro'));
        if (candidates.length === 0) return;

        const haystack = (
          await Promise.all(
            files
              .filter((f) => TEXT_FILES.test(f))
              .map((f) => readFile(f, 'utf8').then(stripAssetInventory).catch(() => '')),
          )
        ).join('\n');

        let removed = 0;
        let bytes = 0;
        for (const file of candidates) {
          if (haystack.includes(path.basename(file))) continue;
          bytes += (await stat(file)).size;
          await unlink(file);
          removed++;
        }

        if (removed > 0) {
          logger.info(`${removed} تصویر بی‌استفاده حذف شد (${Math.round(bytes / 1024)} کیلوبایت)`);
        }
      },
    },
  };
}
