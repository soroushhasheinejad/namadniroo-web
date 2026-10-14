import {
  DEGRADATION,
  OM_RATE,
  ROUTES,
  TARIFF,
  YEARS,
  YIELD_BY_REGION,
  calculate,
  costPerKwFor,
  type Assumptions,
  type Mount,
  type Result,
  type RouteInfo,
} from '../data/solarModel';

/**
 * قالب‌بندی و خلاصهٔ برآورد، مشترک بین ماشین‌حساب و صفحهٔ کمپین.
 *
 * هر دو صفحه یک عدد را به کاربر نشان می‌دهند و یک خلاصه را برای کارشناس
 * می‌فرستند؛ اگر هر کدام قالب خودش را داشت، کارشناس از دو صفحه دو جور
 * جمله می‌دید و کاربر روی دو صفحه دو جور عدد. این فایل در مرورگر هم اجرا
 * می‌شود، پس به هیچ چیز سمت سرور وابسته نیست.
 */

/** جداکنندهٔ هزارگان و اعشار هم فارسی می‌شود، وگرنه عدد نیمه‌فارسی می‌ماند */
export const fa = (v: string | number) =>
  String(v)
    .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]!)
    .replace(/,/g, '٬')
    .replace(/\./g, '٫');

/** معکوس `fa`، برای خواندن ورودی‌ای که کاربر با کیبورد فارسی تایپ کرده */
export const latin = (v: string) =>
  v
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٬/g, ',')
    .replace(/٫/g, '.');

export const grouped = (n: number) => Math.round(n).toLocaleString('en-US');

/** عدد بزرگ را به «میلیارد/میلیون» می‌نویسد — خواندن ۱۲ رقم پشت‌سرهم سخت است */
export const toman = (n: number): string => {
  if (n >= 1_000_000_000_000) return `${fa((n / 1_000_000_000_000).toFixed(1))} هزار میلیارد`;
  if (n >= 1_000_000_000) return `${fa((n / 1_000_000_000).toFixed(n < 10_000_000_000 ? 1 : 0))} میلیارد`;
  if (n >= 1_000_000) return `${fa(Math.round(n / 1_000_000))} میلیون`;
  return fa(grouped(n));
};

export const capacityLabel = (kw: number) =>
  kw >= 1000 ? `${fa((kw / 1000).toFixed(2))} مگاوات` : `${fa(Math.round(kw))} کیلووات`;

export const areaLabel = (m2: number) =>
  m2 >= 10_000 ? `${fa((m2 / 10_000).toFixed(1))} هکتار` : `${fa(Math.round(m2))} مترمربع`;

/** کم‌ترین سرمایه‌ای که برآورد برایش معنا دارد */
export const MIN_INVESTMENT = 50_000_000;

/** فرض‌های پیش‌فرض مدل برای یک نوع نصب و منطقه */
export const defaultAssumptions = (mount: Mount, region: string): Assumptions => ({
  costPerKw: costPerKwFor(mount),
  yieldPerKw: (YIELD_BY_REGION[region] ?? YIELD_BY_REGION.high!).kwhPerKw,
  mount,
  omRate: OM_RATE,
  degradation: DEGRADATION,
  years: YEARS,
});

export interface RouteOutcome {
  route: RouteInfo;
  tariff: number | null;
  /** `null` یعنی برای این ظرفیت نرخ مصوبی وجود ندارد */
  result: Result | null;
}

/** نتیجهٔ هر سه روش فروش برق برای یک سرمایه */
export function routeOutcomes(investment: number, a: Assumptions): RouteOutcome[] {
  const { scale } = calculate(investment, a);
  return ROUTES.map((route) => {
    const tariff = route.key === 'satba' ? TARIFF.satba[scale] : TARIFF[route.key];
    return { route, tariff, result: tariff === null ? null : calculate(investment, { ...a, tariff }) };
  });
}

/**
 * خلاصهٔ یک‌خطی برآورد، برای پروندهٔ لید.
 *
 * کارشناس پیش از تماس همین را می‌خواند، پس باید همان چیزی را بگوید که
 * کاربر روی صفحه دید — نه چیزی که سرور دوباره حساب کرده باشد.
 */
export function estimateSummary(investment: number, a: Assumptions, region: string): string {
  const r = calculate(investment, a);
  const mount = a.mount === 'ground' ? 'زمینی' : 'پشت‌بام';
  const regionLabel = YIELD_BY_REGION[region]?.label ?? region;
  return `سرمایه ${toman(investment)} تومان · ${mount} · ${regionLabel} · ظرفیت حدود ${capacityLabel(r.capacityKw)} · تولید سال اول حدود ${fa(grouped(r.firstYearProductionKwh))} kWh`;
}

/** نشانی برگهٔ چاپی برآورد با همان فرض‌هایی که کاربر جلوی چشمش دارد */
export function reportUrl(investment: number, a: Assumptions, region: string, print = false): string {
  const p = new URLSearchParams({
    investment: String(investment),
    mount: a.mount,
    region,
    cost: String(a.costPerKw / 1_000_000),
    om: String(+(a.omRate * 100).toFixed(3)),
  });
  if (print) p.set('print', '1');
  return `/solar-calculator/report?${p}`;
}

/**
 * چیزی که صفحه بعد از هر محاسبه به بخش «بررسی با کارشناس» می‌دهد.
 * با رویداد `nn:estimate` روی document فرستاده می‌شود؛ `null` یعنی هنوز
 * برآورد معتبری روی صفحه نیست.
 */
export interface EstimateDetail {
  summary: string;
  capacity: string;
  kw: number;
  reportUrl: string;
  printUrl: string;
}

export const ESTIMATE_EVENT = 'nn:estimate';

export function estimateDetail(investment: number, a: Assumptions, region: string): EstimateDetail {
  const r = calculate(investment, a);
  return {
    summary: estimateSummary(investment, a, region),
    capacity: capacityLabel(r.capacityKw),
    kw: Math.round(r.capacityKw),
    reportUrl: reportUrl(investment, a, region),
    printUrl: reportUrl(investment, a, region, true),
  };
}

/* آخرین برآورد هم نگه داشته می‌شود: ترتیب اجرای اسکریپت صفحه و اسکریپت
   بخش بررسی تضمینی نیست، و اگر صفحه اولین محاسبه را پیش از ثبت شنونده
   بفرستد، بخش بررسی بدون این تا تغییر بعدی کاربر چیزی نمی‌دید. */
let last: EstimateDetail | null = null;

export function publishEstimate(detail: EstimateDetail | null): void {
  last = detail;
  document.dispatchEvent(new CustomEvent(ESTIMATE_EVENT, { detail }));
}

export const lastEstimate = (): EstimateDetail | null => last;
