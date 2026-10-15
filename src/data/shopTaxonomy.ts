/**
 * ساختار درختی فروشگاه و قاعده‌های برچسب و لینک‌سازی.
 *
 *   فروشگاه ← نوع کالا (اینورتر، پنل، باتری، مانیتورینگ) ← صفحهٔ نیت (هیبرید،
 *   سه‌فاز، ۵ کیلووات، اینورتر فرونیوس …) ← محصول
 *
 * نوع کالا همان «بخش» نیروگاه است: پنل تولید می‌کند، اینورتر تبدیل، باتری
 * ذخیره و مانیتورینگ پایش. صفحه‌های نیت فقط برای عبارت‌هایی ساخته شده‌اند
 * که در پیشنهادهای جست‌وجوی گوگل تقاضای مشخص داشتند (seo-research/) و در
 * کاتالوگ دست‌کم یک محصول دارند؛ هر ترکیب دیگری فیلتر کوئری‌استرینگ است و
 * middleware برایش noindex می‌گذارد.
 *
 * لینک‌ها چهار جهت دارند:
 *   پدر به فرزند: فروشگاه ← انواع، نوع ← صفحه‌های نیت و محصول‌ها
 *   فرزند به پدر: مسیر راهنما در صفحهٔ نیت و صفحهٔ محصول
 *   پدر به پدر: انواع دیگر در ستون کناری، و همین برند در نوع‌های دیگر
 *   فرزندان مکمل: کالایی که معمولاً کنار این یکی لازم است (COMPLEMENTS)
 *
 * این فایل در مرورگر اجرا نمی‌شود ولی به دیتابیس هم وابسته نیست، تا قاعده‌ها
 * با تست واحد بررسی شوند.
 */

import { FACET_CONTENT, TYPE_CONTENT } from './shopTaxonomyContent';

export type Kind = 'inverter' | 'panel' | 'storage' | 'accessory';

/** حداقل چیزی که این ماژول از یک محصول لازم دارد */
export interface TaxProduct {
  slug: string;
  name: string;
  brand: string;
  kind: Kind;
  cat: 'home' | 'industrial';
  subkind: string | null;
  phase: 'single' | 'three' | null;
  powerMin: number | null;
  powerMax: number | null;
  official: boolean;
}

export interface Faq { q: string; a: string }

/** محتوای یک صفحهٔ فهرست (نوع یا نیت) */
export interface ListingContent {
  /** عنوان صفحه در نتایج جست‌وجو */
  title: string;
  /** H1 — همان کلمهٔ اصلی صفحه در نقشهٔ کلمه به صفحه */
  h1: string;
  description: string;
  /** پاراگراف‌های بالای صفحه؛ لینک‌های درون‌متنی با [متن](/نشانی) */
  intro: string[];
  faq: Faq[];
  /** مقاله‌های مجله که این صفحه به آن‌ها لینک می‌دهد */
  guides: string[];
}

export interface TypeDef extends ListingContent {
  slug: string;
  kind: Kind;
  /** نام کوتاه برای منو، مسیر راهنما و برچسب */
  label: string;
}

export type Dimension = 'subkind' | 'phase' | 'cat' | 'brand' | 'power';

export interface FacetDef extends ListingContent {
  type: string;
  slug: string;
  label: string;
  dim: Dimension;
  /** مقدار برچسب؛ برای power عدد هدف به واحد همان نوع */
  value: string;
}

/* ---------------------------------------------------------------- برچسب‌ها */

export const BRANDS: Record<string, string> = {
  'ae-solar': 'AE Solar',
  fronius: 'Fronius',
  sungrow: 'Sungrow',
  deye: 'Deye',
  goodwe: 'GoodWe',
  sineng: 'Sineng',
  sunways: 'Sunways',
  trina: 'Trina Solar',
};

/** برند ذخیره‌شده در دیتابیس («AE&nbsp;SOLAR»، «FRONIUS») ← کلید برند */
export function brandKey(raw: string): string {
  const plain = raw.replace(/&nbsp;/g, ' ').trim().toLowerCase();
  const hit = Object.entries(BRANDS).find(([, name]) => name.toLowerCase() === plain || name.toLowerCase().split(' ')[0] === plain);
  return hit ? hit[0] : plain.replace(/\s+/g, '-');
}

export const SUBKIND_LABEL: Record<string, string> = {
  hybrid: 'هیبرید',
  string: 'متصل به شبکه (آنگرید)',
  bifacial: 'دوطرفه (بای‌فیشیال)',
  monofacial: 'یک‌طرفه',
  battery: 'باتری لیتیومی',
  'all-in-one': 'ذخیره‌ساز یکپارچه',
  monitoring: 'مانیتورینگ و دیتالاگر',
};

/** زیرنوع‌های مجاز هر نوع — همان گزینه‌های فرم محصول در پنل */
export const SUBKINDS_BY_KIND: Record<Kind, string[]> = {
  inverter: ['hybrid', 'string'],
  panel: ['bifacial', 'monofacial'],
  storage: ['battery', 'all-in-one'],
  accessory: ['monitoring'],
};

export const PHASE_LABEL = { single: 'تک‌فاز', three: 'سه‌فاز' } as const;
export const CAT_LABEL = { home: 'خانگی و تجاری کوچک', industrial: 'صنعتی و نیروگاهی' } as const;
export const POWER_UNIT: Record<Kind, string> = { inverter: 'کیلووات', panel: 'وات', storage: 'کیلووات‌ساعت', accessory: '' };

/* ---------------------------------------------------------------- نوع‌ها */

/* متن صفحه‌ها در shopTaxonomyContent.ts است تا این فایل فقط قاعده باشد. */
export const TYPES: TypeDef[] = TYPE_CONTENT;
export const FACETS: FacetDef[] = FACET_CONTENT;

export const typeOf = (kind: Kind): TypeDef | undefined => TYPES.find((t) => t.kind === kind);
export const typeBySlug = (slug: string): TypeDef | undefined => TYPES.find((t) => t.slug === slug);
export const facetOf = (type: string, slug: string): FacetDef | undefined =>
  FACETS.find((f) => f.type === type && f.slug === slug);
export const facetsOfType = (type: string): FacetDef[] => FACETS.filter((f) => f.type === type);

/** آیا محصول در این صفحهٔ نیت می‌آید؟ */
export function matches(f: FacetDef, p: TaxProduct): boolean {
  const t = typeBySlug(f.type);
  if (!t || p.kind !== t.kind) return false;
  switch (f.dim) {
    case 'subkind':
      return p.subkind === f.value;
    case 'phase':
      return p.phase === f.value;
    case 'cat':
      return p.cat === f.value;
    case 'brand':
      return brandKey(p.brand) === f.value;
    case 'power': {
      /* بازهٔ توان محصول باید عدد هدف را پوشش دهد؛ پنل ±۲۵ وات و اینورتر
         ±۱۵٪ تلورانس دارد، چون «پنل ۵۵۰ وات» برای پنل ۵۴۵ واتی هم جست‌وجو
         می‌شود ولی «اینورتر ۵ کیلووات» برای اینورتر ۱۰۰ کیلوواتی نه. */
      const target = Number(f.value);
      const max = p.powerMax ?? p.powerMin;
      const min = p.powerMin ?? p.powerMax;
      if (min == null || max == null) return false;
      const tol = t.kind === 'panel' ? 25 : target * 0.15;
      return min - tol <= target && target <= max + tol;
    }
  }
}

export const productsOfType = <P extends TaxProduct>(t: TypeDef, all: P[]): P[] => all.filter((p) => p.kind === t.kind);
export const productsOfFacet = <P extends TaxProduct>(f: FacetDef, all: P[]): P[] => all.filter((p) => matches(f, p));

/**
 * صفحه‌های نیتی که واقعاً ساخته می‌شوند: آن‌هایی که محصول دارند. صفحهٔ
 * بی‌محصول برای گوگل صفحهٔ کم‌محتواست؛ اگر روزی محصولش اضافه شد، خودبه‌خود
 * زنده می‌شود.
 */
export const liveFacets = (all: TaxProduct[]): FacetDef[] => FACETS.filter((f) => all.some((p) => matches(f, p)));

/* ---------------------------------------------------------------- برچسب محصول */

export interface Tag {
  /** نام بُعد: «نوع»، «برند»، «فاز» … */
  dim: string;
  label: string;
  href: string;
  /** لینک به صفحهٔ ایندکس‌شدنی است یا به فیلتر noindex */
  indexable: boolean;
}

/**
 * برچسب‌های یک محصول. هر برچسب به صفحهٔ ایندکس‌شدنی همان بُعد لینک می‌دهد،
 * و اگر چنین صفحه‌ای نیست به فیلتر فروشگاه (کوئری‌استرینگ، noindex).
 */
export function tagsOf(p: TaxProduct, all: TaxProduct[]): Tag[] {
  const t = typeOf(p.kind);
  if (!t) return [];
  const live = liveFacets(all);
  const page = (dim: Dimension, value: string) => live.find((f) => f.type === t.slug && f.dim === dim && f.value === value);
  const tag = (dimLabel: string, dim: Dimension, value: string, label: string): Tag => {
    const f = page(dim, value);
    return f
      ? { dim: dimLabel, label: f.label, href: `/shop/${t.slug}/${f.slug}`, indexable: true }
      : { dim: dimLabel, label, href: `/shop/${t.slug}?${dim}=${encodeURIComponent(value)}`, indexable: false };
  };

  const tags: Tag[] = [{ dim: 'نوع', label: t.label, href: `/shop/${t.slug}`, indexable: true }];
  if (p.subkind && SUBKIND_LABEL[p.subkind]) tags.push(tag('زیرنوع', 'subkind', p.subkind, SUBKIND_LABEL[p.subkind]!));
  if (p.phase) tags.push(tag('فاز', 'phase', p.phase, PHASE_LABEL[p.phase]));
  tags.push(tag('کاربرد', 'cat', p.cat, CAT_LABEL[p.cat]));

  const bk = brandKey(p.brand);
  /* برند AE Solar صفحهٔ نمایندگی خودش را دارد؛ برچسب برند پنل به آن می‌رود */
  if (bk === 'ae-solar') tags.push({ dim: 'برند', label: 'AE Solar', href: '/ae-solar', indexable: true });
  else tags.push(tag('برند', 'brand', bk, BRANDS[bk] ?? p.brand.replace(/&nbsp;/g, ' ')));

  for (const f of live.filter((f) => f.type === t.slug && f.dim === 'power' && matches(f, p))) {
    tags.push({ dim: 'توان', label: f.label, href: `/shop/${t.slug}/${f.slug}`, indexable: true });
  }
  if (p.official) tags.push({ dim: 'اصالت', label: 'نمایندگی رسمی و ضمانت سازنده', href: bk === 'ae-solar' ? '/ae-solar' : `/shop/${t.slug}?official=1`, indexable: bk === 'ae-solar' });
  return tags;
}

/* ---------------------------------------------------------------- مسیر راهنما */

export interface Crumb { name: string; href: string }

/**
 * صفحهٔ نیتِ اصلی یک محصول — حلقهٔ وسط مسیر راهنما. اولویت با زیرنوع است
 * (اینورتر هیبرید)، چون دقیق‌ترین دستهٔ ایندکس‌شدنی محصول است.
 */
export function primaryFacet(p: TaxProduct, all: TaxProduct[]): FacetDef | undefined {
  const t = typeOf(p.kind);
  if (!t) return undefined;
  const live = liveFacets(all).filter((f) => f.type === t.slug && matches(f, p));
  const order: Dimension[] = ['subkind', 'cat', 'phase', 'brand', 'power'];
  return live.sort((a, b) => order.indexOf(a.dim) - order.indexOf(b.dim))[0];
}

export function productCrumbs(p: TaxProduct, all: TaxProduct[]): Crumb[] {
  const t = typeOf(p.kind);
  const crumbs: Crumb[] = [{ name: 'فروشگاه', href: '/shop' }];
  if (t) crumbs.push({ name: t.h1, href: `/shop/${t.slug}` });
  const f = primaryFacet(p, all);
  if (t && f) crumbs.push({ name: f.h1, href: `/shop/${t.slug}/${f.slug}` });
  return crumbs;
}

/* ---------------------------------------------------------------- مکمل‌ها */

/**
 * کسی که این کالا را می‌خرد، معمولاً این‌ها را هم لازم دارد یا باید بررسی
 * کند — از منطق طراحی سامانه، نه از دادهٔ فروش (سفارش آنلاین هنوز نداریم).
 * کلید «نوع» یا «نوع:زیرنوع» است؛ ترتیب مهم است و اولی مکمل‌ترین است.
 */
export const COMPLEMENTS: Record<string, string[]> = {
  'inverter:hybrid': ['storage', 'panel', 'accessory'],
  'inverter:string': ['panel', 'accessory'],
  inverter: ['panel', 'accessory'],
  panel: ['inverter', 'accessory'],
  'storage:battery': ['inverter:hybrid', 'accessory', 'panel'],
  'storage:all-in-one': ['panel', 'accessory'],
  storage: ['inverter:hybrid', 'panel'],
  accessory: ['inverter', 'storage'],
};

const complementKeys = (p: Pick<TaxProduct, 'kind' | 'subkind'>) =>
  COMPLEMENTS[`${p.kind}:${p.subkind}`] ?? COMPLEMENTS[p.kind] ?? [];

const inGroup = (key: string, p: TaxProduct) => {
  const [kind, sub] = key.split(':');
  return p.kind === kind && (!sub || p.subkind === sub);
};

/**
 * محصول‌های مکمل برای کاروسل «معمولاً همراه این محصول». هم‌برند و
 * هم‌کاربرد جلوتر می‌آیند: کسی که اینورتر هیبرید Deye خانگی می‌خرد، اول
 * باتری Deye می‌خواهد نه باتری نیروگاهی برند دیگر.
 */
export function complementProducts<P extends TaxProduct>(p: TaxProduct, all: P[], limit = 6): P[] {
  const keys = complementKeys(p);
  const scored = all
    .filter((x) => x.slug !== p.slug)
    .map((x) => {
      const k = keys.findIndex((key) => inGroup(key, x));
      if (k < 0) return null;
      const score = k * 10 - (brandKey(x.brand) === brandKey(p.brand) ? 5 : 0) - (x.cat === p.cat ? 3 : 0);
      return { x, score };
    })
    .filter((v): v is { x: P; score: number } => v !== null)
    .sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((v) => v.x);
}

/** نوع‌های مکمل یک صفحهٔ نیت یا نوع، برای لینک درون‌متنی و ستون کناری */
export function complementTypes(kind: Kind, subkind?: string): TypeDef[] {
  const keys = COMPLEMENTS[`${kind}:${subkind}`] ?? COMPLEMENTS[kind] ?? [];
  const seen = new Set<string>();
  return keys
    .map((k) => typeOf(k.split(':')[0] as Kind))
    .filter((t): t is TypeDef => !!t && !seen.has(t.slug) && !!seen.add(t.slug));
}

/* ---------------------------------------------------------------- ستون کناری */

export interface SidebarGroup { title: string; links: { label: string; href: string; count?: number }[] }

/**
 * ستون کناری صفحهٔ فهرست: هم‌سطح‌ها (نیت‌های دیگر همین نوع)، نوع‌های دیگر
 * (پدر به پدر)، و برای صفحهٔ برند، همان برند در نوع‌های دیگر.
 */
export function sidebarFor(t: TypeDef, current: FacetDef | undefined, all: TaxProduct[]): SidebarGroup[] {
  const live = liveFacets(all);
  const groups: SidebarGroup[] = [];
  const siblings = live.filter((f) => f.type === t.slug && f.slug !== current?.slug);
  const byDim: Record<string, string> = { subkind: 'بر اساس نوع', phase: 'بر اساس فاز', cat: 'بر اساس کاربرد', power: 'بر اساس توان', brand: 'بر اساس برند' };
  for (const dim of ['subkind', 'cat', 'phase', 'power', 'brand'] as Dimension[]) {
    const links = siblings.filter((f) => f.dim === dim).map((f) => ({ label: f.label, href: `/shop/${t.slug}/${f.slug}`, count: productsOfFacet(f, all).length }));
    if (t.kind === 'panel' && dim === 'brand') links.unshift({ label: 'AE Solar (نمایندگی رسمی)', href: '/ae-solar', count: all.filter((p) => p.kind === 'panel' && brandKey(p.brand) === 'ae-solar').length });
    if (links.length) groups.push({ title: `${t.label} ${byDim[dim]}`, links });
  }
  if (current?.dim === 'brand') {
    const sameBrand = TYPES.filter((o) => o.slug !== t.slug && all.some((p) => p.kind === o.kind && brandKey(p.brand) === current.value)).map((o) => {
      const f = live.find((x) => x.type === o.slug && x.dim === 'brand' && x.value === current.value);
      return { label: `${o.label} ${BRANDS[current.value] ?? ''}`.trim(), href: f ? `/shop/${o.slug}/${f.slug}` : `/shop/${o.slug}?brand=${current.value}` };
    });
    if (sameBrand.length) groups.push({ title: `${BRANDS[current.value] ?? ''} در دسته‌های دیگر`, links: sameBrand });
  }
  groups.push({
    title: 'دسته‌های دیگر فروشگاه',
    links: TYPES.filter((o) => o.slug !== t.slug && all.some((p) => p.kind === o.kind)).map((o) => ({ label: o.h1, href: `/shop/${o.slug}`, count: all.filter((p) => p.kind === o.kind).length })),
  });
  return groups;
}

/* ---------------------------------------------------------------- فیلتر کوئری‌استرینگ */

/** فیلترهای مجاز در نشانی فهرست؛ هر چیز دیگری نادیده گرفته می‌شود */
export function applyQueryFilters<P extends TaxProduct>(list: P[], q: URLSearchParams): P[] {
  return list.filter((p) =>
    (!q.get('brand') || brandKey(p.brand) === q.get('brand')) &&
    (!q.get('phase') || p.phase === q.get('phase')) &&
    (!q.get('cat') || p.cat === q.get('cat')) &&
    (!q.get('subkind') || p.subkind === q.get('subkind')) &&
    (!q.get('official') || p.official),
  );
}
