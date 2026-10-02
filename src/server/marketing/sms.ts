/**
 * ارسال پیامک.
 *
 * سرویس‌دهنده پشت یک رابط کوچک پنهان است. دلیلش فقط تمیزی کد نیست:
 * قرارداد پنل پیامکی در ایران عوض می‌شود و نباید آن روز، نیمی از
 * اتوماسیون بازنویسی شود. امروز مدیانا است و اگر فردا چیز دیگری شد، فقط
 * یک تابع تازه اینجا اضافه می‌شود.
 *
 * تا وقتی کلید تنظیم نشده، `configured` دروغ است و هیچ‌چیز ارسال نمی‌شود —
 * پیام‌ها در صف می‌مانند و در پنل با دلیل روشن دیده می‌شوند، نه اینکه
 * بی‌صدا گم شوند.
 */

export interface SmsResult {
  /** شناسهٔ پیام نزد سرویس‌دهنده، برای پیگیری تحویل */
  providerId: string | null;
}

export interface SmsProvider {
  name: string;
  configured: boolean;
  send(to: string, body: string): Promise<SmsResult>;
}

/* ============================================================
   مدیانا
   ============================================================ */

const MEDIANA_URL = 'https://api.mediana.ir/sms/v1/send';

/**
 * شمارهٔ ایرانی را به شکلی که سرویس‌دهنده می‌پذیرد در می‌آورد.
 *
 * شماره‌های ما به شکل `+98912…` ذخیره می‌شوند؛ پنل‌های داخلی معمولاً
 * `0912…` می‌خواهند.
 */
export function localPhone(phoneNormalized: string): string {
  return phoneNormalized.startsWith('+98')
    ? `0${phoneNormalized.slice(3)}`
    : phoneNormalized.replace(/^\+/, '');
}

function mediana(): SmsProvider {
  const { MEDIANA_API_KEY, MEDIANA_SENDER } = process.env;

  return {
    name: 'mediana',
    configured: Boolean(MEDIANA_API_KEY && MEDIANA_SENDER),

    async send(to, body) {
      if (!MEDIANA_API_KEY || !MEDIANA_SENDER) {
        throw new Error('کلید مدیانا تنظیم نشده است');
      }

      /* مهلت زمانی لازم است: بدون آن، یک درخواست معلق می‌تواند کل دور
         پردازش صف را نگه دارد. */
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);

      try {
        const res = await fetch(MEDIANA_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MEDIANA_API_KEY}`,
          },
          body: JSON.stringify({
            sender: MEDIANA_SENDER,
            recipients: [localPhone(to)],
            message: body,
          }),
        });

        const text = await res.text();
        if (!res.ok) {
          /* متن خطای سرویس‌دهنده در پیام می‌آید تا در پنل معلوم باشد چرا
             نرفت — «خطای ۴۰۰» به‌تنهایی هیچ‌کس را جلو نمی‌برد. */
          throw new Error(`مدیانا ${res.status}: ${text.slice(0, 200)}`);
        }

        let providerId: string | null = null;
        try {
          const json = JSON.parse(text) as { messageId?: string; id?: string; data?: { messageId?: string } };
          providerId = json.messageId ?? json.id ?? json.data?.messageId ?? null;
        } catch {
          // پاسخ غیر JSON: ارسال انجام شده ولی شناسه‌ای برای پیگیری نداریم
        }
        return { providerId };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function smsProvider(): SmsProvider {
  return mediana();
}

/* ============================================================
   اندازهٔ پیام
   ============================================================ */

/* پیامک فارسی در هر بخش ۷۰ نویسه جا می‌دهد و از بخش دوم به بعد ۶۷ —
   چون سرآیند پیوستن، خودش جا می‌گیرد. */
const UNICODE_SINGLE = 70;
const UNICODE_MULTI = 67;

export interface SmsSize {
  chars: number;
  parts: number;
}

/** تعداد نویسه و بخش پیامک — همان عددی که هزینه از رویش حساب می‌شود */
export function smsSize(body: string): SmsSize {
  const chars = [...body].length;
  if (chars === 0) return { chars: 0, parts: 0 };
  if (chars <= UNICODE_SINGLE) return { chars, parts: 1 };
  return { chars, parts: Math.ceil(chars / UNICODE_MULTI) };
}
