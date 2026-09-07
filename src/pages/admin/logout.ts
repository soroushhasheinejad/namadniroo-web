import type { APIRoute } from 'astro';
import { clearSessionCookie, logout, readSessionCookie } from '../../server/auth/session';

export const prerender = false;

/**
 * خروج از حساب.
 *
 * فقط با POST انجام می‌شود: اگر با GET بود، کافی بود کسی تصویری با آدرس
 * `/admin/logout` جایی بگذارد تا هر کاربری که آن را می‌بیند از حساب خارج
 * شود.
 *
 * رکورد سشن در دیتابیس هم پاک می‌شود، نه فقط کوکی — وگرنه اگر کسی نسخه‌ای
 * از کوکی داشته باشد، همچنان معتبر می‌ماند.
 */
export const POST: APIRoute = async (context) => {
  await logout(readSessionCookie(context));
  clearSessionCookie(context);
  return context.redirect('/admin/login');
};
