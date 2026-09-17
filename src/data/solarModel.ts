/**
 * مدل تقریبی اقتصاد نیروگاه خورشیدی.
 *
 * این فایل منبع همهٔ عددهای ماشین‌حساب صفحهٔ «برآورد سرمایه‌گذاری» است.
 * عمداً از خود صفحه جدا شده تا هم در تست بررسی شود، هم وقتی نرخ‌ها عوض
 * می‌شوند (که در ایران زیاد اتفاق می‌افتد) فقط همین یک فایل به‌روز شود.
 *
 * ── دربارهٔ دقت ─────────────────────────────────────────────────────
 * خروجی این مدل «برآورد» است، نه طرح توجیهی. منابع منتشرشدهٔ داخلی در
 * مورد هزینهٔ احداث با هم اختلاف زیادی دارند، چون:
 *
 *   • قیمت تجهیزات به نرخ ارز گره خورده و ماه‌به‌ماه عوض می‌شود
 *   • بعضی منابع فقط تجهیزات و نصب را حساب می‌کنند و بعضی زمین، پست و
 *     خط انتقال را هم اضافه می‌کنند — که برای نیروگاه زمینی می‌تواند
 *     نزدیک نیمی از کل سرمایه باشد
 *   • تاریخ انتشار منابع یکی نیست و نرخ‌ها بین آن‌ها جهش داشته
 *
 * برای همین هر عدد به‌صورت بازه تعریف شده و خروجی هم بازه است، نه یک
 * عدد قطعی. کاربر می‌تواند همهٔ فرض‌ها را عوض کند.
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
 * هزینهٔ تجهیزات و نصب، به تومان بر کیلووات.
 *
 * شامل پنل، اینورتر، سازه، کابل، تابلو و اجرا — یعنی چیزی که در هر دو
 * مقیاس پشت‌بامی و زمینی مشترک است.
 */
export const EQUIPMENT_COST: Record<Scale, Range> = {
  small: { min: 30_000_000, typical: 38_000_000, max: 48_000_000 },
  commercial: { min: 28_000_000, typical: 35_000_000, max: 44_000_000 },
  utility: { min: 26_000_000, typical: 33_000_000, max: 40_000_000 },
};

/*
 * چرا این اعداد و نه اعداد پایین‌تری که در بعضی مقاله‌ها می‌بینید:
 *
 * منابع مقیاس کوچک گاهی رقم‌هایی حدود ۲۵ میلیون بر کیلووات می‌دهند، ولی
 * همان منابع نیروگاه یک مگاواتی را ۶۰ تا ۸۰ میلیارد تومان برآورد می‌کنند —
 * یعنی ۶۰ تا ۸۰ میلیون بر کیلووات. این دو با هم نمی‌خوانند، چون مقیاس
 * بزرگ‌تر باید ارزان‌تر تمام شود نه گران‌تر.
 *
 * وقتی هزینهٔ محوطه (زمین، پست، خط انتقال) را که فقط نیروگاه زمینی دارد
 * از رقم مگاواتی جدا کنیم، تجهیزات حدود ۳۵ میلیون بر کیلووات در می‌آید.
 * همین عدد، دورهٔ بازگشت خانگی را هم به حدود ۳٫۵ سال می‌رساند که با
 * برآورد منتشرشده می‌خواند. پس این مبنا با هر دو سر طیف سازگار است،
 * برخلاف عدد ۲۵ میلیون که فقط با یک سرش می‌خواند.
 */

/**
 * هزینهٔ محوطه: زمین، پست، خط انتقال، محوطه‌سازی، حصار و مجوزها.
 *
 * فقط نیروگاه زمینی این‌ها را دارد و دلیل اصلی فاصلهٔ عددهای منتشرشده
 * است: نیروگاه مگاواتی حدود ۶۰ تا ۸۰ میلیارد تومان برآورد می‌شود
 * (یعنی ۶۰ تا ۸۰ میلیون بر کیلووات) در حالی که تجهیزاتش به‌تنهایی
 * حدود ۲۵ میلیون بر کیلووات است.
 *
 * این رقم به موقعیت زمین و فاصله تا شبکه بسیار حساس است.
 */
export const SITE_COST: Range = {
  min: 15_000_000,
  typical: 35_000_000,
  max: 55_000_000,
};

/**
 * تولید سالانهٔ هر کیلووات ظرفیت نصب‌شده (کیلووات‌ساعت).
 *
 * «ویژهٔ تولید» نامیده می‌شود و به تابش منطقه بستگی دارد. اعداد زیر
 * خروجی خالص‌اند: افت گرما، غبار، کابل و اینورتر در آن‌ها لحاظ شده.
 */
export const YIELD_BY_REGION: Record<string, { label: string; kwhPerKw: number }> = {
  high: { label: 'کرمان، یزد، سیستان (تابش بسیار بالا)', kwhPerKw: 1850 },
  good: { label: 'اصفهان، فارس، خراسان، سمنان (تابش بالا)', kwhPerKw: 1750 },
  mid: { label: 'تهران، مرکزی، آذربایجان (تابش متوسط)', kwhPerKw: 1600 },
  low: { label: 'گیلان، مازندران، اردبیل (تابش کمتر)', kwhPerKw: 1350 },
};

/**
 * نرخ فروش برق، به تومان بر کیلووات‌ساعت.
 *
 * `satba`  خرید تضمینی ۲۰ سالهٔ ساتبا. نرخ بر اساس ظرفیت پله‌ای است.
 * `bourse` فروش به صنایع از «تابلوی سبز» بورس انرژی. نرخ توافقی است و
 *          عدد زیر فقط یک مبنای مقایسه است: تعرفهٔ تجدیدپذیری که صنایع
 *          مشمول در صورت نخریدن برق سبز باید بپردازند.
 * `self`   خودمصرفی صنعتی. درآمد مستقیم ندارد؛ ارزشش برابر هزینه‌ای است
 *          که صنعت دیگر پرداخت نمی‌کند.
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
  /* این نرخ سقف است نه قیمت قطعی: تعرفه‌ای که صنایع مشمول در صورت
     نخریدن برق سبز باید بپردازند، و طبیعتاً حاضرند تا نزدیک همین عدد
     خرید کنند. قیمت واقعی توافقی و معمولاً پایین‌تر است. */
  bourse: 11_892,
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
  /** تومان بر کیلووات — تجهیزات و نصب */
  equipmentCostPerKw: number;
  /** تومان بر کیلووات — زمین و اتصال به شبکه (فقط زمینی) */
  siteCostPerKw: number;
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
  /** سال بازگشت سرمایه، اعشاری. اگر در افق محاسبه برنگردد null است. */
  paybackYears: number | null;
  totalNet: number;
  /** بازده ساده سال اول، نسبت به سرمایه */
  firstYearReturn: number;
  rows: YearRow[];
}

/**
 * ظرفیت قابل احداث با سرمایهٔ داده‌شده.
 *
 * نکتهٔ ظریف: هزینهٔ هر کیلووات به مقیاس بستگی دارد و مقیاس خودش از
 * ظرفیت می‌آید — یعنی یک وابستگی حلقوی. با چند بار تکرار به جواب
 * پایدار می‌رسیم؛ سه دور همیشه کافی است چون پله‌ها فقط سه‌تا هستند.
 */
export function capacityFor(
  investment: number,
  options: { mount: Mount; equipmentCostPerKw?: number; siteCostPerKw?: number },
): { capacityKw: number; capexPerKw: number; scale: Scale } {
  let scale: Scale = 'commercial';

  for (let i = 0; i < 3; i++) {
    const equipment = options.equipmentCostPerKw ?? EQUIPMENT_COST[scale].typical;
    const site = options.mount === 'ground' ? (options.siteCostPerKw ?? SITE_COST.typical) : 0;
    const capexPerKw = equipment + site;
    const capacityKw = investment / capexPerKw;
    const next = scaleOf(capacityKw);

    if (next === scale || i === 2) return { capacityKw, capexPerKw, scale: next };
    scale = next;
  }

  /* c8 ignore next */
  throw new Error('unreachable');
}

export function calculate(investment: number, assumptions: Assumptions): Result {
  const { capacityKw, capexPerKw, scale } = capacityFor(investment, {
    mount: assumptions.mount,
    equipmentCostPerKw: assumptions.equipmentCostPerKw,
    siteCostPerKw: assumptions.siteCostPerKw,
  });

  const tariff = assumptions.tariff ?? TARIFF.satba[scale] ?? TARIFF.bourse;
  const firstYearProductionKwh = capacityKw * assumptions.yieldPerKw;
  const annualOm = investment * assumptions.omRate;

  const rows: YearRow[] = [];
  let cumulative = 0;
  let paybackYears: number | null = null;

  for (let year = 1; year <= assumptions.years; year++) {
    const productionKwh = firstYearProductionKwh * (1 - assumptions.degradation) ** (year - 1);
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

  return {
    capacityKw,
    capexPerKw,
    scale,
    areaM2: capacityKw * AREA_PER_KW[assumptions.mount],
    tariff,
    firstYearProductionKwh,
    firstYearRevenue: firstYear.revenue,
    firstYearNet: firstYear.net,
    paybackYears,
    totalNet: cumulative,
    firstYearReturn: firstYear.net / investment,
    rows,
  };
}

/** فرض‌های پیش‌فرض برای یک حالت */
export function defaultAssumptions(mount: Mount, region: string): Assumptions {
  return {
    equipmentCostPerKw: EQUIPMENT_COST.commercial.typical,
    siteCostPerKw: SITE_COST.typical,
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
    tariffLabel: 'توافقی؛ مبنای مقایسه: تعرفهٔ تجدیدپذیر صنایع',
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
    note: 'هزینهٔ احداث مگاواتی، زمین موردنیاز و دورهٔ بازگشت',
  },
  {
    label: 'اکوایران — ابلاغ نرخ جدید خرید تضمینی',
    url: 'https://ecoiran.com/%D8%A8%D8%AE%D8%B4-%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1-%D8%A7%D9%86%D8%B1%DA%98%DB%8C-130/88842',
    note: 'جزئیات پله‌های ظرفیت',
  },
] as const;

/** تاریخ آخرین به‌روزرسانی فرض‌ها — در صفحه نمایش داده می‌شود */
export const UPDATED_AT = 'شهریور ۱۴۰۵';
