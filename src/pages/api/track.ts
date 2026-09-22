import type { APIRoute } from 'astro';
import { clientIp, rateLimit } from '../../lib/rateLimit';
import { readIdentity } from '../../server/analytics/identity';
import { CLIENT_EVENTS } from '../../server/analytics/events';
import { trackEvent } from '../../server/analytics/track';
import { attributionFrom, deviceFrom, isBot } from '../../server/analytics/channel';

export const prerender = false;

/**
 * رویدادهایی که سرور نمی‌بیند: کلیک، مرحلهٔ ماشین‌حساب، رها کردن فرم.
 *
 * بازدید صفحه از اینجا نمی‌آید — آن را میدل‌ور ثبت می‌کند. این مسیر فقط
 * برای کارهایی است که داخل خود صفحه اتفاق می‌افتد و هیچ درخواستی به سرور
 * نمی‌فرستد.
 *
 * شناسهٔ بازدیدکننده از بدنه خوانده نمی‌شود، از کوکی `httpOnly` همان
 * درخواست برداشته می‌شود؛ پس کسی نمی‌تواند رویداد را به نام بازدیدکنندهٔ
 * دیگری ثبت کند.
 */

/* سقف سخاوتمندانه ولی محدود: کاربر واقعی در ده دقیقه به ۶۰ رویداد
   نمی‌رسد، اسکریپتی که بخواهد آمار را متورم کند می‌رسد. */
const MAX_PER_IP = 60;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024;

/* پاسخ همیشه ۲۰۴ است و بدنه ندارد: مرورگر این درخواست را با
   `sendBeacon` می‌فرستد و به پاسخ نگاه نمی‌کند. اگر چیزی اشتباه بود هم
   نباید به کاربر خطایی نشان داده شود — این فقط آمار است. */
const done = () => new Response(null, { status: 204 });

export const POST: APIRoute = async ({ request, cookies, url, clientAddress }) => {
  if (isBot(request.headers.get('user-agent'))) return done();

  const limit = rateLimit(`track:${clientIp(request, clientAddress)}`, MAX_PER_IP, WINDOW_MS);
  if (!limit.ok) return done();

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return done();

  const identity = readIdentity(cookies);
  if (!identity) return done();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return done();
  }

  const type = String(body.type ?? '');
  if (!CLIENT_EVENTS.has(type)) return done();

  /* نشانی صفحه از بدنه می‌آید چون درخواست از یک صفحهٔ دیگر فرستاده می‌شود
     و `url` اینجا همان `/api/track` است. فقط مسیر نگه داشته می‌شود، بدون
     دامنه و پارامتر — و هر چیزی که شکل مسیر نداشته باشد دور ریخته می‌شود. */
  const raw = String(body.path ?? '');
  const path = /^\/[^\s?#]*/.exec(raw)?.[0] ?? null;

  trackEvent({
    ...identity,
    type,
    path,
    device: deviceFrom(request.headers.get('user-agent')),
    attribution: attributionFrom(url, request.headers.get('referer'), url.hostname),
    props: sanitizeProps(body.props),
  });

  return done();
};

/**
 * `props` از سمت مرورگر می‌آید، پس محدود می‌شود.
 *
 * حداکثر شش کلید، فقط مقدارهای ساده و کوتاه. بدون این، یک درخواست
 * می‌توانست شیء تودرتوی بزرگی را در ستون JSON بنشاند.
 */
function sanitizeProps(value: unknown): Record<string, string | number | boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const out: Record<string, string | number | boolean> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>).slice(0, 6)) {
    const name = key.slice(0, 24);
    if (typeof val === 'number' && Number.isFinite(val)) out[name] = val;
    else if (typeof val === 'boolean') out[name] = val;
    else if (typeof val === 'string') out[name] = val.slice(0, 120);
  }

  return Object.keys(out).length ? out : null;
}

export const ALL: APIRoute = () => new Response(null, { status: 405 });
