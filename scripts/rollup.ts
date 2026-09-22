/**
 * جمع‌بندی دستی آمار.
 *
 *   npm run db:rollup            روزهای جمع‌بندی‌نشده
 *   npm run db:rollup -- 2026-09-19   فقط یک روز مشخص
 *
 * در حالت عادی worker خودش این کار را هر شش ساعت انجام می‌دهد. این
 * اسکریپت برای دو موقعیت است: بعد از یک توقف طولانی سرور، و وقتی
 * می‌خواهید بدون منتظر ماندن ببینید جمع‌بندی درست کار می‌کند.
 */
import { pruneEvents, rollupDay, rollupPending } from '../src/server/services/rollup';

const day = process.argv[2];

if (day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    console.error('تاریخ باید به شکل YYYY-MM-DD باشد');
    process.exit(1);
  }
  const rows = await rollupDay(day);
  console.log(`${day}: ${rows} سنجه نوشته شد`);
} else {
  const days = await rollupPending();
  console.log(days > 0 ? `${days} روز جمع‌بندی شد` : 'چیزی برای جمع‌بندی نبود');
  if (days > 0) {
    await pruneEvents();
    console.log('رویدادهای قدیمی‌تر از ۱۲۰ روز پاک شدند');
  }
}

process.exit(0);
