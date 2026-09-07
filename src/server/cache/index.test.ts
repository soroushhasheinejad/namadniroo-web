import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, clearCache, invalidate } from './index';

beforeEach(clearCache);

describe('cached', () => {
  it('بار دوم کوئری را دوباره اجرا نمی‌کند', async () => {
    const load = vi.fn().mockResolvedValue('نتیجه');

    expect(await cached('k', ['tag'], load)).toBe('نتیجه');
    expect(await cached('k', ['tag'], load)).toBe('نتیجه');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('درخواست‌های هم‌زمان فقط یک کوئری می‌زنند', async () => {
    const load = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('یک بار'), 20)),
    );

    const results = await Promise.all([
      cached('same', ['t'], load),
      cached('same', ['t'], load),
      cached('same', ['t'], load),
    ]);

    expect(results).toEqual(['یک بار', 'یک بار', 'یک بار']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('باطل‌کردن برچسب باعث اجرای دوبارهٔ کوئری می‌شود', async () => {
    const load = vi.fn().mockResolvedValueOnce('قدیم').mockResolvedValueOnce('جدید');

    expect(await cached('k', ['products'], load)).toBe('قدیم');
    invalidate('products');
    expect(await cached('k', ['products'], load)).toBe('جدید');
  });

  it('برچسب بی‌ربط چیزی را باطل نمی‌کند', async () => {
    const load = vi.fn().mockResolvedValue('ثابت');

    await cached('k', ['products'], load);
    invalidate('articles');
    await cached('k', ['products'], load);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('هر یک از چند برچسب برای باطل‌کردن کافی است', async () => {
    const load = vi.fn().mockResolvedValue('x');

    await cached('k', ['products', 'media'], load);
    invalidate('media');
    await cached('k', ['products', 'media'], load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('بعد از پایان TTL دوباره می‌خواند', async () => {
    const load = vi.fn().mockResolvedValue('x');

    await cached('k', ['t'], load, 20);
    await new Promise((r) => setTimeout(r, 35));
    await cached('k', ['t'], load, 20);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('خطا کش نمی‌شود', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('خرابی')).mockResolvedValueOnce('سالم');

    await expect(cached('k', ['t'], load)).rejects.toThrow('خرابی');
    expect(await cached('k', ['t'], load)).toBe('سالم');
  });
});
