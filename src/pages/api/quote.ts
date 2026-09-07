import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { saveLead } from '../../lib/leads';
import { normalizePhone } from '../../lib/phone';
import { clientIp, rateLimit } from '../../lib/rateLimit';

// این مسیر باید روی سرور اجرا شود، نه در زمان بیلد
export const prerender = false;

/* سقف ارسال از یک آدرس. عدد دست‌ودل‌بازانه انتخاب شده تا کاربر واقعی — که
   ممکن است یک بار اشتباه کند و دوباره بفرستد — هرگز به آن نخورد، ولی ارسال
   خودکار پشت‌سرهم متوقف شود. */
const MAX_PER_IP = 5;
const WINDOW_MS = 10 * 60 * 1000;

/* سقف حجم بدنه. بدون این، یک درخواست بزرگ می‌تواند حافظه را اشغال کند. */
const MAX_BODY_BYTES = 8 * 1024;

/* سقف طول هر فیلد، تا رکوردهای بی‌قواره ذخیره نشوند. */
const MAX_FIELD = 200;

/** حذف شکست خط تا کسی نتواند هدر ایمیل تزریق کند */
const clean = (v: unknown): string =>
  String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_FIELD);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

async function sendMail(lead: {
  name: string; phone: string; capacity: string; area: string; source: string;
}): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO, MAIL_FROM } = process.env;

  // تا وقتی تنظیمات SMTP در محیط اجرا تعریف نشده، ایمیل رد می‌شود؛
  // درخواست همچنان ذخیره شده است و از دست نمی‌رود.
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return false;

  try {
    const port = Number(SMTP_PORT ?? 465);
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transport.sendMail({
      to: MAIL_TO || 'sales@namadniroo.ir',
      from: MAIL_FROM || SMTP_USER,
      replyTo: MAIL_FROM || SMTP_USER,
      subject: 'درخواست مشاورهٔ جدید از سایت نماد نیرو',
      text:
        `درخواست جدید از فرم سایت namadniroo.ir\n\n` +
        `نام و نام خانوادگی: ${lead.name}\n` +
        `شمارهٔ تماس: ${lead.phone}\n` +
        `ظرفیت موردنظر: ${lead.capacity || '—'}\n` +
        `حوزهٔ درخواست: ${lead.area || '—'}\n` +
        `صفحهٔ مبدأ: ${lead.source || '—'}\n`,
    });
    return true;
  } catch (err) {
    console.error('[namadniroo] SMTP failed:', err);
    return false;
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  const limit = rateLimit(`quote:${ip}`, MAX_PER_IP, WINDOW_MS);
  if (!limit.ok) {
    return new Response(
      JSON.stringify({ success: false, message: 'درخواست‌های زیاد؛ کمی بعد دوباره تلاش کنید.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': String(limit.retryAfter),
        },
      },
    );
  }

  // بدنهٔ بیش از حد بزرگ اصلاً پارس نمی‌شود
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) {
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

  const name = clean(body.name);
  const phone = clean(body.phone);
  const capacity = clean(body.capacity);
  const area = clean(body.area);
  const source = clean(body.source);

  if (!name || !phone) {
    return json({ success: false, message: 'نام و شمارهٔ تماس الزامی است' }, 422);
  }

  /* شمارهٔ واردشده دست‌نخورده ذخیره می‌شود (کاربر باید همان چیزی را که نوشته
     در پنل ببیند) ولی شکل یکتای آن هم کنارش می‌آید تا بعداً تشخیص تکراری و
     جست‌وجو ممکن باشد. شمارهٔ نامعتبر همین‌جا رد می‌شود تا لید بی‌مصرف ثبت
     نشود. */
  const phoneNormalized = normalizePhone(phone);
  if (!phoneNormalized) {
    return json({ success: false, message: 'شمارهٔ تماس معتبر نیست' }, 422);
  }

  // ۱) اول ذخیره، بعد ایمیل — تا خرابی سرویس ایمیل باعث گم‌شدن لید نشود
  let stored = false;
  try {
    await saveLead({ createdAt: new Date().toISOString(), name, phone, phoneNormalized, capacity, area, source, emailed: false });
    stored = true;
  } catch (err) {
    console.error('[namadniroo] lead save failed:', err);
  }

  const emailed = await sendMail({ name, phone, capacity, area, source });

  // اگر ذخیره نشده ولی ایمیل رفته، رکورد را با وضعیت درست ثبت می‌کنیم
  if (!stored && emailed) {
    try {
      await saveLead({ createdAt: new Date().toISOString(), name, phone, phoneNormalized, capacity, area, source, emailed: true });
      stored = true;
    } catch { /* از قبل لاگ شده */ }
  }

  if (stored || emailed) return json({ success: true });
  return json({ success: false, message: 'ارسال با خطا مواجه شد' }, 500);
};

// هر متد دیگری روی این آدرس مجاز نیست
export const ALL: APIRoute = () => json({ success: false, message: 'Method not allowed' }, 405);
