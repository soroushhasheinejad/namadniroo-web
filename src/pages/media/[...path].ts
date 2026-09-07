import type { APIRoute } from 'astro';
import { readVariant } from '../../server/media/store';

export const prerender = false;

/**
 * سرو کردن تصاویر آپلودشده.
 *
 * فایل‌ها روی دیسک پایدار می‌نشینند، بیرون از پوشهٔ خروجی بیلد — وگرنه با
 * هر انتشار پاک می‌شدند. این مسیر آن‌ها را می‌خواند و تحویل می‌دهد.
 *
 * چون نام فایل از محتوایش ساخته می‌شود، هر تغییری در تصویر یعنی آدرس تازه؛
 * پس می‌شود کش را برای همیشه تنظیم کرد و مرورگر هیچ‌وقت دوباره سراغش
 * نمی‌آید.
 */
export const GET: APIRoute = async ({ params }) => {
  const segments = (params.path ?? '').split('/');
  if (segments.length !== 2) return new Response('Not found', { status: 404 });

  const [key, file] = segments as [string, string];
  const width = Number(file.replace(/\.webp$/, ''));
  if (!Number.isInteger(width) || width <= 0) {
    return new Response('Not found', { status: 404 });
  }

  const body = await readVariant(key, width);
  if (!body) return new Response('Not found', { status: 404 });

  return new Response(body, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
