import type { APIRoute } from 'astro';

// آدرس‌های قدیمی وردپرس. روی سرور اجرا می‌شود تا هر مسیری زیر این شاخه
// با ۳۰۱ به صفحهٔ معادل برود و به ۴۰۴ نخورد.
// ریدایرکت نسبی است تا روی دامنهٔ آزمایشی هم به همان میزبان بماند.
export const prerender = false;

export const GET: APIRoute = ({ redirect }) => redirect('/about', 301);
