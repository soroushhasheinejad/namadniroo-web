import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * نشانی قدیمی پنل درخواست‌ها.
 *
 * تیم فروش این نشانی را بلد است و احتمالاً بوکمارک کرده. به‌جای ۴۰۴ دادن،
 * به جای تازه‌اش منتقل می‌شود.
 */
export const GET: APIRoute = ({ redirect }) => redirect('/admin/leads', 301);
