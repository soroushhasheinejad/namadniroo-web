/**
 * ساخت یا به‌روزرسانی کاربر پنل.
 *
 *   npm run db:admin -- ali@namadniroo.ir "علی رضایی" admin
 *
 * اگر رمز داده نشود، یک رمز تصادفی ساخته و یک بار چاپ می‌شود. اگر ایمیل از
 * قبل باشد، رمزش عوض می‌شود — همان مسیر بازیابی رمز فراموش‌شده.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../src/server/db/client';
import { ensureMigrated } from '../src/server/db/migrate';
import { users } from '../src/server/db/schema';
import { hashPassword, suggestPassword } from '../src/server/auth/password';

const [email, name, role = 'admin', password] = process.argv.slice(2);

if (!email || !name) {
  console.error('استفاده: npm run db:admin -- <ایمیل> "<نام>" [admin|editor|sales] [رمز]');
  process.exit(1);
}

if (!['admin', 'editor', 'sales'].includes(role)) {
  console.error(`نقش نامعتبر: ${role} — یکی از admin، editor یا sales`);
  process.exit(1);
}

const plain = password || suggestPassword();

await ensureMigrated();
const db = await getDb();
const passwordHash = await hashPassword(plain);

const [existing] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email.toLowerCase()))
  .limit(1);

if (existing) {
  await db
    .update(users)
    .set({ name, role: role as 'admin', passwordHash, active: true })
    .where(eq(users.id, existing.id));
  console.log(`کاربر «${email}» به‌روز شد.`);
} else {
  await db.insert(users).values({
    email: email.toLowerCase(),
    name,
    role: role as 'admin',
    passwordHash,
  });
  console.log(`کاربر «${email}» ساخته شد.`);
}

if (!password) {
  console.log(`\nرمز عبور: ${plain}`);
  console.log('این رمز فقط همین یک بار نمایش داده می‌شود — جایی امن ذخیره‌اش کنید.\n');
}

process.exit(0);
