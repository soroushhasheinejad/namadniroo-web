import type { APIRoute } from 'astro';
import { getSetting } from '../server/repos/content';

export const prerender = false;

/**
 * robots.txt، با امکان ویرایش از پنل.
 *
 * بخش‌های حیاتی — مسدودکردن پنل و معرفی نقشهٔ سایت — همیشه اضافه می‌شوند و
 * از پنل قابل حذف نیستند، تا یک ویرایش اشتباه کل سایت را از گوگل حذف نکند
 * یا پنل مدیریت را در نتایج جست‌وجو نیاورد.
 */

const REQUIRED = [
  '# بخش‌های مدیریتی نباید ایندکس شوند',
  'Disallow: /admin',
  'Disallow: /leads',
  'Disallow: /api/',
].join('\n');

const DEFAULT_RULES = 'User-agent: *\nAllow: /';

export const GET: APIRoute = async () => {
  const custom = await getSetting<string>('robots', DEFAULT_RULES).catch(() => DEFAULT_RULES);

  const body = [custom.trim(), '', REQUIRED, '', 'Sitemap: https://namadniroo.ir/sitemap.xml'].join(
    '\n',
  );

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
