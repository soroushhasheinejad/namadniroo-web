import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { leadActivity, leads } from '../db/schema';
import { logActivity } from '../repos/leadActivity';
import { enqueueEmail } from './outbox';
import { displayPhone } from '../../lib/phone';

/**
 * هشدارهای پیگیری — نقطهٔ شروع اتوماسیون.
 *
 * منطقش عمداً همین شکل است و نه یک موتور قاعده‌محور عمومی: تا وقتی سه تا
 * قاعده داریم، سه تابع خوانا بهتر از موتوری است که باید پیکربندی شود.
 * وقتی قاعده‌ها ده تا شدند، همین‌ها الگوی آن موتور می‌شوند.
 *
 * هر هشدار پس از ارسال در خط زمانی همان پرونده ثبت می‌شود. دلیلش فقط
 * گزارش نیست: همان ردیف، نشانهٔ «این هشدار قبلاً رفته» است و جلوی تکرار
 * شدنش در هر دور پس‌زمینه را می‌گیرد.
 */

/** لیدی که این‌قدر ساعت بی‌تماس بماند، هشدار می‌گیرد */
const UNTOUCHED_HOURS = 6;

const MARK = {
  untouched: 'هشدار: این درخواست پیگیری نشده بود',
  followUp: 'یادآوری: قرار پیگیری سررسید شد',
} as const;

const mailTo = () => process.env.MAIL_TO || 'sales@namadniroo.ir';

/** آیا این هشدار قبلاً برای این پرونده فرستاده شده؟ */
async function alreadyAlerted(leadId: number, mark: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: leadActivity.id })
    .from(leadActivity)
    .where(
      and(
        eq(leadActivity.leadId, leadId),
        eq(leadActivity.kind, 'system'),
        sql`${leadActivity.body} like ${mark + '%'}`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

const contactLine = (lead: { name: string; phone: string; phoneNormalized: string | null }) =>
  `${lead.name} — ${lead.phoneNormalized ? displayPhone(lead.phoneNormalized) : lead.phone}`;

/**
 * درخواست‌هایی که چند ساعت است بی‌پاسخ مانده‌اند.
 *
 * تنها عددی که در فروشِ لیدِ وب واقعاً تعیین‌کننده است همین است: کسی که
 * فرم پر کرده، همان روز دارد از چند جا قیمت می‌گیرد. هشدار فقط برای
 * پرونده‌های «جدید» می‌رود — به محض اینکه وضعیت عوض شود، یعنی کسی
 * سراغش رفته.
 */
async function untouchedLeads(): Promise<number> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - UNTOUCHED_HOURS * 3_600_000);

  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.status, 'new'), isNull(leads.firstContactAt), lt(leads.createdAt, cutoff)))
    .limit(20);

  let sent = 0;
  for (const lead of rows) {
    if (await alreadyAlerted(lead.id, MARK.untouched)) continue;

    const hours = Math.round((Date.now() - lead.createdAt.getTime()) / 3_600_000);
    await enqueueEmail({
      to: mailTo(),
      subject: `درخواست پیگیری‌نشده — ${lead.name}`,
      text:
        `این درخواست ${hours} ساعت است که ثبت شده و هنوز وضعیتش «جدید» است.\n\n` +
        `${contactLine(lead)}\n` +
        `حوزه: ${lead.area || '—'} · ظرفیت: ${lead.capacity || '—'}\n\n` +
        `پرونده: https://namadniroo.ir/admin/leads/${lead.id}\n`,
    });
    await logActivity({ leadId: lead.id, kind: 'system', body: `${MARK.untouched} (${hours} ساعت)` });
    sent++;
  }

  return sent;
}

/**
 * قرارهای پیگیری که سررسید شده‌اند.
 *
 * بر خلاف هشدار بالا، این یکی را خود کارشناس تنظیم کرده؛ پس یادآوری است
 * نه اخطار، و در یک ایمیل جمع‌بندی می‌رود تا صندوق ورودی شلوغ نشود.
 */
async function dueFollowUps(): Promise<number> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(leads)
    .where(and(lt(leads.nextFollowUpAt, new Date()), sql`${leads.status} in ('new','contacted')`))
    .limit(30);

  const pending = [];
  for (const lead of rows) {
    const mark = `${MARK.followUp} ${lead.nextFollowUpAt?.toISOString().slice(0, 10)}`;
    if (await alreadyAlerted(lead.id, mark)) continue;
    pending.push({ lead, mark });
  }

  if (pending.length === 0) return 0;

  await enqueueEmail({
    to: mailTo(),
    subject: `${pending.length} قرار پیگیری سررسید شده`,
    text:
      `این پرونده‌ها قرار پیگیری‌شان رسیده است:\n\n` +
      pending
        .map(
          ({ lead }) =>
            `• ${contactLine(lead)} — https://namadniroo.ir/admin/leads/${lead.id}` +
            (lead.notes ? `\n  یادداشت: ${lead.notes.slice(0, 120)}` : ''),
        )
        .join('\n') +
      `\n`,
  });

  for (const { lead, mark } of pending) {
    await logActivity({ leadId: lead.id, kind: 'system', body: mark });
  }

  return pending.length;
}

/** همهٔ هشدارها — از worker آمار صدا زده می‌شود */
export async function runAlerts(): Promise<void> {
  try {
    const [untouched, due] = [await untouchedLeads(), await dueFollowUps()];
    if (untouched || due) {
      console.log(`[alerts] ${untouched} هشدار پیگیری‌نشده، ${due} یادآوری قرار`);
    }
  } catch (err) {
    console.error('[alerts] اجرای هشدارها ناموفق:', err);
  }
}
