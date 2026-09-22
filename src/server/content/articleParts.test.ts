import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { extractFaq, linkedArticleSlugs } from './articleParts';
import { renderMarkdown } from './markdown';
import { parseFrontmatter } from '../../../scripts/articles';

const dir = path.resolve(import.meta.dirname, '../../content/articles');

describe('extractFaq', () => {
  it('پرسش و پاسخ را از بخش پرسش‌های پرتکرار در می‌آورد', () => {
    const html =
      '<h2 id="a">مقدمه</h2><p>متن</p>' +
      '<h2 id="faq">پرسش‌های پرتکرار</h2>' +
      '<h3 id="q1">هزینه چقدر است؟</h3><p>حدود ۱۰ تومان.</p>' +
      '<h3 id="q2">چند سال؟</h3><p>سه سال.</p>';

    expect(extractFaq(html)).toEqual([
      { q: 'هزینه چقدر است؟', a: 'حدود ۱۰ تومان.' },
      { q: 'چند سال؟', a: 'سه سال.' },
    ]);
  });

  it('h3های قبل از بخش پرسش‌ها را پرسش حساب نمی‌کند', () => {
    const html =
      '<h3 id="x">زیرعنوان معمولی</h3><p>متن</p>' +
      '<h2 id="faq">پرسش‌های پرتکرار</h2>' +
      '<h3 id="q1">پرسش واقعی؟</h3><p>پاسخ.</p>';

    expect(extractFaq(html)).toEqual([{ q: 'پرسش واقعی؟', a: 'پاسخ.' }]);
  });

  it('برای مقالهٔ بدون بخش پرسش‌ها آرایهٔ خالی می‌دهد', () => {
    expect(extractFaq('<h2 id="a">فقط متن</h2><p>بدون پرسش</p>')).toEqual([]);
  });

  it('تگ‌های داخل پرسش و پاسخ را پاک می‌کند', () => {
    const html =
      '<h2 id="faq">پرسش‌های پرتکرار</h2>' +
      '<h3 id="q"><strong>چرا</strong> گران است؟</h3><p>چون <em>ارز</em> گران شده.</p>';

    expect(extractFaq(html)).toEqual([{ q: 'چرا گران است؟', a: 'چون ارز گران شده.' }]);
  });
});

describe('linkedArticleSlugs', () => {
  it('فقط لینک‌های مجله را می‌گیرد', () => {
    const md = 'به [الف](/magazine/alef) و [ب](/shop) و [ج](/magazine/jim) سر بزنید.';
    expect([...linkedArticleSlugs(md)].sort()).toEqual(['alef', 'jim']);
  });

  it('برای متن بدون لینک مجله خالی است', () => {
    expect(linkedArticleSlugs('بدون لینک [تماس](/contact)').size).toBe(0);
  });
});

describe('مقالات واقعی', () => {
  it('لینک‌های داخلی مجله به مقالهٔ موجود اشاره می‌کنند', async () => {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
    const slugs = new Set(files.map((f) => f.replace(/\.md$/, '')));

    for (const file of files) {
      const raw = await readFile(path.join(dir, file), 'utf8');
      for (const slug of linkedArticleSlugs(raw)) {
        expect(slugs, `${file} → /magazine/${slug}`).toContain(slug);
      }
    }
  });

  it('مقالات دارای بخش پرسش‌ها، FAQ قابل استخراج می‌دهند', async () => {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
    let checked = 0;

    for (const file of files) {
      const { body } = parseFrontmatter(await readFile(path.join(dir, file), 'utf8'));
      if (!body.includes('## پرسش‌های پرتکرار')) continue;

      const faq = extractFaq(await renderMarkdown(body));
      expect(faq.length, file).toBeGreaterThanOrEqual(3);
      for (const { q, a } of faq) {
        expect(q, file).toMatch(/[؟?]$/);
        expect(a.length, `${file} → ${q}`).toBeGreaterThan(30);
      }
      checked++;
    }

    expect(checked).toBeGreaterThanOrEqual(12);
  });
});
