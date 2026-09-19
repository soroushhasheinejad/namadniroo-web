import { describe, expect, it } from 'vitest';
import { type Field, ROOT, parseForm } from '../admin/fields';
import { comparable, toEntries } from '../admin/formEntries';
import { deepMerge } from '../server/content/merge';
import { PAGES, aboutPage, storageKey } from './pages';

/** تعریف فیلدهای یک صفحه به‌صورت یک گروه ریشه — همان‌طور که فرم پنل می‌سازد */
const rootOf = (fields: Field[]): Field => ({ kind: 'group', key: '', label: '', fields });

describe('deepMerge', () => {
  const fallback = {
    hero: { title: 'عنوان', lead: 'متن' },
    body: ['الف', 'ب'],
    count: 3,
  };

  it('بدون مقدار ذخیره‌شده، پیش‌فرض را برمی‌گرداند', () => {
    expect(deepMerge(fallback, undefined)).toEqual(fallback);
    expect(deepMerge(fallback, null)).toEqual(fallback);
  });

  it('فیلد تو‌در‌تو را جدا جایگزین می‌کند و بقیه را نگه می‌دارد', () => {
    expect(deepMerge(fallback, { hero: { title: 'تازه' } })).toEqual({
      hero: { title: 'تازه', lead: 'متن' },
      body: ['الف', 'ب'],
      count: 3,
    });
  });

  it('آرایه را کامل جایگزین می‌کند', () => {
    expect(deepMerge(fallback, { body: ['ج'] }).body).toEqual(['ج']);
  });

  it('رشتهٔ خالی را نگه می‌دارد', () => {
    expect(deepMerge(fallback, { hero: { lead: '' } }).hero.lead).toBe('');
  });

  it('نوع نادرست را نادیده می‌گیرد', () => {
    const out = deepMerge(fallback, { hero: 'خراب', body: 'نه آرایه', count: 'سه' });
    expect(out).toEqual(fallback);
  });

  it('پیش‌فرض را دست‌کاری نمی‌کند', () => {
    const before = JSON.stringify(fallback);
    const out = deepMerge(fallback, { hero: { title: 'x' } });
    out.hero.lead = 'تغییر';
    expect(JSON.stringify(fallback)).toBe(before);
  });
});

describe('صفحات', () => {
  it('کلید هر صفحه یکتاست', () => {
    const keys = PAGES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('کلید ذخیره با کلیدهای سراسری تداخل ندارد', () => {
    expect(storageKey('about')).toBe('page:about');
  });

  /* هر فیلد اعلام‌شده باید پیش‌فرض داشته باشد، و هر پیش‌فرض باید فیلدی
     در فرم داشته باشد — وگرنه یا فیلد خالی نمایش داده می‌شود یا متنی روی
     سایت هست که از پنل قابل ویرایش نیست. */
  for (const page of PAGES) {
    it(`${page.label}: فیلدها و پیش‌فرض‌ها با هم می‌خوانند`, () => {
      const fieldKeys = page.fields.map((f) => f.key).sort();
      expect(Object.keys(page.defaults).sort()).toEqual(fieldKeys);
    });

    it(`${page.label}: ذخیرهٔ بی‌تغییر هیچ چیزی را عوض نمی‌کند`, () => {
      const root = rootOf(page.fields);
      const form = new FormData();
      for (const [k, v] of toEntries(root, page.defaults, ROOT)) form.append(k, v);
      const saved = parseForm(root, form);
      expect(comparable(deepMerge(page.defaults, saved))).toEqual(comparable(page.defaults));
    });
  }

  it('پاراگراف‌های معرفی یکی‌یکی حفظ می‌شوند', () => {
    const root = rootOf(aboutPage.fields);
    const form = new FormData();
    for (const [k, v] of toEntries(root, aboutPage.defaults, ROOT)) form.append(k, v);
    const saved = parseForm(root, form) as typeof aboutPage.defaults;
    expect(saved.intro.body).toHaveLength(2);
    expect(saved.intro.body[0]).toBe(aboutPage.defaults.intro.body[0]);
  });
});
