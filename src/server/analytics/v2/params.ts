/**
 * خواندن فیلترها از نشانی صفحه.
 *
 * فیلترها در query string می‌نشینند، نه در حافظهٔ صفحه: گزارشی که
 * ساخته‌اید باید قابل کپی‌کردن و فرستادن به همکار باشد، و دکمهٔ back هم
 * باید همان کاری را بکند که کاربر انتظار دارد.
 *
 * شکل: `?f=utmSource:is:instagram&f=path:contains:calc&days=30`
 * مقدار خالی یعنی «ثبت‌نشده»: `?f=utmCampaign:is:`
 */
import { isDimension, type DimensionKey, type Filter, type Range } from './query';

export const MAX_FILTERS = 8;

export interface ParsedParams {
  days: number;
  range: Range;
  filters: Filter[];
}

const OPS = new Set(['is', 'contains', 'not']);

export function parseFilters(params: URLSearchParams): Filter[] {
  const out: Filter[] = [];
  for (const raw of params.getAll('f').slice(0, MAX_FILTERS)) {
    /* فقط دو جداکنندهٔ اول شکسته می‌شود تا مقدارِ حاوی «:» سالم بماند —
       نشانی ارجاع‌دهنده همیشه یکی دارد. */
    const first = raw.indexOf(':');
    const second = raw.indexOf(':', first + 1);
    if (first < 0 || second < 0) continue;

    const dimension = raw.slice(0, first);
    const op = raw.slice(first + 1, second);
    const value = raw.slice(second + 1);
    if (!isDimension(dimension) || !OPS.has(op)) continue;

    out.push({
      dimension: dimension as DimensionKey,
      op: op as Filter['op'],
      value: value === '' ? null : decodeURIComponent(value),
    });
  }
  return out;
}

export function parseParams(url: URL): ParsedParams {
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { days, range: { from, to }, filters: parseFilters(url.searchParams) };
}

/** نشانی همین صفحه با یک فیلتر بیشتر — برای کلیک روی ردیف‌های جدول */
export function withFilter(url: URL, filter: Filter): string {
  const next = new URL(url.href);
  const encoded = `${filter.dimension}:${filter.op ?? 'is'}:${
    filter.value === null ? '' : encodeURIComponent(filter.value)
  }`;
  if (!next.searchParams.getAll('f').includes(encoded)) next.searchParams.append('f', encoded);
  return next.pathname + next.search;
}

/** نشانی همین صفحه بدون فیلتر شمارهٔ `index` */
export function withoutFilter(url: URL, index: number): string {
  const next = new URL(url.href);
  const all = next.searchParams.getAll('f');
  next.searchParams.delete('f');
  all.forEach((v, i) => i !== index && next.searchParams.append('f', v));
  return next.pathname + next.search;
}

/** نشانی همین صفحه با بازهٔ زمانی دیگر */
export function withDays(url: URL, days: number): string {
  const next = new URL(url.href);
  next.searchParams.set('days', String(days));
  return next.pathname + next.search;
}
