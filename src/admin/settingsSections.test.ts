import { describe, expect, it } from 'vitest';
import { type Field, ROOT, childName, parseForm, rowName } from './fields';
import { SECTIONS } from './settingsSections';
import * as defaults from '../data/siteContent';

/**
 * همان کاری که مرورگر می‌کند: مقدار را در فیلدهای فرم می‌گذارد، به همان
 * ترتیبی که FieldView نمایششان می‌دهد.
 */
function toEntries(field: Field, value: unknown, name: string, out: [string, string][]): void {
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
  switch (field.kind) {
    case 'text':
    case 'textarea':
    case 'select':
    case 'image':
      out.push([name, value == null ? '' : String(value)]);
      return;
    case 'lines':
      out.push([name, Array.isArray(value) ? value.join('\n') : '']);
      return;
    case 'checkbox':
      if (value === true) out.push([name, '1']);
      return;
    case 'group':
      for (const f of field.fields) toEntries(f, obj(value)[f.key], childName(name, f.key), out);
      return;
    case 'list':
      (Array.isArray(value) ? value : []).forEach((row, i) => {
        for (const f of field.item) toEntries(f, obj(row)[f.key], childName(rowName(name, `r${i}`), f.key), out);
      });
      return;
  }
}

function roundTrip(key: string, stored: unknown): unknown {
  const section = SECTIONS.find((s) => s.key === key)!;
  const formValue = section.toForm ? section.toForm(stored) : stored;
  const entries: [string, string][] = [];
  toEntries(section.root, formValue, ROOT, entries);
  const form = new FormData();
  for (const [k, v] of entries) form.append(k, v);
  const parsed = parseForm(section.root, form);
  return section.fromForm ? section.fromForm(parsed) : parsed;
}

/** مقدار خالی، null و نبود یکی حساب می‌شوند — در سایت هر سه یعنی «ندارد» */
function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === '' || v === false || v === undefined || v === null) continue;
      out[k] = comparable(v);
    }
    return out;
  }
  return value;
}

describe('ذخیرهٔ بی‌تغییر هیچ چیزی را عوض نمی‌کند', () => {
  /* قید اصلی پنل: ویراستاری که فرم را باز می‌کند و بدون دست‌زدن «ذخیره»
     می‌زند، نباید حتی یک حرف از سایت را عوض کند. */
  const cases: [string, unknown][] = [
    ['site', defaults.site],
    ['nav', defaults.nav],
    ['stats', defaults.stats],
    ['promoSlides', defaults.promoSlides],
    ['areas', defaults.areas],
    ['timeline', defaults.timeline],
    ['capabilities', defaults.capabilities],
    ['brands', defaults.brands],
    ['clients', defaults.clients],
    ['portfolio', defaults.portfolio],
    ['robots', 'User-agent: *\nAllow: /'],
  ];

  it('همهٔ بخش‌های تعریف‌شده پوشش داده شده‌اند', () => {
    expect(cases.map(([k]) => k).sort()).toEqual(SECTIONS.map((s) => s.key).sort());
  });

  for (const [key, value] of cases) {
    it(key, () => {
      expect(comparable(roundTrip(key, value))).toEqual(comparable(value));
    });
  }
});

describe('آمار', () => {
  it('متن رقمی مثل سال تأسیس را متن نگه می‌دارد', () => {
    /* باگ نسخهٔ اول: «۱۳۸۷» و «۲» چون رقمی بودند به شمارندهٔ متحرک تبدیل
       می‌شدند و سال تأسیس از صفر شمرده می‌شد. */
    const out = roundTrip('stats', defaults.stats) as Record<string, unknown>[];
    expect(out[2]).toMatchObject({ text: '۲' });
    expect(out[2]).not.toHaveProperty('value');
    expect(out[3]).toMatchObject({ text: '۱۳۸۷' });
    expect(out[3]).not.toHaveProperty('value');
  });

  it('عدد شمارشی را عدد نگه می‌دارد', () => {
    const out = roundTrip('stats', defaults.stats) as Record<string, unknown>[];
    expect(out[0]).toMatchObject({ value: 70, unit: 'MW' });
    expect(out[1]).toMatchObject({ value: 120, plus: true });
  });

  it('شمارش را روی متن غیرعددی روشن کرد، متن می‌ماند', () => {
    const section = SECTIONS.find((s) => s.key === 'stats')!;
    const out = section.fromForm!([{ number: '۲۰+', unit: '', caption: 'x', animate: true, plus: false }]) as Record<
      string,
      unknown
    >[];
    expect(out[0]).toEqual({ text: '۲۰+', caption: 'x' });
  });
});
