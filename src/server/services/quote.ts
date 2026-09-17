import { createLead, recentDuplicate } from '../repos/leads';
import { enqueueEmail } from './outbox';
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

export async function submitQuote(input: QuoteInput): Promise<QuoteResult> {
  /* ارسال دوباره در فاصلهٔ کوتاه رکورد تازه نمی‌سازد. از دید کاربر تفاوتی
     ندارد (پیام موفقیت را می‌بیند) ولی تیم فروش یک نفر را دو بار در فهرست
     نمی‌بیند. */
  const duplicate = await recentDuplicate(input.phoneNormalized);
  if (duplicate) {
    return { created: false, leadId: duplicate.id };
  }

  const lead = await createLead({
    name: input.name,
    phone: input.phone,
    phoneNormalized: input.phoneNormalized,
    capacity: input.capacity || null,
    area: input.area || null,
    source: input.source || null,
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    estimate: input.estimate ?? null,
  });

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
        `صفحهٔ مبدأ: ${input.source || '—'}\n` +
        (input.estimate ? `\nبرآوردی که کاربر دیده بود:\n${input.estimate}\n` : '') +
        `\nمشاهده در پنل: https://namadniroo.ir/admin/leads\n`,
    });
  } catch (err) {
    console.error('[quote] افزودن به صف ایمیل ناموفق بود:', err);
  }

  return { created: true, leadId: lead.id };
}
