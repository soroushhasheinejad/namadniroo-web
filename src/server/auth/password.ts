import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * هش کردن رمز عبور با scrypt.
 *
 * scrypt در خود Node هست و نیازی به ماژول باینری ندارد — که روی میزبان
 * ایرانی یعنی یک وابستگی کمتر برای کامپایل‌شدن هنگام نصب. مثل argon2 و
 * bcrypt عمداً کند و پرحافظه است، پس حدس‌زدن رمز از روی هش گران می‌ماند.
 */

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/** پارامترها کنار هش ذخیره می‌شوند تا بعداً بشود آن‌ها را بالا برد بدون
    این‌که رمزهای قدیمی از کار بیفتند. */
const KEY_LEN = 64;
const SALT_LEN = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltHex, keyHex] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !keyHex) return false;

  const key = await scryptAsync(password, Buffer.from(saltHex, 'hex'), KEY_LEN);
  const expected = Buffer.from(keyHex, 'hex');

  // مقایسهٔ مقاوم در برابر حملهٔ زمان‌سنجی
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** رمز پیشنهادی برای ساخت کاربر اول */
export function suggestPassword(): string {
  return randomBytes(12).toString('base64url');
}
