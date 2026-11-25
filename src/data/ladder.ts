/**
 * کمپین «تخفیف پله‌ای» فروشگاه.
 *
 * هر مدل چند پله دارد. هر پله تعداد مشخصی دستگاه با یک درصد تخفیف است.
 * وقتی دستگاه‌های یک پله فروخته شد، پلهٔ بعد با تخفیف کمتر باز می‌شود.
 * سایت فقط درصد را نشان می‌دهد، نه قیمت. هیچ عددی این‌جا ساخته نمی‌شود:
 * تعداد پله، درصدها و تعداد فروخته‌شده همه از پنل (تنظیمات `ladder`)
 * می‌آیند و تیم فروش «فروخته‌شده» را بعد از هر پرداخت قطعی به‌روز می‌کند.
 *
 * این فایل به دیتابیس وابسته نیست تا قاعده‌ها با تست واحد بررسی شوند.
 * طرح کامل کمپین: clients/namadniroo/campaigns/2026-11-25-ongrid-stock-ladder.md
 * در چارچوب محتوا.
 */

import { toLatinDigits } from '../utils';

/* ---------------------------------------------------------------- شکل ذخیره */

/** یک مدل، همان‌طور که فرم پنل ذخیره می‌کند (همه متن، چون ویراستار فارسی تایپ می‌کند) */
export interface LadderItemStored {
  slug: string;
  /** تعداد دستگاهی که با پرداخت قطعی فروخته شده */
  sold: string;
  t1Units: string;
  t1Off: string;
  t2Units: string;
  t2Off: string;
  t3Units: string;
  t3Off: string;
}

export interface LadderStored {
  active: boolean;
  title: string;
  lead: string;
  /** پایان کمپین به وقت تهران، `YYYY-MM-DD HH:mm` */
  endsAt: string;
  rules: string[];
  challengeQuestion: string;
  challengeDeadline: string;
  items: LadderItemStored[];
}

export const ladderDefaults: LadderStored = {
  active: false,
  title: 'تخفیف پله‌ای اینورترهای آن‌گرید',
  lead: 'اولین دستگاه‌های هر مدل بیشترین تخفیف را دارند. هر پله که پر شود، پلهٔ بعد با تخفیف کمتر باز می‌شود.',
  endsAt: '',
  rules: [
    'تعداد هر پله واقعی است و وسط کمپین عوض نمی‌شود.',
    'فروش با پرداخت شمرده می‌شود، نه با پیش‌فاکتور. پیش‌فاکتور دستگاه را ۲۴ ساعت کاری نگه می‌دارد.',
    'سفارش چنددستگاهی: آنچه از پلهٔ جاری مانده با تخفیف همان پله، بقیه با پلهٔ بعد.',
    'کمپین با پر شدن پلهٔ آخر یا رسیدن مهلت تمام می‌شود و تمدید ندارد.',
  ],
  challengeQuestion: '',
  challengeDeadline: '',
  items: [],
};

/* ---------------------------------------------------------------- خواندن */

/** «۱۲» یا «12» → 12؛ هر چیز نامعتبر → null */
export function parseCount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = toLatinDigits(String(raw)).replace(/[\s,٬،_]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** «۲۰٪»، «20%» یا «۲۰» → 20؛ فقط بین ۱ و ۹۹ */
export function parsePercent(raw: unknown): number | null {
  const n = parseCount(String(raw ?? '').replace(/[%٪]/g, ''));
  return n !== null && n >= 1 && n <= 99 ? n : null;
}

/** پایان کمپین به وقت تهران (UTC+03:30، ایران ساعت تابستانی ندارد) */
export function parseEndsAt(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(toLatinDigits(raw ?? '').trim());
  if (!m) return null;
  const [, y, mo, d, h = '23', mi = '59'] = m;
  const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:00+03:30`);
  return Number.isNaN(t) ? null : new Date(t);
}

/* ---------------------------------------------------------------- محاسبه */

export interface Tier {
  index: number;
  units: number;
  /** درصد تخفیف */
  off: number;
  status: 'full' | 'current' | 'next';
  /** دستگاه‌های فروخته‌شده از همین پله */
  soldInTier: number;
}

export interface LadderState {
  slug: string;
  tiers: Tier[];
  sold: number;
  total: number;
  /** پلهٔ جاری؛ null یعنی همهٔ پله‌ها پر شده */
  current: Tier | null;
  remainingInCurrent: number;
  next: Tier | null;
}

/** پله‌های ناقص (بدون تعداد یا درصد) کنار گذاشته می‌شوند، نه حدس زده */
export function ladderState(item: LadderItemStored): LadderState | null {
  const raw = [
    [item.t1Units, item.t1Off],
    [item.t2Units, item.t2Off],
    [item.t3Units, item.t3Off],
  ]
    .map(([u, o]) => ({ units: parseCount(u), off: parsePercent(o) }))
    .filter((t): t is { units: number; off: number } => !!t.units && !!t.off);
  if (!item.slug?.trim() || raw.length === 0) return null;

  const total = raw.reduce((s, t) => s + t.units, 0);
  const sold = Math.min(parseCount(item.sold) ?? 0, total);

  let before = 0;
  let current: Tier | null = null;
  const tiers: Tier[] = raw.map((t, index) => {
    const soldInTier = Math.max(0, Math.min(t.units, sold - before));
    const status: Tier['status'] = soldInTier >= t.units ? 'full' : current ? 'next' : 'current';
    const tier: Tier = { index, units: t.units, off: t.off, status, soldInTier };
    if (status === 'current') current = tier;
    before += t.units;
    return tier;
  });

  const cur = current as Tier | null;
  return {
    slug: item.slug.trim(),
    tiers,
    sold,
    total,
    current: cur,
    remainingInCurrent: cur ? cur.units - cur.soldInTier : 0,
    next: cur ? (tiers[cur.index + 1] ?? null) : null,
  };
}

export interface LadderView extends Omit<LadderStored, 'items'> {
  ends: Date | null;
  items: LadderState[];
}

/**
 * آنچه صفحه نشان می‌دهد. null یعنی بلوک کمپین نباید دیده شود: خاموش است،
 * مهلتش گذشته، یا هیچ مدلی پلهٔ کامل ندارد.
 */
export function ladderView(stored: Partial<LadderStored> | null | undefined, now = new Date()): LadderView | null {
  const s = { ...ladderDefaults, ...(stored ?? {}) };
  if (!s.active) return null;
  const ends = parseEndsAt(s.endsAt);
  if (ends && ends.getTime() <= now.getTime()) return null;
  const items = (s.items ?? []).map(ladderState).filter((x): x is LadderState => x !== null);
  if (items.length === 0) return null;
  return { ...s, ends, items };
}

/** وضعیت کمپین هر محصول، برای برچسب روی کارتش */
export function tierBySlug(view: LadderView | null): Map<string, LadderState> {
  return new Map((view?.items ?? []).map((i) => [i.slug, i]));
}

/* ---------------------------------------------------------------- پیش‌نمایش */

/**
 * دادهٔ نمونه فقط برای دیدن طراحی در محیط توسعه (`/shop?demo=ladder`).
 * عددهایش ساختگی‌اند و هرگز در سایت واقعی نشان داده نمی‌شوند؛ صفحه کنارش
 * برچسب «دادهٔ نمونه» می‌گذارد.
 */
export const ladderDemo: LadderStored = {
  ...ladderDefaults,
  active: true,
  endsAt: '2026-12-02 23:59',
  challengeQuestion:
    'با اینورتر KACO blueplanet 10.0 NX3 و پنل AE Solar [مدل]، در سردترین صبح زمستان کرمان حداکثر چند پنل را می‌شود در یک رشته سری کرد؟',
  challengeDeadline: 'امروز ساعت ۱۸',
  items: [
    { slug: 'kaco-blueplanet-10-0-nx3-m2', sold: '3', t1Units: '4', t1Off: '20', t2Units: '6', t2Off: '12', t3Units: '10', t3Off: '6' },
    { slug: 'kaco-blueplanet-5-0-nx1-m2', sold: '1', t1Units: '4', t1Off: '20', t2Units: '6', t2Off: '12', t3Units: '10', t3Off: '6' },
    { slug: 'deye-sun-5k-g05p1', sold: '6', t1Units: '4', t1Off: '20', t2Units: '6', t2Off: '12', t3Units: '10', t3Off: '6' },
  ],
};
