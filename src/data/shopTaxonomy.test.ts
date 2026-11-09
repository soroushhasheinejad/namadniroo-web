import { describe, expect, it } from 'vitest';
import {
  FACETS,
  TYPES,
  applyQueryFilters,
  brandKey,
  complementProducts,
  facetOf,
  liveFacets,
  matches,
  productCrumbs,
  shopSections,
  sidebarFor,
  tagsOf,
  typeBySlug,
  type TaxProduct,
} from './shopTaxonomy';

/* همان ۱۶ محصول سایت، با مقدارهای مایگریشن 0011 */
const P = (o: Partial<TaxProduct> & Pick<TaxProduct, 'slug' | 'brand' | 'kind' | 'cat'>): TaxProduct => ({
  name: o.slug, subkind: null, phase: null, powerMin: null, powerMax: null, official: false, ...o,
});
const all: TaxProduct[] = [
  P({ slug: 'deye-logger', brand: 'DEYE', kind: 'accessory', cat: 'home', subkind: 'monitoring' }),
  P({ slug: 'deye-sun-g05', brand: 'DEYE', kind: 'inverter', cat: 'home', subkind: 'hybrid', phase: 'single', powerMin: 3.6, powerMax: 6 }),
  P({ slug: 'deye-sun-70-110k', brand: 'DEYE', kind: 'inverter', cat: 'industrial', subkind: 'string', phase: 'three', powerMin: 70, powerMax: 110 }),
  P({ slug: 'fronius-primo', brand: 'FRONIUS', kind: 'inverter', cat: 'home', subkind: 'string', phase: 'single', powerMin: 3, powerMax: 8.2 }),
  P({ slug: 'fronius-symo', brand: 'FRONIUS', kind: 'inverter', cat: 'home', subkind: 'string', phase: 'three', powerMin: 3, powerMax: 20 }),
  P({ slug: 'fronius-tauro', brand: 'FRONIUS', kind: 'inverter', cat: 'industrial', subkind: 'string', phase: 'three', powerMin: 50, powerMax: 100 }),
  P({ slug: 'goodwe-ht', brand: 'GOODWE', kind: 'inverter', cat: 'industrial', subkind: 'string', phase: 'three', powerMin: 73, powerMax: 136 }),
  P({ slug: 'sineng-sp350k', brand: 'SINENG', kind: 'inverter', cat: 'industrial', subkind: 'string', phase: 'three', powerMin: 350, powerMax: 350 }),
  P({ slug: 'sungrow-rs', brand: 'SUNGROW', kind: 'inverter', cat: 'home', subkind: 'string', phase: 'single', powerMin: 3, powerMax: 10 }),
  P({ slug: 'sungrow-sg110cx', brand: 'SUNGROW', kind: 'inverter', cat: 'industrial', subkind: 'string', phase: 'three', powerMin: 110, powerMax: 110 }),
  P({ slug: 'sunways-stt', brand: 'SUNWAYS', kind: 'inverter', cat: 'industrial', subkind: 'string', phase: 'three', powerMin: 30, powerMax: 125 }),
  P({ slug: 'ae-md-panel', brand: 'AE&nbsp;SOLAR', kind: 'panel', cat: 'home', subkind: 'monofacial', powerMin: 530, powerMax: 550, official: true }),
  P({ slug: 'ae-cme-bifacial', brand: 'AE&nbsp;SOLAR', kind: 'panel', cat: 'industrial', subkind: 'bifacial', powerMin: 710, powerMax: 730, official: true }),
  P({ slug: 'trina-vertex', brand: 'TRINA', kind: 'panel', cat: 'industrial', powerMax: 700 }),
  P({ slug: 'deye-ai-w51', brand: 'DEYE', kind: 'storage', cat: 'home', subkind: 'all-in-one', powerMin: 5, powerMax: 12 }),
  P({ slug: 'deye-rw-f', brand: 'DEYE', kind: 'storage', cat: 'home', subkind: 'battery', powerMax: 10.2 }),
];
const get = (slug: string) => all.find((p) => p.slug === slug)!;
const slugsOf = (type: string, facet: string) => all.filter((p) => matches(facetOf(type, facet)!, p)).map((p) => p.slug);

describe('ساختار فروشگاه', () => {
  it('نامک نوع‌ها با نامک هیچ محصولی یکی نیست (هر دو در /shop/{slug}اند)', () => {
    for (const t of TYPES) expect(all.some((p) => p.slug === t.slug)).toBe(false);
  });

  it('دقیقاً پنج نوع کالا، هر کدام با نوع دیتابیس (این ساختار بیلد تایپ‌چک نمی‌شود)', () => {
    expect(TYPES.map((t) => `${t.slug}:${t.kind}`)).toEqual(['inverter:inverter', 'panel:panel', 'battery:storage', 'monitoring:accessory', 'tools:tool']);
    for (const f of FACETS) expect(f.dim && f.value && f.type).toBeTruthy();
  });

  it('هر صفحهٔ نیت نامک یکتا دارد و به نوع موجودی اشاره می‌کند', () => {
    const keys = FACETS.map((f) => `${f.type}/${f.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of FACETS) expect(typeBySlug(f.type)).toBeTruthy();
  });

  it('همهٔ صفحه‌های نیت تعریف‌شده در کاتالوگ فعلی محصول دارند', () => {
    expect(liveFacets(all).length).toBe(FACETS.length);
  });

  it('برند ذخیره‌شده با &nbsp; و حروف بزرگ به کلید برند می‌رسد', () => {
    expect(brandKey('AE&nbsp;SOLAR')).toBe('ae-solar');
    expect(brandKey('FRONIUS')).toBe('fronius');
    expect(brandKey('TRINA')).toBe('trina');
  });
});

describe('تطبیق محصول با صفحهٔ نیت', () => {
  it('هیبرید و متصل به شبکه از زیرنوع می‌آیند', () => {
    expect(slugsOf('inverter', 'hybrid')).toEqual(['deye-sun-g05']);
    expect(slugsOf('inverter', 'on-grid')).not.toContain('deye-sun-g05');
  });

  it('صفحهٔ توان فقط بازه‌ای را که عدد هدف را پوشش می‌دهد می‌گیرد', () => {
    expect(slugsOf('inverter', '5kw').sort()).toEqual(['deye-sun-g05', 'fronius-primo', 'fronius-symo', 'sungrow-rs']);
    // اینورتر ۳۵۰ کیلوواتی در صفحهٔ ۱۰۰ کیلووات نیست
    expect(slugsOf('inverter', '100kw')).not.toContain('sineng-sp350k');
    expect(slugsOf('inverter', '100kw')).toContain('sungrow-sg110cx');
  });

  it('پنل با تلورانس وات: ۷۱۰ تا ۷۳۰ وات در «پنل ۷۰۰ وات» هست، ۵۵۰ وات نیست', () => {
    expect(slugsOf('panel', '700w').sort()).toEqual(['ae-cme-bifacial', 'trina-vertex']);
    expect(slugsOf('panel', '550w')).toEqual(['ae-md-panel']);
  });
});

describe('برچسب و مسیر راهنما', () => {
  it('برچسب‌ها به صفحه‌های ایندکس‌شدنی می‌روند و بُعد بی‌صفحه به فیلتر noindex', () => {
    const tags = tagsOf(get('goodwe-ht'), all);
    expect(tags.find((t) => t.dim === 'فاز')!.href).toBe('/shop/inverter/three-phase');
    const brand = tags.find((t) => t.dim === 'برند')!;
    expect(brand.indexable).toBe(false);
    expect(brand.href).toBe('/shop/inverter?brand=goodwe');
  });

  it('کاربرد صفحه ندارد (تقاضا نبود) و پنل ترینا صفحه دارد (تقاضا بود)', () => {
    const cat = tagsOf(get('goodwe-ht'), all).find((t) => t.dim === 'کاربرد')!;
    expect(cat).toMatchObject({ href: '/shop/inverter?cat=industrial', indexable: false });
    const brand = tagsOf(get('trina-vertex'), all).find((t) => t.dim === 'برند')!;
    expect(brand).toMatchObject({ href: '/shop/panel/trina', indexable: true });
  });

  it('برند AE Solar و برچسب اصالت به صفحهٔ نمایندگی می‌روند', () => {
    const tags = tagsOf(get('ae-md-panel'), all);
    expect(tags.find((t) => t.dim === 'برند')!.href).toBe('/ae-solar');
    expect(tags.find((t) => t.dim === 'اصالت')!.href).toBe('/ae-solar');
  });

  it('مسیر راهنمای محصول از نوع و دقیق‌ترین صفحهٔ نیت می‌گذرد', () => {
    expect(productCrumbs(get('deye-sun-g05'), all).map((c) => c.href)).toEqual(['/shop', '/shop/inverter', '/shop/inverter/hybrid']);
  });
});

describe('مکمل‌ها و ستون کناری', () => {
  it('اینورتر هیبرید Deye اول باتری Deye پیشنهاد می‌دهد', () => {
    const comp = complementProducts(get('deye-sun-g05'), all).map((p) => p.slug);
    expect(comp[0]).toMatch(/^deye-(rw-f|ai-w51)$/);
    expect(comp).toContain('deye-logger');
  });

  it('پنل، اینورتر پیشنهاد می‌دهد و خودش را نه', () => {
    const comp = complementProducts(get('ae-cme-bifacial'), all);
    expect(comp.every((p) => p.slug !== 'ae-cme-bifacial')).toBe(true);
    expect(comp[0]!.kind).toBe('inverter');
  });

  it('صفحهٔ برند Deye در ستون کناری به همان برند در نوع‌های دیگر لینک می‌دهد', () => {
    const groups = sidebarFor(typeBySlug('inverter')!, facetOf('inverter', 'deye'), all);
    const g = groups.find((x) => x.title.includes('Deye'))!;
    expect(g.links.map((l) => l.href)).toEqual(['/shop/battery?brand=deye', '/shop/monitoring?brand=deye']);
  });

  it('فیلتر کوئری‌استرینگ فقط بُعدهای مجاز را می‌شناسد', () => {
    const inv = all.filter((p) => p.kind === 'inverter');
    expect(applyQueryFilters(inv, new URLSearchParams('brand=fronius&phase=three')).map((p) => p.slug)).toEqual(['fronius-symo', 'fronius-tauro']);
    expect(applyQueryFilters(inv, new URLSearchParams('evil=1')).length).toBe(inv.length);
  });
});

/* کالاهای فهرست موجودی ۱۳ آبان ۱۴۰۵، با مقدارهای مایگریشن 0012 */
const stock: TaxProduct[] = [
  P({ slug: 'fronius-primo-5-0-1', brand: 'FRONIUS', kind: 'inverter', cat: 'home', subkind: 'string', phase: 'single', powerMin: 5, powerMax: 5 }),
  P({ slug: 'sunways-stt-5ktl', brand: 'SUNWAYS', kind: 'inverter', cat: 'home', subkind: 'string', phase: 'three', powerMin: 5, powerMax: 5 }),
  P({ slug: 'kaco-blueplanet-10-0-nx3-m2', brand: 'KACO', kind: 'inverter', cat: 'home', subkind: 'string', phase: 'three', powerMin: 10, powerMax: 10 }),
  P({ slug: 'fronius-eco-25-0-3-s', brand: 'FRONIUS', kind: 'inverter', cat: 'industrial', subkind: 'string', phase: 'three', powerMin: 25, powerMax: 25 }),
  P({ slug: 'huawei-sun2000-50ktl-m3', brand: 'HUAWEI', kind: 'inverter', cat: 'industrial', subkind: 'string', phase: 'three', powerMin: 50, powerMax: 50 }),
  P({ slug: 'goodwe-gw250k-ht', brand: 'GOODWE', kind: 'inverter', cat: 'industrial', subkind: 'string', phase: 'three', powerMin: 250, powerMax: 250 }),
  P({ slug: 'deye-ae-fs2-0-2h2', brand: 'DEYE', kind: 'storage', cat: 'home', subkind: 'all-in-one', powerMin: 2, powerMax: 2 }),
  P({ slug: 'pntech-mc4-connector', brand: 'PNTECH', kind: 'tool', cat: 'home' }),
];
const catalog = [...all, ...stock];
const sectionOf = (slug: string) => shopSections(catalog).find((s) => s.items.some((p) => p.slug === slug))!.section.id;

describe('بخش‌های صفحهٔ فروشگاه', () => {
  it('هر محصول دقیقاً در یک بخش می‌آید و هیچ محصولی جا نمی‌ماند', () => {
    const placed = shopSections(catalog).flatMap((s) => s.items.map((p) => p.slug));
    expect(placed.sort()).toEqual(catalog.map((p) => p.slug).sort());
  });

  it('اینورترها بر اساس کاربرد تقسیم می‌شوند، نه فقط نوع', () => {
    expect(sectionOf('deye-sun-g05')).toBe('hybrid');
    expect(sectionOf('fronius-primo-5-0-1')).toBe('single-phase');
    expect(sectionOf('sunways-stt-5ktl')).toBe('three-phase');
    expect(sectionOf('fronius-eco-25-0-3-s')).toBe('three-phase');
    expect(sectionOf('huawei-sun2000-50ktl-m3')).toBe('commercial');
    expect(sectionOf('sunways-stt')).toBe('commercial');
    expect(sectionOf('goodwe-gw250k-ht')).toBe('utility');
    expect(sectionOf('sineng-sp350k')).toBe('utility');
  });

  it('ابزار نصب بخش و صفحهٔ نوع خودش را دارد و با مانیتورینگ قاطی نمی‌شود', () => {
    expect(sectionOf('pntech-mc4-connector')).toBe('tools');
    expect(sectionOf('deye-logger')).toBe('monitoring');
    expect(typeBySlug('tools')!.kind).toBe('tool');
  });

  it('برند تازه‌ها کلید درست می‌گیرند و ابزار برچسب کاربرد نمی‌گیرد', () => {
    expect(brandKey('KACO')).toBe('kaco');
    expect(brandKey('HUAWEI')).toBe('huawei');
    expect(tagsOf(stock.at(-1)!, catalog).some((t) => t.dim === 'کاربرد')).toBe(false);
  });

  it('نامک محصول‌های تازه با نامک نوع‌ها یکی نیست', () => {
    for (const t of TYPES) expect(stock.some((p) => p.slug === t.slug)).toBe(false);
  });
});
