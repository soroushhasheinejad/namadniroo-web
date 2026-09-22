import { createLead, recentDuplicate } from '../repos/leads';
import { enqueueEmail } from './outbox';
import { getVisitor, lastTouch, linkVisitorToLead, trackEvent } from '../analytics/track';
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

export async function submitQuote(
  input: QuoteInput,
  visitor?: VisitorContext | null,
): Promise<QuoteResult> {
  /* ارسال دوباره در فاصلهٔ کوتاه رکورد تازه نمی‌سازد. از دید کاربر تفاوتی
     ندارد (پیام موفقیت را می‌بیند) ولی تیم فروش یک نفر را دو بار در فهرست
     نمی‌بیند. */
  const duplicate = await recentDuplicate(input.phoneNormalized);
  if (duplicate) {
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
    estimate: input.estimate ?? null,
    visitorId: visitor?.visitorId ?? null,
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
    trackEvent({
      visitorId: visitor.visitorId,
      sessionId: visitor.sessionId,
      type: 'lead_submit',
      path: input.source || null,
      props: { leadId: lead.id, area: input.area || '—' },
    });
  }

  /* اولین سطر خط زمانی پرونده. بدون آن، کارشناسی که فردا پرونده را باز
     می‌کند نمی‌داند این لید از کجا آمده — فقط یک شماره تلفن می‌بیند. */
  void logActivity({
    leadId: lead.id,
    kind: 'system',
    body:
      `درخواست از ${input.source || 'سایت'} ثبت شد` +
      (touch?.channel ? ` · کانال: ${channelLabel(touch.channel)}` : '') +
      (profile ? ` · ${profile.pageviews} بازدید پیش از این فرم` : ''),
  }).catch((err) => console.error('[quote] ثبت خط زمانی ناموفق:', err));

  /* لید ذخیره شده است؛ ایمیل فقط اطلاع‌رسانی است و اگر صف خطا بدهد نباید
     پاسخ فرم را خراب کند. */
  try {
    await enqueueEmail({
      to: process.env.MAIL_TO || 'sales@namadniroo.ir',
      subject: 'درخواست مشاورهٔ جدید از سایت نماد نیرو',
      text:
        `درخواست جدید از فرم سایت namadniroo.ir\n\n` +
        `نام و نام خانوادگی: ${input.name}\n` +
        `شمارهٔ تماس: ${input.phone}\n` +
        `ظرفیت موردنظر: ${input.capacity || '—'}\n` +
        `حوزهٔ درخواست: ${input.area || '—'}\n` +
        `راه تماس دلخواه: ${input.contactVia || 'تماس تلفنی'}\n` +
        `صفحهٔ مبدأ: ${input.source || '—'}\n` +
        (input.estimate ? `\nبرآوردی که کاربر دیده بود:\n${input.estimate}\n` : '') +
        (touch?.channel ? `کانال ورود: ${channelLabel(touch.channel)}\n` : '') +
        `\nپروندهٔ کامل و مسیر کاربر: https://namadniroo.ir/admin/leads/${lead.id}\n`,
    });
  } catch (err) {
    console.error('[quote] افزودن به صف ایمیل ناموفق بود:', err);
  }

  return { created: true, leadId: lead.id };
}
