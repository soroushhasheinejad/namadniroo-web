import { describe, expect, it } from 'vitest';
import { isNoise } from './notFound';

describe('isNoise', () => {
  it('کاوش ربات‌ها را کنار می‌گذارد', () => {
    for (const p of ['/wp-login.php', '/wp-admin/setup.php', '/xmlrpc.php', '/.env', '/.git/config',
                     '/admin/config.php', '/backup.sql', '/cgi-bin/test', '/index.php?x=1']) {
      expect(isNoise(p), p).toBe(true);
    }
  });

  it('پیوندهای واقعی ازدست‌رفته را نگه می‌دارد', () => {
    /* تصاویر سایت وردپرسی قبلی و نشانی‌های قدیمی صفحات همان چیزی‌اند که
       باید برایشان ریدایرکت ساخت. */
    for (const p of ['/wp-content/uploads/2023/05/panel.jpg', '/product/fronius-primo',
                     '/magazine/old-article', '/about-us', '/shop/inverter-10kw']) {
      expect(isNoise(p), p).toBe(false);
    }
  });

  it('نشانی بیش از حد بلند را کنار می‌گذارد', () => {
    expect(isNoise('/' + 'a'.repeat(400))).toBe(true);
  });
});
