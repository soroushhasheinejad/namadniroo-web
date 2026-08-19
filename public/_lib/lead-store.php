<?php
/**
 * منطق مشترک ذخیره‌سازی لیدها — بین فرم عمومی و پنل مشاهده.
 * این فایل خودش خروجی ندارد؛ فقط تابع تعریف می‌کند.
 */

declare(strict_types=1);

/**
 * مسیر فایل دیتابیس را برمی‌گرداند.
 *
 * ترجیح اول: یک پوشه بیرون از ریشهٔ وب (`../nn-data/`) — این‌طور فایل اصلاً از
 * طریق HTTP قابل دسترسی نیست و با دیپلوی هم پاک نمی‌شود.
 * اگر ساخت آن ممکن نبود (بعضی هاست‌ها اجازه نمی‌دهند)، به `_lib/data/` برمی‌گردیم
 * که با فایل .htaccess کنارش محافظت شده است.
 */
function lead_db_path(): ?string {
    $candidates = [
        dirname(__DIR__, 2) . '/nn-data',   // بیرون از public_html
        __DIR__ . '/data',                  // جایگزین، داخل وب‌روت ولی مسدودشده
    ];

    foreach ($candidates as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }
        if (is_dir($dir) && is_writable($dir)) {
            return $dir . '/leads.sqlite';
        }
    }

    return null;
}

/** اتصال به دیتابیس و ساخت جدول در صورت نبود. */
function lead_db(): ?PDO {
    $path = lead_db_path();
    if ($path === null) {
        return null;
    }

    try {
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS leads (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at  TEXT NOT NULL,
                name        TEXT NOT NULL,
                phone       TEXT NOT NULL,
                capacity    TEXT,
                area        TEXT,
                source      TEXT,
                emailed     INTEGER NOT NULL DEFAULT 0
            )'
        );
        return $pdo;
    } catch (Throwable $e) {
        error_log('[namadniroo] lead db error: ' . $e->getMessage());
        return null;
    }
}
