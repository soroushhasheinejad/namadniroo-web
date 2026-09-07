/**
 * نرمال‌سازی شمارهٔ تماس ایران.
 *
 * کاربران شماره را به شکل‌های گوناگون وارد می‌کنند: با ارقام فارسی، با خط
 * تیره یا فاصله، با ۰۰۹۸ یا +۹۸ یا بدون صفر. اگر همان‌طور که آمده ذخیره
 * شود، دو رکورد از یک نفر شبیه دو نفر متفاوت به نظر می‌رسند و تشخیص تکراری
 * ناممکن می‌شود. پس یک شکل یکتا برای مقایسه نگه می‌داریم و شکل واردشده را
 * هم دست‌نخورده کنار آن حفظ می‌کنیم.
 */

/** ارقام فارسی و عربی را به لاتین برمی‌گرداند. */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * شکل یکتای شماره را برمی‌گرداند، یا اگر شمارهٔ معتبر ایران نبود null.
 *
 * موبایل  → `+989xxxxxxxxx`
 * ثابت    → `+98xxxxxxxxxx` (با کد شهر، بدون صفر ابتدایی)
 */
export function normalizePhone(raw: string): string | null {
  let s = toLatinDigits(raw).replace(/[\s\-()._]/g, '');

  if (s.startsWith('+98')) s = s.slice(3);
  else if (s.startsWith('0098')) s = s.slice(4);
  else if (s.startsWith('98') && s.length > 10) s = s.slice(2);
  else if (s.startsWith('0')) s = s.slice(1);

  if (!/^\d+$/.test(s)) return null;

  // موبایل: 9 و بعد ۹ رقم | ثابت: کد شهر ۲ رقمی (به جز ۹) و بعد ۸ رقم
  const isMobile = /^9\d{9}$/.test(s);
  const isLandline = /^[1-8]\d{9}$/.test(s);
  if (!isMobile && !isLandline) return null;

  return `+98${s}`;
}

/** فقط برای نمایش: `+989121234567` → `۰۹۱۲۱۲۳۴۵۶۷` */
export function displayPhone(normalized: string): string {
  const local = normalized.startsWith('+98') ? '0' + normalized.slice(3) : normalized;
  return local.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}
