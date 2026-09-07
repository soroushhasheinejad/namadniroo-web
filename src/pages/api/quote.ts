import type { APIRoute } from 'astro';
import { clientIp, rateLimit } from '../../lib/rateLimit';
import { clean, validateQuote } from '../../server/validation/quote';
import { submitQuote } from '../../server/services/quote';

export const prerender = false;

/* سقف ارسال از یک آدرس. عدد دست‌ودل‌بازانه انتخاب شده تا کاربر واقعی — که
   ممکن است یک بار اشتباه کند و دوباره بفرستد — هرگز به آن نخورد، ولی ارسال
   خودکار پشت‌سرهم متوقف شود. */
const MAX_PER_IP = 5;
const WINDOW_MS = 10 * 60 * 1000;

/* سقف حجم بدنه. بدون این، یک درخواست بزرگ می‌تواند حافظه را اشغال کند. */
const MAX_BODY_BYTES = 8 * 1024;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  const limit = rateLimit(`quote:${ip}`, MAX_PER_IP, WINDOW_MS);
  if (!limit.ok) {
    return json({ success: false, message: 'درخواست‌های زیاد؛ کمی بعد دوباره تلاش کنید.' }, 429, {
      'Retry-After': String(limit.retryAfter),
    });
  }

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json({ success: false, message: 'حجم درخواست بیش از حد است' }, 413);
  }

  /* بدنه به‌صورت JSON فرستاده می‌شود، نه فرم.
     دلیلش امنیت است: مرورگر اجازه نمی‌دهد سایت دیگری بدون CORS برای ما
     JSON بفرستد، پس این مسیر ذاتاً در برابر CSRF امن است — و برخلاف حالت
     فرم، به دامنه‌ای که سایت روی آن بالا آمده گره نمی‌خورد. */
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'بدنهٔ درخواست نامعتبر است' }, 400);
  }

  // honeypot ضدربات — کاربر واقعی این فیلد را نمی‌بیند
  if (clean(body.website)) return json({ success: true });

  const parsed = validateQuote(body);
  if (!parsed.ok) return json({ success: false, message: parsed.message }, parsed.status);

  try {
    await submitQuote(parsed.value);
    return json({ success: true });
  } catch (err) {
    console.error('[quote] ثبت درخواست ناموفق بود:', err);
    return json({ success: false, message: 'ارسال با خطا مواجه شد' }, 500);
  }
};

// هر متد دیگری روی این آدرس مجاز نیست
export const ALL: APIRoute = () => json({ success: false, message: 'Method not allowed' }, 405);
