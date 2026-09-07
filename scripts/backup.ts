/**
 * کپی امن از فایل دیتابیس.
 *
 *   npm run db:backup                    # کنار خود دیتابیس
 *   npm run db:backup -- ~/backups       # در مسیر دلخواه
 *
 * چرا کپی ساده کافی نیست: دیتابیس در حالت WAL کار می‌کند، یعنی بخشی از
 * نوشته‌های اخیر هنوز در فایل جانبی `-wal` است. کپی‌کردن فایل اصلی وسط کار
 * می‌تواند نسخه‌ای ناقص بدهد. دستور `VACUUM INTO` خود SQLite یک نسخهٔ کامل
 * و یکدست می‌سازد، حتی وقتی سایت در حال کار است.
 */
import path from 'node:path';
import { mkdirSync, statSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { databaseFile } from '../src/server/db/client';

const source = path.resolve(databaseFile());
const outDir = path.resolve(process.argv[2] ?? path.join(path.dirname(source), 'backups'));

mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const target = path.join(outDir, `namadniroo-${stamp}.db`);

const client = createClient({ url: `file:${source}` });

// نام فایل داخل رشتهٔ SQL می‌آید، پس نقل‌قول‌ها باید امن شوند
await client.execute(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

const size = Math.round(statSync(target).size / 1024);
console.log(`بکاپ ساخته شد: ${target} (${size} کیلوبایت)`);
console.log('\nاین فایل را جایی بیرون از سرور نگه دارید.');

process.exit(0);
