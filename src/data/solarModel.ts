/**
 * مدل تقریبی اقتصاد نیروگاه خورشیدی.
 *
 * این فایل منبع همهٔ عددهای ماشین‌حساب صفحهٔ «برآورد سرمایه‌گذاری» است.
 * عمداً از خود صفحه جدا شده تا هم در تست بررسی شود، هم وقتی نرخ‌ها عوض
 * می‌شوند (که در ایران زیاد اتفاق می‌افتد) فقط همین یک فایل به‌روز شود.
 *
 * ── دربارهٔ دقت ─────────────────────────────────────────────────────
 * خروجی این مدل «برآورد» است، نه طرح توجیهی. هزینهٔ احداث در هر پروژه
 * فرق می‌کند، چون:
 *
 *   • قیمت تجهیزات به نرخ ارز گره خورده و ماه‌به‌ماه عوض می‌شود
 *   • زمین، فاصله تا شبکه و سطح ولتاژ اتصال در هر پروژه یک چیز است
 *   • برند و مشخصات تجهیزات انتخاب سرمایه‌گذار است
 *
 * برای همین هزینه به‌صورت بازه تعریف شده و خروجی هم بازه است، نه یک
 * عدد قطعی. کاربر می‌تواند فرض‌ها را عوض کند.
 */

export type Scale = 'small' | 'commercial' | 'utility';
export type Mount = 'roof' | 'ground';
export type Route = 'satba' | 'bourse' | 'self';

/* ============================================================
   فرض‌های پایه
   ============================================================ */

export interface Range {
  min: number;
  typical: number;
  max: number;
}

/**
 * هزینهٔ احداث نیروگاه زمینی، به تومان بر کیلووات — کلید در دست.
 *
 * مبنا برآورد نماد نیرو از قیمت روز پروژه‌هاست: هر مگاوات نیروگاه زمینی
 * ۱۰۰ تا ۱۱۰ میلیارد تومان. این یک رقمِ کل است و همهٔ اجزا را در خودش
 * دارد؛ مدل دیگر تجهیزات، زمین و پست را جدا حساب نمی‌کند.
 *
 * ── چرا مدل سه‌جزئی کنار رفت ────────────────────────────────────────
 * پیش‌تر هزینه از سه جزء ساخته می‌شد: تجهیزات (۳۳ تا ۳۸ میلیون بر
 * کیلووات، پله‌ای بر اساس مقیاس)، زمین (۱۵ میلیون بر کیلووات) و پست و خط
 * انتقال (۲۰ میلیارد تومان ثابت). حاصلش برای یک مگاوات زمینی ۶۸ میلیارد
 * و برای یک مگاوات روی سقف ۳۳ میلیارد بود — یعنی سقف نصفِ زمینی. هر دو
 * از قیمت واقعی پروژه‌ها دور بودند: رقم کل پایین بود و فاصلهٔ زمینی و
 * سقف بسیار بیشتر از آنچه در عمل دیده می‌شود.
 *
 * همین نرخ برای همهٔ ظرفیت‌ها به کار می‌رود. عدد مرجع در مقیاس مگاواتی
 * داده شده و برای ظرفیت‌های کوچک عدد جداگانه‌ای در دست نیست؛ اگر روزی
 * بود، جایش همین‌جاست.
 */
export const GROUND_COST: Range = {
  min: 100_000_000,
  typical: 105_000_000,
  max: 110_000_000,
};

/**
 * نصب روی سقف سوله چقدر ارزان‌تر از زمینی تمام می‌شود.
 *
 * تفاوت این دو فقط همین ۷ درصد است، در هر ظرفیتی: یک مگاوات زمینی با
 * ۱۰۵ میلیارد تومان، روی سقف سوله حدود ۹۷٫۶۵ میلیارد.
 */
export const ROOF_DISCOUNT = 0.07;

/**
 * هزینهٔ هر کیلووات برای یک نوع نصب، از روی هزینهٔ زمینی.
 *
 * گرد می‌شود چون ضرب اعشاری دُم می‌گذارد (۱۰۵ میلیون × ۰٫۹۳ دقیقاً
 * ۹۷٬۶۵۰٬۰۰۰ در نمی‌آید) و این عدد عیناً در کادر ورودی صفحه می‌نشیند.
 */
export function costPerKwFor(mount: Mount, groundCostPerKw = GROUND_COST.typical): number {
  return mount === 'roof' ? Math.round(groundCostPerKw * (1 - ROOF_DISCOUNT)) : groundCostPerKw;
}

/** بازهٔ هزینهٔ هر کیلووات برای یک نوع نصب */
export function costRangeFor(mount: Mount): Range {
  return {
    min: costPerKwFor(mount, GROUND_COST.min),
    typical: costPerKwFor(mount, GROUND_COST.typical),
    max: costPerKwFor(mount, GROUND_COST.max),
  };
}

/**
 * تولید سالانهٔ هر کیلووات ظرفیت نصب‌شده (کیلووات‌ساعت).
 *
 * ── چرا گروه‌بندی بر اساس پتانسیل فتوولتائیک است، نه تابش ──────────
 * تابش (GHI) فقط می‌گوید چقدر انرژی به زمین می‌رسد؛ پتانسیل فتوولتائیک
 * (PVOUT) می‌گوید از آن انرژی چقدر برق در می‌آید. این دو همیشه یک ترتیب
 * ندارند، چون راندمان پنل با گرما افت می‌کند و غبار جلوی نور را می‌گیرد.
 *
 * نتیجهٔ عملی‌اش این است که استان‌های گرم جنوبی با تابش بسیار بالا —
 * سیستان‌وبلوچستان، خوزستان، هرمزگان — پایین‌تر از فلات مرتفع و خنک‌تر
 * یزد و کرمان می‌نشینند، هرچند آفتاب بیشتری می‌گیرند. گروه‌بندی بر مبنای
 * تابش، این استان‌ها را به‌غلط در بالاترین پله می‌گذاشت.
 *
 * اعداد زیر خروجی خالص‌اند: افت گرما، غبار، کابل و اینورتر در آن‌ها لحاظ
 * شده، و مبنایشان میانگین بلندمدت PVOUT اطلس جهانی خورشید است.
 */
export const SUN_DAYS = 345;

/**
 * ضریب منطقه: ساعت تابش مفید روزانه (kWh بر هر کیلووات در روز).
 *
 * تولید ویژهٔ سالانه از ضرب همین در ۳۴۵ در می‌آید — مثلاً کرمان:
 * ۵٫۳۶ × ۳۴۵ ≈ ۱۸۵۰ کیلووات‌ساعت بر کیلووات. فرمول مرجع همین است:
 *
 *     تولید سال n = ظرفیت × ضریب منطقه × ۳۴۵ × (۱ − افت)^n
 *
 * ۳۴۵ روز، نه ۳۶۵: ابر، گردوغبار، شست‌وشو و توقف نگه‌داری از تقویم کم
 * می‌شوند.
 */
const REGIONS: Record<string, { label: string; sunHours: number }> = {
  high: { label: 'یزد، کرمان، خراسان جنوبی، سمنان (پتانسیل بسیار بالا)', sunHours: 5.36 },
  good: { label: 'اصفهان، فارس، سیستان، خراسان رضوی، قم (پتانسیل بالا)', sunHours: 5.07 },
  mid: { label: 'تهران، مرکزی، آذربایجان، خوزستان، هرمزگان (پتانسیل متوسط)', sunHours: 4.64 },
  low: { label: 'گیلان، مازندران، گلستان، اردبیل (پتانسیل کمتر)', sunHours: 3.91 },
};

export const YIELD_BY_REGION: Record<
  string,
  { label: string; sunHours: number; kwhPerKw: number }
> = Object.fromEntries(
  Object.entries(REGIONS).map(([key, r]) => [
    key,
    { ...r, kwhPerKw: Math.round(r.sunHours * SUN_DAYS) },
  ]),
);
/**
 * نرخ فروش برق، به تومان بر کیلووات‌ساعت.
 *
 * `satba`  خرید تضمینی ۲۰ سالهٔ ساتبا. نرخ بر اساس ظرفیت پله‌ای است.
 * `bourse` فروش به صنایع از «تابلوی سبز» بورس انرژی. عدد زیر میانگین
 *          معاملات واقعی ماه‌های اخیر است، نه سقف تعرفه.
 * `self`   خودمصرفی صنعتی. درآمد مستقیم ندارد؛ ارزشش برابر هزینه‌ای است
 *          که صنعت دیگر پرداخت نمی‌کند — یعنی تعرفهٔ تجدیدپذیر صنایع.
 */
export const TARIFF = {
  satba: {
    small: 5_854, // تا ۲۰۰ کیلووات
    commercial: 4_639, // ۲۰۰ کیلووات تا ۱ مگاوات
    /* بالای ۱ مگاوات نرخ مصوب ندارد: جدول ۱۴۰۵ تا سقف ۱ مگاوات تعریف
       شده و پروژه‌های بزرگ‌تر از راه بورس انرژی یا مزایده قیمت‌گذاری
       می‌شوند. گذاشتن عدد قدیمی اینجا، بازگشت سرمایه را به‌غلط حدود
       ۱۸ سال نشان می‌داد. */
    utility: null,
  },
  /* میانگین معاملات تابلوی سبز در ماه‌های اخیر (۱۴۰۵)، نه سقف تعرفه.
     پیش‌تر اینجا عدد ۱۱٬۸۹۲ نشسته بود که تعرفهٔ تجدیدپذیر صنایع است —
     یعنی سقفی که صنعت در صورت نخریدن برق سبز می‌پردازد. آن عدد درآمد
     فروش در بورس را خوش‌بینانه‌تر از معاملهٔ واقعی نشان می‌داد.

     قیمت در بورس نوسان دارد: معاملات ۱۴۰۴ حوالی ۵٬۸۰۰ تومان بسته شد و
     در ۱۴۰۵ به حدود ۹٬۵۰۰ رسیده. این عدد را با هر گزارش تازهٔ بورس
     به‌روز کنید. */
  bourse: 9_500,
  /* سقف تابلوی سبز: صنعت مشمول حاضر است تا نزدیک همین عدد خرید کند،
     چون جایگزینش پرداخت تعرفهٔ تجدیدپذیر است. */
  bourseCeiling: 11_892,
  self: 11_892,
} as const;

/** افت سالانهٔ راندمان پنل */
export const DEGRADATION = 0.007;

/** هزینهٔ بهره‌برداری و نگه‌داری سالانه، نسبت به کل سرمایه */
export const OM_RATE = 0.015;

/** طول قرارداد خرید تضمینی و افق محاسبه */
export const YEARS = 20;

/** مساحت لازم به ازای هر کیلووات (مترمربع) */
export const AREA_PER_KW: Record<Mount, number> = {
  roof: 6,
  ground: 15,
};

/**
 * شیب استاندارد پنل روی پشت‌بام (درجه).
 *
 * تولید پشت‌بامی در این مدل بر مبنای همین شیب است. سقف شیب‌دار یا نصب
 * تخت روی بام، تولید را نسبت به این عدد کم می‌کند و برآورد را
 * خوش‌بینانه می‌کند — برای همین در صفحه نوشته می‌شود.
 */
export const ROOF_TILT_DEG = 30;

/**
 * مدت ساخت تا اتصال به شبکه (ماه).
 *
 * تا پیش از سنکرون‌شدن، نیروگاه هیچ درآمدی ندارد ولی سرمایه خوابیده
 * است. بازگشت سرمایه بدون این مدت، همیشه خوش‌بینانه‌تر از واقعیت است —
 * به‌خصوص برای نیروگاه زمینی که بیشتر وقتش صرف مجوز و اتصال می‌شود، نه
 * نصب پنل.
 */
export const CONSTRUCTION_MONTHS: Record<Scale, number> = {
  small: 2,
  commercial: 6,
  utility: 12,
};

/* ============================================================
   محاسبه
   ============================================================ */

/** مقیاس نیروگاه از روی ظرفیت */
export function scaleOf(capacityKw: number): Scale {
  if (capacityKw < 200) return 'small';
  if (capacityKw < 1000) return 'commercial';
  return 'utility';
}

export interface Assumptions {
  /**
   * تومان بر کیلووات — هزینهٔ کل احداث برای همین نوع نصب. تفاوت زمینی و
   * سقف از قبل در آن لحاظ شده؛ `costPerKwFor` پیش‌فرضش را می‌دهد.
   */
  costPerKw: number;
  /** کیلووات‌ساعت در سال به ازای هر کیلووات */
  yieldPerKw: number;
  mount: Mount;
  /** تومان بر کیلووات‌ساعت؛ اگر ندهید از نرخ پله‌ای ساتبا استفاده می‌شود */
  tariff?: number;
  omRate: number;
  degradation: number;
  years: number;
}

export interface YearRow {
  year: number;
  productionKwh: number;
  revenue: number;
  om: number;
  net: number;
  cumulative: number;
}

export interface Result {
  capacityKw: number;
  capexPerKw: number;
  scale: Scale;
  areaM2: number;
  tariff: number;
  firstYearProductionKwh: number;
  firstYearRevenue: number;
  firstYearNet: number;
  /**
   * سال بازگشت سرمایه از لحظهٔ اتصال به شبکه، اعشاری — یعنی بدون احتساب
   * مدت ساخت. اگر در افق محاسبه برنگردد null است.
   */
  paybackYears: number | null;
  /** همان بازگشت سرمایه، ولی از روز پرداخت پول: مدت ساخت هم رویش است */
  paybackWithBuildYears: number | null;
  /** مدت ساخت تا اتصال به شبکه (ماه) */
  constructionMonths: number;
  totalNet: number;
  /** بازده ساده سال اول، نسبت به سرمایه */
  firstYearReturn: number;
  rows: YearRow[];
}

/**
 * ظرفیت قابل احداث با سرمایهٔ داده‌شده.
 *
 * هزینهٔ هر کیلووات دیگر به مقیاس بستگی ندارد، پس یک تقسیم ساده است.
 * مقیاس فقط برای نرخ خرید تضمینی و مدت ساخت لازم می‌شود.
 */
export function capacityFor(
  investment: number,
  options: { mount: Mount; costPerKw?: number },
): {
  capacityKw: number;
  capexPerKw: number;
  scale: Scale;
} {
  const capexPerKw = options.costPerKw ?? costPerKwFor(options.mount);
  const capacityKw = investment / capexPerKw;
  return { capacityKw, capexPerKw, scale: scaleOf(capacityKw) };
}

export function calculate(investment: number, assumptions: Assumptions): Result {
  const { capacityKw, capexPerKw, scale } = capacityFor(investment, {
    mount: assumptions.mount,
    costPerKw: assumptions.costPerKw,
  });

  const tariff = assumptions.tariff ?? TARIFF.satba[scale] ?? TARIFF.bourse;
  /* تولید اسمی: پیش از افت. تولید سال اول کمی کمتر از این است، چون
     فرمول افت از همان سال اول اعمال می‌شود. */
  const nameplateKwh = capacityKw * assumptions.yieldPerKw;
  const annualOm = investment * assumptions.omRate;

  const rows: YearRow[] = [];
  let cumulative = 0;
  let paybackYears: number | null = null;

  for (let year = 1; year <= assumptions.years; year++) {
    /* توان n، نه n−۱: پنل از همان سال اول افت دارد، و فرمول مرجع هم
       (۰٫۹۹۳)^n نوشته می‌شود. یعنی سال اول ۰٫۷ درصد کمتر از توان اسمی. */
    const productionKwh = nameplateKwh * (1 - assumptions.degradation) ** year;
    const revenue = productionKwh * tariff;
    const net = revenue - annualOm;
    const before = cumulative;
    cumulative += net;

    /* سال بازگشت را با درون‌یابی حساب می‌کنیم، نه رُند به سال کامل: گفتن
       «۵٫۴ سال» صادقانه‌تر از «۶ سال» است وقتی سرمایه وسط سال برمی‌گردد. */
    if (paybackYears === null && cumulative >= investment && net > 0) {
      paybackYears = year - 1 + (investment - before) / net;
    }

    rows.push({ year, productionKwh, revenue, om: annualOm, net, cumulative });
  }

  const firstYear = rows[0]!;

  /* مدت ساخت درآمدی ندارد ولی پول از روز اول خوابیده است، پس فقط به
     بازگشت سرمایه اضافه می‌شود — نه اینکه سال‌های تولید را جابه‌جا کند. */
  const constructionMonths = CONSTRUCTION_MONTHS[scale];

  return {
    capacityKw,
    capexPerKw,
    scale,
    areaM2: capacityKw * AREA_PER_KW[assumptions.mount],
    tariff,
    firstYearProductionKwh: firstYear.productionKwh,
    firstYearRevenue: firstYear.revenue,
    firstYearNet: firstYear.net,
    paybackYears,
    paybackWithBuildYears: paybackYears === null ? null : paybackYears + constructionMonths / 12,
    constructionMonths,
    totalNet: cumulative,
    firstYearReturn: firstYear.net / investment,
    rows,
  };
}

/** فرض‌های پیش‌فرض برای یک حالت */
export function defaultAssumptions(mount: Mount, region: string): Assumptions {
  return {
    costPerKw: costPerKwFor(mount),
    yieldPerKw: (YIELD_BY_REGION[region] ?? YIELD_BY_REGION.good!).kwhPerKw,
    mount,
    omRate: OM_RATE,
    degradation: DEGRADATION,
    years: YEARS,
  };
}

/* ============================================================
   روش‌های فروش برق
   ============================================================ */

export interface RouteInfo {
  key: Route;
  title: string;
  tariffLabel: string;
  summary: string;
  pros: string[];
  cons: string[];
}

export const ROUTES: RouteInfo[] = [
  {
    key: 'satba',
    title: 'خرید تضمینی ساتبا',
    tariffLabel: 'نرخ مصوب، پله‌ای بر اساس ظرفیت',
    summary:
      'قرارداد ۲۰ ساله با سازمان انرژی‌های تجدیدپذیر. برق تولیدی با نرخ مصوب خریداری می‌شود و خریدار دولت است.',
    pros: [
      'درآمد قابل پیش‌بینی برای ۲۰ سال',
      'نیازی به پیدا کردن مشتری نیست',
      'مسیر اداری جاافتاده و شناخته‌شده',
    ],
    cons: [
      'نرخ آن از فروش در بورس پایین‌تر است',
      'تعدیل نرخ تابع مصوبه است و قطعی نیست',
      'تأخیر در پرداخت در سال‌های گذشته سابقه داشته',
    ],
  },
  {
    key: 'bourse',
    title: 'فروش در بورس انرژی (تابلوی سبز)',
    tariffLabel: 'توافقی؛ مبنا: میانگین معاملات تابلوی سبز در ماه‌های اخیر',
    summary:
      'برق مستقیم به صنایع فروخته می‌شود. صنایع بالای یک مگاوات موظف‌اند بخشی از برقشان را تجدیدپذیر تأمین کنند، و همین تقاضا را می‌سازد.',
    pros: [
      'نرخ به‌مراتب بالاتر از خرید تضمینی',
      'امکان بستن قرارداد بلندمدت مستقیم با صنعت',
      'نرخ با بازار حرکت می‌کند و در تورم عقب نمی‌ماند',
    ],
    cons: [
      'قیمت تضمین‌شده نیست و نوسان دارد',
      'نیازمند یافتن خریدار و مذاکره است',
      'فرایند پذیرش در بورس پیچیده‌تر است',
    ],
  },
  {
    key: 'self',
    title: 'خودمصرفی صنعتی (ماده ۱۶)',
    tariffLabel: 'ارزش برابر با هزینه‌ای که پرداخت نمی‌شود',
    summary:
      'صنعت برای خودش نیروگاه می‌سازد. درآمد مستقیم ندارد، ولی از پرداخت تعرفهٔ تجدیدپذیر و بخشی از قبض برق معاف می‌شود.',
    pros: [
      'بالاترین ارزش به ازای هر کیلووات‌ساعت',
      'مصون از ریسک پرداخت و خریدار',
      'کاهش وابستگی به شبکه و قطعی برق',
    ],
    cons: [
      'فقط برای صنایع با مصرف بالا معنا دارد',
      'ارزشش به تعرفهٔ برق صنعتی گره خورده که متغیر است',
      'تولید و مصرف باید از نظر زمانی هم‌خوان باشند',
    ],
  },
];

/* ============================================================
   منابع
   ============================================================ */

export const SOURCES = [
  {
    label: 'ساتبا — تعرفه‌های خرید تضمینی برق تجدیدپذیر',
    url: 'https://www.satba.gov.ir/fa/guidance/guidance/guidance1-%D8%AA%D8%B9%D8%B1%D9%81%D9%87-%D9%87%D8%A7%DB%8C-%D8%AE%D8%B1%DB%8C%D8%AF-%D8%AA%D8%B6%D9%85%DB%8C%D9%86%DB%8C-%D8%A8%D8%B1%D9%82-%D8%A7%D8%B2-%D8%AA%D8%AC%D8%AF%DB%8C%D8%AF%D9%BE%D8%B0%DB%8C%D8%B1%D9%87%D8%A7',
    note: 'مرجع رسمی نرخ خرید تضمینی',
  },
  {
    label: 'بورس انرژی ایران — تابلوی سبز',
    url: 'https://www.irenex.ir/',
    note: 'مرجع نرخ فروش در بورس؛ عدد مدل میانگین معاملات ماه‌های اخیر است',
  },
  {
    label: 'اطلس جهانی خورشید — نقشهٔ پتانسیل فتوولتائیک ایران',
    url: 'https://globalsolaratlas.info/download/iran',
    note: 'مبنای گروه‌بندی مناطق بر اساس PVOUT، نه تابش',
  },
  {
    label: 'شانا — تعرفهٔ تجدیدپذیر صنایع، مهر ۱۴۰۵',
    url: 'https://www.shana.ir/news/2629055/%D8%AA%D8%B9%D8%B1%D9%81%D9%87-%D8%AA%D8%AC%D8%AF%DB%8C%D8%AF%D9%BE%D8%B0%DB%8C%D8%B1-%D8%B5%D9%86%D8%A7%DB%8C%D8%B9-%D8%A7%D8%B9%D9%84%D8%A7%D9%85-%D8%B4%D8%AF',
    note: 'مبنای نرخ بورس و خودمصرفی: ۱۱۸٬۹۱۷ ریال بر کیلووات‌ساعت',
  },
  {
    label: 'خبرگزاری مهر — کسب درآمد از فروش برق خورشیدی در ۱۴۰۵',
    url: 'https://www.mehrnews.com/news/6834508',
    note: 'نرخ‌های ۱۴۰۵ و برآورد درآمد',
  },
  {
    label: 'ماناسازان — راهنمای سرمایه‌گذاری نیروگاه خورشیدی ۱۴۰۵',
    url: 'https://manasazan.ir/%D8%B3%D8%B1%D9%85%D8%A7%DB%8C%D9%87-%DA%AF%D8%B0%D8%A7%D8%B1%DB%8C-%D9%86%DB%8C%D8%B1%D9%88%DA%AF%D8%A7%D9%87-%D8%AE%D9%88%D8%B1%D8%B4%DB%8C%D8%AF%DB%8C-1405/',
    note: 'زمین موردنیاز و دورهٔ بازگشت',
  },
  {
    label: 'اکوایران — ابلاغ نرخ جدید خرید تضمینی',
    url: 'https://ecoiran.com/%D8%A8%D8%AE%D8%B4-%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1-%D8%A7%D9%86%D8%B1%DA%98%DB%8C-130/88842',
    note: 'جزئیات پله‌های ظرفیت',
  },
] as const;

/** تاریخ آخرین به‌روزرسانی فرض‌ها — در صفحه نمایش داده می‌شود */
export const UPDATED_AT = 'مهر ۱۴۰۵';
