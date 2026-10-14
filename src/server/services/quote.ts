import { createLead, recentDuplicate } from '../repos/leads';
import { enqueueEmail } from './outbox';
import {
  currentSessionId,
  getVisitor,
  lastTouch,
  linkVisitorToLead,
  trackEvent,
} from '../analytics/track';
import { channelLabel } from '../analytics/channel';
import { logActivity } from '../repos/leadActivity';
import type { QuoteInput } from '../validation/quote';

/**
 * ثبت درخواست مشاوره.
 *
 * منطق کسب‌وکار اینجاست نه در مسیر API، تا مسیر فقط کار خودش را بکند
 * (خواندن بدنه و ساختن پاسخ) و این بخش بدون HTTP قابل تست باشد.
 */

export interface QuoteResult {
  /** لید تازه ثبت شد یا تکراری بود و نادیده گرفته شد */
  created: boolean;
  leadId: number;
}

/**
 * شناسهٔ بازدیدکننده‌ای که فرم را فرستاده، از کوکی درخواست.
 *
 * اختیاری است: اگر مرورگر کوکی نگیرد، لید همچنان ثبت می‌شود و فقط مسیرش
 * را نداریم. هیچ‌وقت نباید ثبت درخواست به ردیابی گره بخورد.
 */
export interface VisitorContext {
  visitorId: string;
  sessionId: string;
}

/* اولین سطر خط زمانی بسته به اینکه کاربر از برآورد چه خواسته بود */
const REQUEST_LABEL: Record<string, string> = {
  review: 'درخواست بررسی برآورد با کارشناس',
  pdf: 'دریافت برگهٔ برآورد',
};

/**
 * متنی که در ستون `estimate` می‌نشیند: خلاصهٔ برآورد و پس از آن پاسخ‌های
 * کوتاه کاربر. هر دو را خود کاربر داده، پس جایشان کنار هم است و نه در
 * یادداشت‌های تیم فروش. جداکننده خط تازه نیست، چون این ستون در خروجی CSV
 * و فایل اکسل فروش هم می‌رود.
 */
function estimateText(input: QuoteInput): string | null {
  return [input.estimate, input.qualifiers].filter(Boolean).join(' — ') || null;
}

async function noteReviewUpgrade(leadId: number, input: QuoteInput): Promise<void> {
  try {
    await logActivity({
      leadId,
      kind: 'system',
      body:
        `بعد از گرفتن برگهٔ برآورد، بررسی با کارشناس را هم خواست (${input.source || 'سایت'})` +
        (input.qualifiers ? ` · ${input.qualifiers}` : '') +
        (input.estimate ? ` · ${input.estimate}` : ''),
    });
  } catch (err) {
    console.error('[quote] ثبت درخواست بررسی روی پروندهٔ موجود ناموفق:', err);
  }
  try {
    await enqueueEmail({
      to: process.env.MAIL_TO || 'sales@namadniroo.ir',
      subject: 'درخواست بررسی برآورد با کارشناس — سایت نماد نیرو',
      text:
        `${input.name} (${input.phone}) که چند دقیقه پیش برگهٔ برآورد را گرفته بود، حالا بررسی با کارشناس را هم خواسته است.\n\n` +
        (input.estimate ? `برآوردی که دیده بود:\n${input.estimate}\n` : '') +
        (input.qualifiers ? `پاسخ‌های کاربر: ${input.qualifiers}\n` : '') +
        `\nپرونده: https://namadniroo.ir/admin/leads/${leadId}\n`,
    });
  } catch (err) {
    console.error('[quote] افزودن به صف ایمیل ناموفق بود:', err);
  }
}

export async function submitQuote(
  input: QuoteInput,
  visitor?: VisitorContext | null,
): Promise<QuoteResult> {
  /* ارسال دوباره در فاصلهٔ کوتاه رکورد تازه نمی‌سازد. از دید کاربر تفاوتی
     ندارد (پیام موفقیت را می‌بیند) ولی تیم فروش یک نفر را دو بار در فهرست
     نمی‌بیند. */
  const duplicate = await recentDuplicate(input.phoneNormalized);
  if (duplicate) {
    /* یک استثنا: کسی که اول برگهٔ برآورد را گرفته و بعد بررسی با کارشناس
       را هم خواسته، گرم‌تر شده است. رکورد تازه نمی‌سازیم، ولی پرونده و
       تیم فروش باید بدانند — وگرنه این درخواست بی‌صدا گم می‌شد. */
    if (input.intent === 'review') await noteReviewUpgrade(duplicate.id, input);
    return { created: false, leadId: duplicate.id };
  }

  /* مسیر کاربر پیش از فرم: اولین برخوردش از پروندهٔ بازدیدکننده و آخرین
     مبدأش از رویدادها. این دو با هم چیزی را می‌گویند که خود فرم هرگز
     نمی‌گوید — این آدم از کجا ما را شناخت و چه چیزی او را برگرداند.
     خطای این بخش نباید ثبت لید را خراب کند، پس هر کدام جداگانه مهار
     می‌شود. */
  const [profile, touch] = visitor
    ? await Promise.all([
        getVisitor(visitor.visitorId).catch(() => null),
        lastTouch(visitor.visitorId).catch(() => null),
      ])
    : [null, null];

  const lead = await createLead({
    name: input.name,
    phone: input.phone,
    phoneNormalized: input.phoneNormalized,
    capacity: input.capacity || null,
    area: input.area || null,
    contactVia: input.contactVia || null,
    source: input.source || null,
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    estimate: estimateText(input),
    visitorId: visitor?.visitorId ?? null,
    gaClientId: input.gaClientId ?? null,
    /* utm فرستاده‌شده از مرورگر فقط وقتی استفاده می‌شود که رویدادی در کار
       نباشد؛ سرور بهتر از خود صفحه می‌داند کاربر از کجا آمده. */
    channel: touch?.channel ?? null,
    firstChannel: profile?.firstChannel ?? touch?.channel ?? null,
    firstUtmSource: profile?.firstUtmSource ?? null,
    firstUtmMedium: profile?.firstUtmMedium ?? null,
    firstUtmCampaign: profile?.firstUtmCampaign ?? null,
    firstReferrer: profile?.firstReferrer ?? null,
    landingPage: profile?.firstLanding ?? null,
  });

  if (visitor) {
    /* از اینجا به بعد، پروندهٔ فروش و مسیر رفتاری یک چیزند. */
    void linkVisitorToLead(visitor.visitorId, lead.id).catch((err) =>
      console.error('[quote] اتصال بازدیدکننده به لید ناموفق:', err),
    );
    /* رویداد ثبت لید باید مبدأ را با خودش ببرد، وگرنه در گزارش‌ها زیر
       «ثبت‌نشده» می‌افتد و معلوم نمی‌شود کدام کانال مشتری ساخته — همان
       چیزی که تمام ۳۵۲ لید اول دچارش بودند. مبدأ از رویدادهای خود
       بازدیدکننده می‌آید، نه از نشانی فرم که دیگر utm ندارد. */
    void (async () => {
      const [session, lastSeenTouch] = await Promise.all([
        currentSessionId(visitor.visitorId).catch(() => null),
        touch ? Promise.resolve(touch) : lastTouch(visitor.visitorId).catch(() => null),
      ]);

      trackEvent({
        visitorId: visitor.visitorId,
        /* نشست واقعی‌اش، و فقط اگر پیدا نشد همان چیزی که کوکی می‌گفت */
        sessionId: session ?? visitor.sessionId,
        type: 'lead_submit',
        path: input.source || null,
        attribution: lastSeenTouch
          ? {
              channel: lastSeenTouch.channel as never,
              utmSource: lastSeenTouch.utmSource,
              utmMedium: lastSeenTouch.utmMedium,
              utmCampaign: lastSeenTouch.utmCampaign,
              utmTerm: null,
              utmContent: null,
              referrer: null,
            }
          : undefined,
        props: { leadId: lead.id, area: input.area || '—', ...(input.intent ? { intent: input.intent } : {}) },
      });
    })().catch((err) => console.error('[quote] ثبت رویداد لید ناموفق:', err));
  }

  /* اولین سطر خط زمانی پرونده. بدون آن، کارشناسی که فردا پرونده را باز
     می‌کند نمی‌داند این لید از کجا آمده — فقط یک شماره تلفن می‌بیند. */
  void logActivity({
    leadId: lead.id,
    kind: 'system',
    body:
      `${REQUEST_LABEL[input.intent ?? ''] ?? 'درخواست'} از ${input.source || 'سایت'} ثبت شد` +
      (touch?.channel ? ` · کانال: ${channelLabel(touch.channel)}` : '') +
      (profile ? ` · ${profile.pageviews} بازدید پیش از این فرم` : ''),
  }).catch((err) => console.error('[quote] ثبت خط زمانی ناموفق:', err));

  /* لید ذخیره شده است؛ ایمیل فقط اطلاع‌رسانی است و اگر صف خطا بدهد نباید
     پاسخ فرم را خراب کند. */
  try {
    await enqueueEmail({
      to: process.env.MAIL_TO || 'sales@namadniroo.ir',
      subject:
        input.intent === 'review'
          ? 'درخواست بررسی برآورد با کارشناس — سایت نماد نیرو'
          : 'درخواست مشاورهٔ جدید از سایت نماد نیرو',
      text:
        `درخواست جدید از فرم سایت namadniroo.ir\n\n` +
        (input.intent === 'review'
          ? `این شخص می‌خواهد برآورد ماشین‌حساب را با کارشناس مرور کند؛ با همین عددها تماس بگیرید.\n\n`
          : '') +
        `نام و نام خانوادگی: ${input.name}\n` +
        `شمارهٔ تماس: ${input.phone}\n` +
        `ظرفیت موردنظر: ${input.capacity || '—'}\n` +
        `حوزهٔ درخواست: ${input.area || '—'}\n` +
        `راه تماس دلخواه: ${input.contactVia || 'تماس تلفنی'}\n` +
        `صفحهٔ مبدأ: ${input.source || '—'}\n` +
        (input.estimate ? `\nبرآوردی که کاربر دیده بود:\n${input.estimate}\n` : '') +
        (input.qualifiers ? `پاسخ‌های کاربر: ${input.qualifiers}\n` : '') +
        (touch?.channel ? `کانال ورود: ${channelLabel(touch.channel)}\n` : '') +
        `\nپروندهٔ کامل و مسیر کاربر: https://namadniroo.ir/admin/leads/${lead.id}\n`,
    });
  } catch (err) {
    console.error('[quote] افزودن به صف ایمیل ناموفق بود:', err);
  }

  return { created: true, leadId: lead.id };
}
