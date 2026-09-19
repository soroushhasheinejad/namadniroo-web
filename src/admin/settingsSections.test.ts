import { describe, expect, it } from 'vitest';
import { ROOT, parseForm } from './fields';
import { comparable, toEntries } from './formEntries';
import { SECTIONS } from './settingsSections';
import * as defaults from '../data/siteContent';

function roundTrip(key: string, stored: unknown): unknown {
  const section = SECTIONS.find((s) => s.key === key)!;
  const formValue = section.toForm ? section.toForm(stored) : stored;
  const entries = toEntries(section.root, formValue, ROOT);
  const form = new FormData();
  for (const [k, v] of entries) form.append(k, v);
  const parsed = parseForm(section.root, form);
  return section.fromForm ? section.fromForm(parsed) : parsed;
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
