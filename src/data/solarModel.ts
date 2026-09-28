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
 * زمین، محوطه‌سازی و حصار — تومان بر کیلووات، فقط نیروگاه زمینی.
 *
 * این بخش با ظرفیت بزرگ می‌شود، چون مساحت لازم با ظرفیت بزرگ می‌شود:
 * هر مگاوات حدود یک‌ونیم تا دو هکتار زمین می‌خواهد.
 */
export const LAND_COST: Range = {
  min: 6_000_000,
  typical: 15_000_000,
  max: 26_000_000,
};

/**
 * پست، خط انتقال و مجوزهای اتصال به شبکه — مبلغ ثابت به تومان.
 *
 * ── چرا ثابت است و ضریب نمی‌خورد ────────────────────────────────────
 * پیش‌تر این هزینه هم مثل زمین «بر کیلووات» حساب می‌شد، در حالی که
 * عددش از یک نیروگاه یک‌مگاواتی در آمده بود. نتیجه‌اش این بود که
 * نیروگاه ده‌مگاواتی ده برابر هزینهٔ پست می‌گرفت، که غلط است: پست و خط
 * انتقال یک بار ساخته می‌شوند و هزینه‌شان به فاصله تا شبکه و سطح ولتاژ
 * بستگی دارد، نه به اینکه چند پنل پشتش نصب شده.
 *
 * اثر عملی‌اش این است که نیروگاه بزرگ‌تر، این هزینه را روی ظرفیت بیشتری
 * سرشکن می‌کند و ارزان‌تر تمام می‌شود — همان صرفهٔ مقیاسی که در پروژه‌های
 * واقعی دیده می‌شود.
 */
export const GRID_COST: Range = {
  min: 12_000_000_000,
  typical: 20_000_000_000,
  max: 32_000_000_000,
};

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
  /** تومان بر کیلووات — تجهیزات و نصب */
  equipmentCostPerKw: number;
  /** تومان بر کیلووات — زمین و محوطه‌سازی (فقط زمینی) */
  landCostPerKw: number;
  /** تومان — پست و خط انتقال، مبلغ ثابت و مستقل از ظرفیت (فقط زمینی) */
  gridCost: number;
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
  /** سرمایه کفاف پست و خط انتقال را نمی‌دهد، پس نیروگاه زمینی ممکن نیست */
  belowGridCost: boolean;
  /** تفکیک سرمایه: تجهیزات، زمین، اتصال به شبکه (تومان) */
  capex: { equipment: number; land: number; grid: number };
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
  options: { mount: Mount; equipmentCostPerKw?: number; landCostPerKw?: number; gridCost?: number },
): {
  capacityKw: number;
  capexPerKw: number;
  scale: Scale;
  belowGridCost: boolean;
  capex: { equipment: number; land: number; grid: number };
} {
  const ground = options.mount === 'ground';
  const grid = ground ? (options.gridCost ?? GRID_COST.typical) : 0;

  /* پست و خط انتقال پیش از اولین پنل ساخته می‌شوند، پس از سرمایه کم
     می‌شوند و بقیه صرف ظرفیت می‌شود. اگر سرمایه از همین هم کمتر باشد،
     نیروگاه زمینی اصلاً شکل نمی‌گیرد — و این را باید گفت، نه اینکه
     ظرفیت منفی نشان داده شود. */
  const forCapacity = investment - grid;
  if (forCapacity <= 0) {
    return {
      capacityKw: 0,
      capexPerKw: 0,
      scale: 'small',
      belowGridCost: true,
      capex: { equipment: 0, land: 0, grid },
    };
  }

  let scale: Scale = 'commercial';

  for (let i = 0; i < 3; i++) {
    const equipment = options.equipmentCostPerKw ?? EQUIPMENT_COST[scale].typical;
    const land = ground ? (options.landCostPerKw ?? LAND_COST.typical) : 0;
    const perKw = equipment + land;
    const capacityKw = forCapacity / perKw;
    const next = scaleOf(capacityKw);

    if (next === scale || i === 2) {
      return {
        capacityKw,
        /* هزینهٔ واقعی هر کیلووات، با سرشکن‌شدن پست و خط انتقال روی
           همین ظرفیت — همان عددی که پروژه با آن مقایسه می‌شود. */
        capexPerKw: investment / capacityKw,
        scale: next,
        belowGridCost: false,
        capex: { equipment: capacityKw * equipment, land: capacityKw * land, grid },
      };
    }
    scale = next;
  }

  /* c8 ignore next */
  throw new Error('unreachable');
}

export function calculate(investment: number, assumptions: Assumptions): Result {
  const { capacityKw, capexPerKw, scale, belowGridCost, capex } = capacityFor(investment, {
    mount: assumptions.mount,
    equipmentCostPerKw: assumptions.equipmentCostPerKw,
    landCostPerKw: assumptions.landCostPerKw,
    gridCost: assumptions.gridCost,
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
    belowGridCost,
    capex,
    rows,
  };
}

/** فرض‌های پیش‌فرض برای یک حالت */
export function defaultAssumptions(mount: Mount, region: string): Assumptions {
  return {
    equipmentCostPerKw: EQUIPMENT_COST.commercial.typical,
    landCostPerKw: LAND_COST.typical,
    gridCost: GRID_COST.typical,
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
