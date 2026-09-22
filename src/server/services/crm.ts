import { getLead, updateLead, type LeadPatch } from '../repos/leads';
import { logActivity } from '../repos/leadActivity';
import type { ActivityKind, Lead, LeadStatus } from '../db/schema';

/**
 * تغییرات پروندهٔ فروش.
 *
 * چرا یک لایهٔ جدا و نه مستقیم `updateLead`؟ چون چند چیز باید خودکار اتفاق
 * بیفتد و اگر به یادِ کاربر پنل سپرده شود، در عمل نمی‌افتد:
 *
 * - **زمان اولین تماس** باید دقیقاً یک بار، هنگام خروج از وضعیت «جدید»،
 *   ثبت شود. سرعت پاسخ مهم‌ترین عددی است که روی نرخ بستن اثر دارد و اگر
 *   دستی وارد شود هیچ‌وقت درست نیست.
 * - **زمان بسته‌شدن** هنگام رسیدن به «برنده» یا «بازنده» — مبنای محاسبهٔ
 *   طول چرخهٔ فروش.
 * - **هر تغییر وضعیت** باید در خط زمانی بماند، وگرنه معلوم نیست پرونده‌ای
 *   که امروز «بازنده» است، دیروز کجا بود.
 */

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'جدید',
  contacted: 'در حال پیگیری',
  won: 'قرارداد بسته شد',
  lost: 'از دست رفت',
};

/**
 * دلایل ازدست‌رفتن، از فهرست بسته.
 *
 * متن آزاد بود، هیچ‌وقت نمی‌شد گروه‌بندی‌اش کرد و گزارش «چرا می‌بازیم»
 * ساخته نمی‌شد. همین چند گزینه تقریباً همهٔ حالت‌های واقعی را پوشش
 * می‌دهد و جزئیاتش در یادداشت می‌آید.
 */
export const LOST_REASONS = [
  'قیمت',
  'زمان‌بندی نساخت',
  'رقیب',
  'بودجه نداشت',
  'پاسخ نداد',
  'فقط کنجکاو بود',
  'خارج از محدودهٔ ما',
  'سایر',
] as const;

export interface LeadUpdate {
  id: number;
  userId?: number | null;
  patch: LeadPatch;
  /** یادداشت یا گزارش تماسی که همراه این تغییر ثبت می‌شود */
  activity?: { kind: ActivityKind; body: string } | null;
}

/**
 * مهرهای زمانی خودکار را روی تغییر می‌نشاند.
 *
 * جدا از `applyLeadUpdate` است تا بدون دیتابیس قابل تست باشد؛ همهٔ قاعده‌هایی
 * که اشتباهشان گزارش را خراب می‌کند همین‌جاست.
 */
export function stampPatch(
  before: Pick<Lead, 'status' | 'firstContactAt' | 'closedAt'>,
  input: LeadPatch,
  now = new Date(),
): LeadPatch {
  const patch: LeadPatch = { ...input };
  const status = patch.status ?? before.status;

  /* اولین خروج از «جدید» یعنی کسی بالاخره تماس گرفت. اگر قبلاً ثبت شده
     باشد دست نمی‌خورد — «اولین» فقط یک بار اتفاق می‌افتد. */
  if (!before.firstContactAt && status !== 'new') {
    patch.firstContactAt = now;
  }

  const closed = status === 'won' || status === 'lost';

  if (closed && !before.closedAt) patch.closedAt = now;
  /* بازگشایی پرونده: اگر از حالت بسته بیرون آمد، زمان بسته‌شدن معنایش را
     از دست می‌دهد و باید پاک شود، وگرنه طول چرخهٔ فروش غلط حساب می‌شود. */
  if (!closed && before.closedAt) patch.closedAt = null;

  /* دلیل باخت فقط برای پروندهٔ باخته معنا دارد */
  if (status !== 'lost') patch.lostReason = null;

  /* قراری که پرونده‌اش بسته شده، یادآوری بی‌مورد است */
  if (closed) patch.nextFollowUpAt = null;

  return patch;
}

export async function applyLeadUpdate(update: LeadUpdate): Promise<Lead | null> {
  const before = await getLead(update.id);
  if (!before) return null;

  const patch = stampPatch(before, update.patch);

  await updateLead(update.id, patch);

  if (patch.status && patch.status !== before.status) {
    await logActivity({
      leadId: update.id,
      userId: update.userId,
      kind: 'status',
      statusFrom: before.status,
      statusTo: patch.status,
      body:
        patch.status === 'lost' && patch.lostReason
          ? `دلیل: ${patch.lostReason}`
          : patch.status === 'won' && patch.dealValue
            ? `مبلغ قرارداد: ${patch.dealValue.toLocaleString('en-US')} تومان`
            : null,
    });
  }

  if (update.activity?.body?.trim()) {
    await logActivity({
      leadId: update.id,
      userId: update.userId,
      kind: update.activity.kind,
      body: update.activity.body,
    });
  }

  return getLead(update.id);
}

/**
 * سرعت پاسخ به یک لید، به ساعت.
 *
 * `null` یعنی هنوز هیچ‌کس تماس نگرفته — که خودش مهم‌ترین حالت است و نباید
 * با «صفر ساعت» اشتباه شود.
 */
export function responseHours(lead: Pick<Lead, 'createdAt' | 'firstContactAt'>): number | null {
  if (!lead.firstContactAt) return null;
  return (lead.firstContactAt.getTime() - lead.createdAt.getTime()) / 3_600_000;
}
