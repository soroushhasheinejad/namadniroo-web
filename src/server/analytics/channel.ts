/**
 * تشخیص اینکه بازدیدکننده از کجا آمده.
 *
 * «کانال» یعنی همان چیزی که در گزارش به آن فکر می‌کنیم: گوگل، اینستاگرام،
 * تبلیغ، مراجعهٔ مستقیم. داده‌ای که برای رسیدن به آن داریم دو چیز است —
 * پارامترهای utm روی نشانی، و هدر `Referer` مرورگر — و هیچ‌کدام همیشه
 * وجود ندارند: کاربری که لینک را در واتساپ باز می‌کند اغلب ارجاع‌دهنده
 * ندارد و لینک اینستاگرام هم بدون utm کپی می‌شود.
 *
 * پس قاعده این است: اگر utm صریح بود، حرف آخر را می‌زند (چون خودمان
 * لینک را ساخته‌ایم)؛ وگرنه از روی دامنهٔ ارجاع‌دهنده حدس می‌زنیم؛ و اگر
 * هیچ‌کدام نبود «مستقیم» است — که در عمل یعنی «نمی‌دانیم»، و عمداً همین
 * را می‌نویسیم تا در گزارش با گوگل قاطی نشود.
 */

export type Channel =
  | 'direct'
  | 'organic'
  | 'paid'
  | 'social'
  | 'referral'
  | 'email'
  | 'sms'
  | 'internal';

export const CHANNEL_LABELS: Record<Channel, string> = {
  direct: 'مستقیم / نامشخص',
  organic: 'جست‌وجوی گوگل',
  paid: 'تبلیغات پولی',
  social: 'شبکه‌های اجتماعی',
  referral: 'ارجاع از سایت دیگر',
  email: 'ایمیل',
  sms: 'پیامک',
  internal: 'داخل سایت',
};

export const channelLabel = (value: string | null | undefined): string =>
  CHANNEL_LABELS[(value ?? 'direct') as Channel] ?? value ?? '—';

/** موتورهای جست‌وجو — ورود از این‌ها یعنی سئو کار کرده */
const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|ecosia|brave|baidu)\./i;

/** شبکه‌های اجتماعی و پیام‌رسان‌ها، با تمرکز بر آن‌هایی که در ایران واقعاً مبدأ ترافیک‌اند */
const SOCIAL =
  /(^|\.)(instagram|t\.me|telegram|whatsapp|wa\.me|linkedin|facebook|twitter|x\.com|aparat|youtube|youtu\.be|pinterest|bale\.ai|eitaa|rubika|virgool)\./i;

export interface Attribution {
  channel: Channel;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
}

const clip = (v: string | null | undefined, max = 120): string | null => {
  const s = (v ?? '').trim().replace(/[\r\n]+/g, ' ').slice(0, max);
  return s || null;
};

/**
 * کانال را از نشانی صفحه و ارجاع‌دهنده استخراج می‌کند.
 *
 * `siteHost` دامنهٔ خود سایت است: پیمایش داخلی نباید به‌عنوان «ارجاع از
 * سایت دیگر» ثبت شود، وگرنه هر کلیک روی منو یک بازدید ارجاعی می‌شد.
 */
export function attributionFrom(url: URL, referrer: string | null, siteHost: string): Attribution {
  const p = url.searchParams;
  const utmSource = clip(p.get('utm_source'));
  const utmMedium = clip(p.get('utm_medium'));
  const utmCampaign = clip(p.get('utm_campaign'));

  let refHost: string | null = null;
  let internal = false;
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase();
      internal = host === siteHost || host === `www.${siteHost}` || `www.${host}` === siteHost;
      refHost = internal ? null : host;
    } catch {
      /* ارجاع‌دهندهٔ بدشکل — نادیده */
    }
  }

  const channel = ((): Channel => {
    /* شناسهٔ کلیک گوگل ادز، حتی بدون utm، یعنی تبلیغ پولی — و در عمل اغلب
       لینک تبلیغ بدون utm ساخته می‌شود و فقط همین می‌ماند.
       `fbclid` اینجا نیست: متا آن را روی هر لینکی می‌گذارد، چه تبلیغ باشد
       چه پست عادی؛ پس نشانهٔ «اجتماعی» است نه «پولی». */
    if (p.has('gclid') || p.has('yclid')) return 'paid';
    if (p.has('fbclid') && !utmMedium && !utmSource) return 'social';
    if (utmMedium) {
      if (/^(cpc|ppc|paid|display|banner|cpm|retargeting)$/i.test(utmMedium)) return 'paid';
      if (/^(email|newsletter)$/i.test(utmMedium)) return 'email';
      if (/^(sms|text)$/i.test(utmMedium)) return 'sms';
      if (/^(social|stories|bio|post)$/i.test(utmMedium)) return 'social';
      if (/^(organic|seo)$/i.test(utmMedium)) return 'organic';
      if (/^(referral|partner)$/i.test(utmMedium)) return 'referral';
    }
    if (utmSource) {
      if (SOCIAL.test(`${utmSource}.`)) return 'social';
      if (/^(google|bing)$/i.test(utmSource)) return 'paid';
      return 'referral';
    }
    if (internal) return 'internal';
    if (refHost) {
      if (SEARCH.test(`.${refHost}`)) return 'organic';
      if (SOCIAL.test(`.${refHost}`)) return 'social';
      return 'referral';
    }
    return 'direct';
  })();

  return { channel, utmSource, utmMedium, utmCampaign, referrer: clip(referrer, 200) };
}

/**
 * نام خوانای مبدأ برای نمایش در فهرست‌ها: «اینستاگرام» به‌جای
 * «l.instagram.com». وقتی کانال چیزی جز خودش توضیح نمی‌دهد (مثل «ارجاع از
 * سایت دیگر») همین نام است که به کار می‌آید.
 */
export function sourceLabel(a: Pick<Attribution, 'utmSource' | 'referrer' | 'channel'>): string {
  if (a.utmSource) return a.utmSource;
  if (a.referrer) {
    try {
      return new URL(a.referrer).hostname.replace(/^www\./, '');
    } catch {
      return a.referrer;
    }
  }
  return channelLabel(a.channel);
}

export type Device = 'mobile' | 'desktop' | 'tablet';

/**
 * دستگاه از روی User-Agent.
 *
 * دقت صددرصدی ممکن نیست و لازم هم نیست؛ تنها تصمیمی که با این عدد گرفته
 * می‌شود این است که روی کدام نسخه از صفحه وقت بگذاریم.
 */
export function deviceFrom(ua: string | null): Device {
  const s = ua ?? '';
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(s)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(s)) return 'mobile';
  return 'desktop';
}

/**
 * ربات‌ها ثبت نمی‌شوند.
 *
 * بدون این فیلتر، خزندهٔ گوگل و ابزارهای پایش، بخش بزرگی از «بازدید» را
 * می‌سازند و هر نرخ تبدیلی را به‌اشتباه پایین نشان می‌دهند. معیار سخت‌گیرانه
 * است: هر چیزی که شبیه ربات باشد کنار گذاشته می‌شود، چون از دست دادن چند
 * بازدید واقعی بهتر از آلوده‌شدن کل گزارش است.
 */
const BOT =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|go-http|java\/|scrapy|semrush|ahrefs|mj12|dotbot|petalbot|yandexbot|applebot|ia_archiver|preview|embed/i;

export function isBot(ua: string | null): boolean {
  // نبودِ User-Agent خودش نشانهٔ درخواست غیرمرورگری است
  if (!ua || ua.length < 12) return true;
  return BOT.test(ua);
}
