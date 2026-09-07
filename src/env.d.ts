/// <reference types="astro/client" />

import type { SessionUser } from './server/auth/session';

declare global {
  namespace App {
    interface Locals {
      /**
       * کاربر واردشده به پنل.
       *
       * فقط برای مسیرهای `/admin` پر می‌شود؛ در بقیهٔ صفحات `undefined`
       * است، چون آن‌ها نه به آن نیاز دارند نه باید هزینهٔ کوئری‌اش را بدهند.
       */
      user?: SessionUser | null;
    }
  }
}

export {};
