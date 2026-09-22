import { and, count, desc, eq, gte, isNotNull, like, lte, or, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { leads, users, type Lead, type LeadStatus, type NewLead } from '../db/schema';
import { normalizePhone } from '../../lib/phone';

/**
 * دسترسی به لیدها.
 *
 * نسخهٔ قبلی همهٔ رکوردها را از یک فایل می‌خواند، پارس می‌کرد و در حافظه
 * برعکس می‌کرد. با چند هزار رکورد، هر بار باز کردن پنل کل داده را می‌خواند.
 * اینجا مرتب‌سازی، فیلتر و صفحه‌بندی کار دیتابیس است و فقط یک صفحه منتقل
 * می‌شود.
 *
 * لیدها کش نمی‌شوند: داده‌ای است که تیم فروش لحظه‌به‌لحظه عوض می‌کند و
 * دیدن نسخهٔ کهنه در آن بدتر از یک کوئری اضافه است.
 */

export interface LeadQuery {
  page?: number;
  perPage?: number;
  status?: LeadStatus | 'all';
  /** جست‌وجو در نام و شمارهٔ تماس */
  q?: string;
  /** فقط پرونده‌هایی که قرار پیگیری‌شان رسیده یا گذشته است */
  due?: boolean;
  /** فقط پرونده‌های یک کارشناس */
  assignedTo?: number;
}

export interface LeadPage {
  rows: Lead[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

const PER_PAGE = 50;

function buildFilter(query: LeadQuery) {
  const clauses = [];

  if (query.status && query.status !== 'all') {
    clauses.push(eq(leads.status, query.status));
  }

  if (query.q?.trim()) {
    const raw = query.q.trim();
    const term = `%${raw}%`;
    // در SQLite، LIKE برای حروف لاتین به بزرگی و کوچکی حساس نیست
    const matches = [like(leads.name, term), like(leads.phone, term)];

    /* شماره‌ها به همان شکلی ذخیره می‌شوند که کاربر تایپ کرده — که اغلب با
       ارقام فارسی است. پس جست‌وجوی «۰۹۱۲…» با تایپ لاتین هیچ‌وقت نتیجه
       نمی‌داد. اگر عبارت جست‌وجو شمارهٔ معتبری باشد، شکل یکتای آن هم
       بررسی می‌شود و هر دو نگارش پیدا می‌شوند. */
    const normalized = normalizePhone(raw);
    if (normalized) matches.push(eq(leads.phoneNormalized, normalized));
    else matches.push(like(leads.phoneNormalized, term));

    clauses.push(or(...matches));
  }

  /* «سررسید» یعنی قراری ثبت شده و زمانش رسیده — پرونده‌های بی‌قرار اینجا
     نمی‌آیند، چون چیزی برای یادآوری ندارند. */
  if (query.due) {
    clauses.push(and(isNotNull(leads.nextFollowUpAt), lte(leads.nextFollowUpAt, new Date()))!);
  }

  if (query.assignedTo) {
    clauses.push(eq(leads.assignedTo, query.assignedTo));
  }

  return clauses.length ? and(...clauses) : undefined;
}

export async function listLeads(query: LeadQuery = {}): Promise<LeadPage> {
  const db = await getDb();
  const perPage = Math.min(Math.max(query.perPage ?? PER_PAGE, 1), 200);
  const page = Math.max(query.page ?? 1, 1);
  const where = buildFilter(query);

  /* شمارش و خواندن صفحه با هم اجرا می‌شوند، نه پشت سر هم — دو کوئری مستقل
     که هیچ‌کدام منتظر دیگری نیست. */
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(desc(leads.createdAt), desc(leads.id))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ value: count() }).from(leads).where(where),
  ]);

  const total = totals?.value ?? 0;
  return { rows, total, page, perPage, pages: Math.max(Math.ceil(total / perPage), 1) };
}

/** همهٔ لیدها بدون صفحه‌بندی — فقط برای خروجی CSV */
export async function allLeads(query: LeadQuery = {}): Promise<Lead[]> {
  const db = await getDb();
  return db.select().from(leads).where(buildFilter(query)).orderBy(desc(leads.createdAt));
}

export async function createLead(lead: NewLead): Promise<Lead> {
  const db = await getDb();
  const [row] = await db.insert(leads).values(lead).returning();
  return row!;
}

/** فیلدهایی که تیم فروش می‌تواند عوض کند */
export type LeadPatch = Partial<
  Pick<
    Lead,
    | 'status'
    | 'assignedTo'
    | 'notes'
    | 'nextFollowUpAt'
    | 'firstContactAt'
    | 'closedAt'
    | 'dealValue'
    | 'capacityKw'
    | 'lostReason'
  >
>;

export async function updateLead(id: number, patch: LeadPatch): Promise<void> {
  const db = await getDb();
  await db.update(leads).set({ ...patch, updatedAt: new Date() }).where(eq(leads.id, id));
}

export async function getLead(id: number): Promise<Lead | null> {
  const db = await getDb();
  const [row] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return row ?? null;
}

/** کارشناسانی که می‌شود پرونده را به آن‌ها سپرد */
export async function assignableUsers() {
  const db = await getDb();
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.active, true));
}

/** پرونده‌هایی که قرار پیگیری‌شان رسیده — برای هشدار داشبورد */
export async function dueFollowUps(limit = 20): Promise<Lead[]> {
  const db = await getDb();
  return db
    .select()
    .from(leads)
    .where(and(isNotNull(leads.nextFollowUpAt), lte(leads.nextFollowUpAt, new Date())))
    .orderBy(leads.nextFollowUpAt)
    .limit(limit);
}

/**
 * آیا همین شماره در بازهٔ اخیر لید ثبت کرده؟
 *
 * کاربری که دکمه را دوبار می‌زند یا فرم را در دو صفحه پر می‌کند نباید دو
 * رکورد بسازد. بازه کوتاه است، پس تماس واقعیِ دوباره بعد از چند روز
 * تکراری حساب نمی‌شود.
 */
export async function recentDuplicate(
  phoneNormalized: string,
  withinMinutes = 60,
): Promise<Lead | null> {
  const db = await getDb();
  const since = new Date(Date.now() - withinMinutes * 60_000);
  const [row] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.phoneNormalized, phoneNormalized), gte(leads.createdAt, since)))
    .orderBy(desc(leads.createdAt))
    .limit(1);
  return row ?? null;
}

export interface LeadStats {
  total: number;
  today: number;
  week: number;
  byStatus: Record<string, number>;
  bySource: { source: string; count: number }[];
}

/** آمار داشبورد — همهٔ کوئری‌ها موازی */
export async function leadStats(): Promise<LeadStats> {
  const db = await getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);

  const [[all], [today], [week], statuses, sources] = await Promise.all([
    db.select({ value: count() }).from(leads),
    db.select({ value: count() }).from(leads).where(gte(leads.createdAt, startOfDay)),
    db.select({ value: count() }).from(leads).where(gte(leads.createdAt, weekAgo)),
    db.select({ status: leads.status, value: count() }).from(leads).groupBy(leads.status),
    db
      .select({ source: sql<string>`coalesce(${leads.source}, '—')`, value: count() })
      .from(leads)
      .groupBy(sql`coalesce(${leads.source}, '—')`)
      .orderBy(desc(count()))
      .limit(8),
  ]);

  return {
    total: all?.value ?? 0,
    today: today?.value ?? 0,
    week: week?.value ?? 0,
    byStatus: Object.fromEntries(statuses.map((s) => [s.status, s.value])),
    bySource: sources.map((s) => ({ source: s.source, count: s.value })),
  };
}
