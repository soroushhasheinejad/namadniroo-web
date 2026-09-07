import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { outbox } from '../db/schema';

/**
 * صف پیام‌های بیرونی.
 *
 * قبلاً ایمیل داخل خودِ درخواستِ فرم فرستاده می‌شد. دو اشکال داشت: کاربر تا
 * پایان گفت‌وگو با سرور SMTP منتظر می‌ماند، و اگر آن سرور از کار می‌افتاد
 * ایمیل برای همیشه از دست می‌رفت.
 *
 * حالا درخواست فقط یک ردیف در صف می‌گذارد و فوراً پاسخ می‌دهد؛ فرستادن کار
 * یک worker پس‌زمینه است که در صورت خطا با فاصلهٔ فزاینده دوباره تلاش
 * می‌کند.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

const MAX_ATTEMPTS = 6;

/** فاصلهٔ تلاش‌ها: ۱، ۵، ۲۵، ۱۲۵ دقیقه و… — سقف ۶ ساعت */
function backoffMs(attempts: number): number {
  return Math.min(60_000 * 5 ** (attempts - 1), 6 * 60 * 60_000);
}

/** پیام را در صف می‌گذارد. سریع است چون فقط یک insert می‌زند. */
export async function enqueueEmail(message: EmailMessage): Promise<void> {
  const db = await getDb();
  await db.insert(outbox).values({ kind: 'email', payload: message as never });
}

async function sendEmail(message: EmailMessage): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP پیکربندی نشده است');
  }

  const nodemailer = (await import('nodemailer')).default;
  const port = Number(SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transport.sendMail({
    to: message.to,
    from: MAIL_FROM || SMTP_USER,
    replyTo: message.replyTo || MAIL_FROM || SMTP_USER,
    subject: message.subject,
    text: message.text,
  });
}

/**
 * یک دور از صف را پردازش می‌کند و تعداد پیام‌های فرستاده‌شده را برمی‌گرداند.
 * جدا از worker هم قابل صدا زدن است — برای تست و برای دکمهٔ «تلاش دوباره».
 */
export async function processOutbox(limit = 10): Promise<number> {
  const db = await getDb();

  const due = await db
    .select()
    .from(outbox)
    .where(and(isNull(outbox.sentAt), lte(outbox.nextAttemptAt, new Date())))
    .orderBy(asc(outbox.nextAttemptAt))
    .limit(limit);

  let sent = 0;

  for (const row of due) {
    const attempts = row.attempts + 1;
    try {
      await sendEmail(row.payload as EmailMessage);
      await db
        .update(outbox)
        .set({ sentAt: new Date(), attempts, lastError: null })
        .where(eq(outbox.id, row.id));
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      /* بعد از چند تلاش ناموفق دیگر تلاش نمی‌کنیم، ولی ردیف را هم پاک
         نمی‌کنیم: باید در پنل دیده شود که چه چیزی نرفته و چرا. */
      const giveUp = attempts >= MAX_ATTEMPTS;
      await db
        .update(outbox)
        .set({
          attempts,
          lastError: message.slice(0, 500),
          nextAttemptAt: giveUp
            ? new Date(Date.now() + 365 * 24 * 60 * 60_000)
            : new Date(Date.now() + backoffMs(attempts)),
        })
        .where(eq(outbox.id, row.id));

      console.error(`[outbox] پیام ${row.id} ناموفق (تلاش ${attempts}):`, message);
    }
  }

  return sent;
}

export interface OutboxStatus {
  pending: number;
  failed: number;
  sentToday: number;
}

export async function outboxStatus(): Promise<OutboxStatus> {
  const db = await getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [[pending], [failed], [sentToday]] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)` })
      .from(outbox)
      .where(and(isNull(outbox.sentAt), sql`${outbox.attempts} < ${MAX_ATTEMPTS}`)),
    db
      .select({ value: sql<number>`count(*)` })
      .from(outbox)
      .where(and(isNull(outbox.sentAt), sql`${outbox.attempts} >= ${MAX_ATTEMPTS}`)),
    db
      .select({ value: sql<number>`count(*)` })
      .from(outbox)
      .where(sql`${outbox.sentAt} >= ${startOfDay}`),
  ]);

  return {
    pending: pending?.value ?? 0,
    failed: failed?.value ?? 0,
    sentToday: sentToday?.value ?? 0,
  };
}

/* ============================================================
   worker
   ============================================================ */

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * worker را روشن می‌کند.
 *
 * یک `setInterval` ساده کافی است چون اپ روی یک نمونه اجرا می‌شود و حجم
 * پیام‌ها کم است. اگر روزی چندنمونه‌ای شد، باید انتخاب ردیف‌ها با
 * `for update skip locked` قفل شود تا دو نمونه یک پیام را دوبار نفرستند.
 */
export function startOutboxWorker(intervalMs = 60_000): void {
  if (timer) return;

  const tick = () => {
    processOutbox().catch((err) => console.error('[outbox] دور پردازش ناموفق:', err));
  };

  timer = setInterval(tick, intervalMs);
  // مانع خاموش‌شدن تمیز پروسه نشود
  timer.unref?.();
  tick();
}

export function stopOutboxWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
