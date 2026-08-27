import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface Lead {
  createdAt: string;
  name: string;
  phone: string;
  capacity?: string;
  area?: string;
  source?: string;
  emailed: boolean;
}

/**
 * پوشهٔ ذخیره‌سازی.
 *
 * روی میزبان‌های ابری فایل‌سیستم با هر انتشار پاک می‌شود، بنابراین باید
 * یک دیسک پایدار به اپ وصل شود و مسیرش در متغیر LEADS_DIR بیاید.
 * اگر تنظیم نشده باشد، کنار پروژه ذخیره می‌کنیم تا در محیط توسعه کار کند.
 */
const dir = process.env.LEADS_DIR || path.join(process.cwd(), 'data');
const file = path.join(dir, 'leads.jsonl');

/**
 * یک درخواست را ذخیره می‌کند.
 * فرمت JSON Lines است: هر رکورد یک خط. افزودن خط، عملیات اتمیک کوچکی است،
 * پس نیازی به دیتابیس و ماژول باینری برای این حجم از داده نیست.
 */
export async function saveLead(lead: Lead): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await appendFile(file, JSON.stringify(lead) + '\n', 'utf8');
}

/** همهٔ درخواست‌ها، جدیدترین اول. خطوط خراب نادیده گرفته می‌شوند. */
export async function readLeads(): Promise<Lead[]> {
  if (!existsSync(file)) return [];

  const raw = await readFile(file, 'utf8');
  const leads: Lead[] = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      leads.push(JSON.parse(line));
    } catch {
      // یک خط ناقص نباید کل پنل را از کار بیندازد
    }
  }

  return leads.reverse();
}
