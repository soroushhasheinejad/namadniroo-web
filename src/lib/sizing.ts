import { AREA_PER_KW, DEGRADATION, YIELD_BY_REGION, costRangeFor, type Mount } from '../data/solarModel';

/**
 * ابعاد تجهیزات نیروگاه خورشیدی: چند پنل، چه اینورتری، چه رشته‌بندی‌ای،
 * چه باتری‌ای. پشتوانهٔ صفحهٔ /solar-calculator/equipment.
 *
 * مشخصات الکتریکی پنل‌ها از دیتاشیت رسمی AE Solar (data/aesolarModels.ts)
 * می‌آید و تولید از همان ضریب منطقه‌ای ماشین‌حساب سرمایه‌گذاری، تا دو
 * ابزار سایت یک عدد بدهند. هر چیزی که به مدل دقیق اینورتر بستگی دارد
 * (بازهٔ ولتاژ MPPT) «رایج» است و صفحه همین را صریح می‌گوید.
 *
 * تابع‌ها خالص‌اند و در مرورگر اجرا می‌شوند.
 */

export interface PanelSpec {
  key: string;
  label: string;
  w: number;
  voc: number;
  vmp: number;
  isc: number;
  /** ضریب دمایی Voc، درصد بر درجه (منفی) */
  tempVoc: number;
  /** مساحت یک پنل، مترمربع */
  areaM2: number;
  bifacial: boolean;
  /** صفحهٔ محصول یا مدل */
  href: string;
}

export type Mode = 'bill' | 'area' | 'power';
export type System = 'grid' | 'hybrid';
export type PhasePref = 'auto' | 'single' | 'three';

export interface SizingInput {
  mode: Mode;
  /** مصرف ماهانه از قبض، کیلووات‌ساعت */
  monthlyKwh: number;
  /** چند درصد مصرف را پوشش دهد */
  coverage: number;
  /** سطح بدون سایه، مترمربع */
  areaM2: number;
  /** توان پنل‌ها، کیلووات */
  targetKw: number;
  system: System;
  mount: Mount;
  region: string;
  phase: PhasePref;
  panel: PanelSpec;
  /** بار ضروری در قطعی، کیلووات (فقط هیبرید) */
  backupKw: number;
  /** ساعت پشتیبانی در قطعی (فقط هیبرید) */
  backupHours: number;
}

/** اندازه‌های رایج اینورتر در بازار، کیلووات */
export const INVERTER_SIZES = [3, 3.6, 5, 6, 8, 10, 12, 15, 17, 20, 25, 30, 36, 40, 50, 60, 75, 100, 110, 125];
/** بالاتر از این توان، چند اینورتر ۱۰۰ کیلوواتی به‌جای یکی */
const UNIT_KW = 100;

/** نسبت توان پنل به توان اینورتر */
export const DC_AC = { grid: 1.15, hybrid: 1.1 } as const;

/** باتری لیتیوم‌آهن‌فسفات رایج ۴۸ ولت ۱۰۰ آمپرساعت */
export const BATTERY = { moduleKwh: 5.12, dod: 0.9, efficiency: 0.95 } as const;

/**
 * کمینهٔ دمای هوا (سرمای زمستان، برای ولتاژ مدار باز) و دمای سلول در
 * گرمای تابستان. محافظه‌کارانه، چون ولتاژ بیش از حد اینورتر را می‌سوزاند.
 */
export const CLIMATE: Record<string, { tMin: number; tilt: [number, number] }> = {
  high: { tMin: -10, tilt: [30, 35] },
  good: { tMin: -10, tilt: [30, 36] },
  mid: { tMin: -20, tilt: [27, 38] },
  low: { tMin: -5, tilt: [36, 38] },
};
export const CELL_T_MAX = 70;

export interface DcWindow { label: string; vMax: number; mpptMin: number; mpptMax: number }

/** بازهٔ ولتاژ ورودی رایج هر ردهٔ اینورتر */
export function dcWindow(system: System, phase: 'single' | 'three', acKw: number): DcWindow {
  if (phase === 'single') {
    return system === 'hybrid'
      ? { label: 'هیبرید تک‌فاز', vMax: 500, mpptMin: 125, mpptMax: 425 }
      : { label: 'تک‌فاز متصل به شبکه', vMax: 600, mpptMin: 90, mpptMax: 550 };
  }
  if (acKw <= 30) return { label: 'سه‌فاز تا ۳۰ کیلووات', vMax: 1000, mpptMin: 200, mpptMax: 850 };
  return { label: 'سه‌فاز تجاری و نیروگاهی', vMax: 1100, mpptMin: 200, mpptMax: 1000 };
}

export interface Strings {
  /** کمینه و بیشینهٔ پنل در یک رشته */
  nMin: number;
  nMax: number;
  count: number;
  perString: number;
  /** ولتاژ مدار باز رشته در سرما و ولتاژ کاری در گرما */
  vocCold: number;
  vmpHot: number;
  /** جریان طراحی کابل هر رشته (Isc × ۱٫۲۵) */
  designCurrent: number;
  /** پنل‌ها کمتر از کمینهٔ یک رشته‌اند */
  tooFew: boolean;
}

export function stringsFor(panel: PanelSpec, panels: number, win: DcWindow, tMin: number): Strings {
  const k = Math.abs(panel.tempVoc) / 100;
  const vocCold = panel.voc * (1 + k * (25 - tMin));
  const vmpCold = panel.vmp * (1 + k * (25 - tMin));
  const vmpHot = panel.vmp * (1 - k * (CELL_T_MAX - 25));
  const nMax = Math.max(1, Math.min(Math.floor(win.vMax / vocCold), Math.floor(win.mpptMax / vmpCold)));
  const nMin = Math.max(1, Math.ceil(win.mpptMin / vmpHot));
  const designCurrent = panel.isc * 1.25;
  if (panels < nMin) {
    return { nMin, nMax, count: 1, perString: panels, vocCold, vmpHot, designCurrent, tooFew: true };
  }
  let count = Math.ceil(panels / nMax);
  let perString = Math.ceil(panels / count);
  /* رشته‌ها هم‌اندازه می‌مانند؛ اگر تقسیم برابر به زیر کمینه رسید، رشتهٔ کمتر */
  while (perString < nMin && count > 1) {
    count -= 1;
    perString = Math.ceil(panels / count);
  }
  return { nMin, nMax, count, perString, vocCold, vmpHot, designCurrent, tooFew: false };
}

export interface Sizing {
  /** توان پنل‌های لازم پیش از گرد کردن، کیلووات */
  neededKw: number;
  panels: number;
  /** توان واقعی آرایه بعد از گرد کردن به عدد پنل */
  arrayKw: number;
  phase: 'single' | 'three';
  phaseNote: string | null;
  inverter: { units: number; unitKw: number; totalKw: number; ratio: number };
  window: DcWindow;
  strings: Strings;
  battery: { usableKwh: number; nominalKwh: number; modules: number } | null;
  /** مساحت لازم با فاصلهٔ ردیف‌ها، و سطح خود پنل‌ها */
  footprintM2: number;
  panelAreaM2: number;
  tilt: [number, number];
  firstYearKwh: number;
  monthlyKwh: number;
  /** درصد پوشش مصرف ماهانه — فقط از روی قبض */
  coveragePct: number | null;
  cost: { min: number; max: number };
}

export function size(input: SizingInput): Sizing {
  const yieldPerKw = (YIELD_BY_REGION[input.region] ?? YIELD_BY_REGION.high!).kwhPerKw;
  const climate = CLIMATE[input.region] ?? CLIMATE.high!;
  const p = input.panel;

  let neededKw: number;
  if (input.mode === 'bill') neededKw = (input.monthlyKwh * 12 * (input.coverage / 100)) / (yieldPerKw * (1 - DEGRADATION));
  else if (input.mode === 'area') neededKw = input.areaM2 / AREA_PER_KW[input.mount];
  else neededKw = input.targetKw;
  neededKw = Math.max(0, neededKw);

  /* سطح محدود است: پنل‌ها از سطح بیرون نمی‌زنند، پس گرد به پایین؛ در دو
     حالت دیگر نیاز باید کامل پوشش داده شود، پس گرد به بالا. */
  const exact = (neededKw * 1000) / p.w;
  const panelsRaw = input.mode === 'area' ? Math.floor(exact + 1e-9) : Math.ceil(exact - 1e-9);

  /* توان اینورتر: از نسبت DC به AC، و در هیبرید دست‌کم به اندازهٔ بار ضروری */
  const draftKw = (Math.max(panelsRaw, 1) * p.w) / 1000;
  let acNeed = draftKw / DC_AC[input.system];
  if (input.system === 'hybrid') acNeed = Math.max(acNeed, input.backupKw);

  const autoPhase: 'single' | 'three' = acNeed <= 6 ? 'single' : 'three';
  let phase = input.phase === 'auto' ? autoPhase : input.phase;
  let phaseNote: string | null = null;
  if (phase === 'single' && acNeed > 10) {
    phase = 'three';
    phaseNote = 'برای این توان اینورتر تک‌فاز ساخته نمی‌شود؛ انشعاب سه‌فاز لازم است.';
  } else if (input.phase === 'auto' && acNeed > 5 && acNeed <= 8) {
    phaseNote = autoPhase === 'single'
      ? 'این توان معمولاً روی انشعاب تک‌فاز ممکن است، ولی توان مجاز انشعاب خودتان را از شرکت توزیع بپرسید.'
      : 'در این توان، بسته به انشعاب، تک‌فاز هم ممکن است؛ توان مجاز انشعاب را از شرکت توزیع بپرسید.';
  }

  let units = 1;
  let unitKw = INVERTER_SIZES.find((s) => s >= acNeed - 1e-9) ?? UNIT_KW;
  if (acNeed > INVERTER_SIZES[INVERTER_SIZES.length - 1]!) {
    units = Math.ceil(acNeed / UNIT_KW);
    unitKw = UNIT_KW;
  }
  const window = dcWindow(input.system, phase, unitKw);
  const strings = stringsFor(p, panelsRaw, window, climate.tMin);
  /* رشته‌های هم‌اندازه ممکن است چند پنل اضافه کنند؛ در حالت سطح محدود نه */
  const panels = strings.tooFew || input.mode === 'area' ? panelsRaw : strings.count * strings.perString;
  const arrayKw = (panels * p.w) / 1000;
  const totalKw = units * unitKw;

  let battery: Sizing['battery'] = null;
  if (input.system === 'hybrid') {
    const usableKwh = input.backupKw * input.backupHours;
    const nominalKwh = usableKwh / BATTERY.dod / BATTERY.efficiency;
    battery = { usableKwh, nominalKwh, modules: Math.max(1, Math.ceil(nominalKwh / BATTERY.moduleKwh - 1e-9)) };
  }

  const firstYearKwh = arrayKw * yieldPerKw * (1 - DEGRADATION);
  const range = costRangeFor(input.mount);

  return {
    neededKw,
    panels,
    arrayKw,
    phase,
    phaseNote,
    inverter: { units, unitKw, totalKw, ratio: totalKw ? arrayKw / totalKw : 0 },
    window,
    strings,
    battery,
    footprintM2: arrayKw * AREA_PER_KW[input.mount],
    panelAreaM2: panels * p.areaM2,
    tilt: climate.tilt,
    firstYearKwh,
    monthlyKwh: firstYearKwh / 12,
    coveragePct: input.mode === 'bill' && input.monthlyKwh > 0 ? (firstYearKwh / 12 / input.monthlyKwh) * 100 : null,
    cost: { min: arrayKw * range.min, max: arrayKw * range.max },
  };
}
