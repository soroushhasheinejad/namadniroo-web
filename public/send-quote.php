<?php
/**
 * دریافت‌کنندهٔ فرم درخواست مشاوره — بدون سرویس شخص‌ثالث.
 *
 * هر درخواست ابتدا در دیتابیس ذخیره می‌شود و بعد ایمیل ارسال می‌گردد؛
 * بنابراین حتی اگر ارسال ایمیل روی هاست از کار بیفتد، لید گم نمی‌شود.
 */

declare(strict_types=1);

require_once __DIR__ . '/_lib/lead-store.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// آدرس دریافت‌کنندهٔ درخواست‌ها
$to = 'sales@namadniroo.ir';

function clean_field(string $value): string {
    return trim(preg_replace('/[\r\n]+/', ' ', $value));
}

// honeypot ضدربات — فیلدی که کاربر واقعی هرگز پرش نمی‌کند
if (!empty($_POST['website'])) {
    echo json_encode(['success' => true]);
    exit;
}

$name     = clean_field((string)($_POST['name'] ?? ''));
$phone    = clean_field((string)($_POST['phone'] ?? ''));
$capacity = clean_field((string)($_POST['capacity'] ?? ''));
$area     = clean_field((string)($_POST['area'] ?? ''));
$source   = clean_field((string)($_POST['source'] ?? ''));

if ($name === '' || $phone === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'نام و شمارهٔ تماس الزامی است']);
    exit;
}

/* ---------- ۱) ذخیره در دیتابیس ---------- */
$stored   = false;
$leadId   = null;
$pdo      = lead_db();

if ($pdo !== null) {
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO leads (created_at, name, phone, capacity, area, source)
             VALUES (:created_at, :name, :phone, :capacity, :area, :source)'
        );
        $stmt->execute([
            ':created_at' => gmdate('c'),
            ':name'       => $name,
            ':phone'      => $phone,
            ':capacity'   => $capacity !== '' ? $capacity : null,
            ':area'       => $area !== '' ? $area : null,
            ':source'     => $source !== '' ? $source : null,
        ]);
        $leadId = (int)$pdo->lastInsertId();
        $stored = true;
    } catch (Throwable $e) {
        error_log('[namadniroo] lead insert failed: ' . $e->getMessage());
    }
}

/* ---------- ۲) ارسال ایمیل ---------- */
$subject = '=?UTF-8?B?' . base64_encode('درخواست مشاورهٔ جدید از سایت نماد نیرو') . '?=';

$body = "درخواست جدید از فرم سایت namadniroo.ir\n\n"
      . "نام و نام خانوادگی: {$name}\n"
      . "شمارهٔ تماس: {$phone}\n"
      . "ظرفیت موردنظر: " . ($capacity !== '' ? $capacity : '—') . "\n"
      . "حوزهٔ درخواست: " . ($area !== '' ? $area : '—') . "\n"
      . "صفحهٔ مبدأ: " . ($source !== '' ? $source : '—') . "\n";

$headers  = "From: no-reply@namadniroo.ir\r\n";
$headers .= "Reply-To: no-reply@namadniroo.ir\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$emailed = @mail($to, $subject, $body, $headers);

if ($emailed && $stored && $leadId !== null) {
    try {
        $pdo->prepare('UPDATE leads SET emailed = 1 WHERE id = :id')
            ->execute([':id' => $leadId]);
    } catch (Throwable $e) {
        error_log('[namadniroo] lead flag failed: ' . $e->getMessage());
    }
}

/* ---------- ۳) پاسخ ---------- */
// اگر حداقل یکی از دو مسیر موفق بود، درخواست از دست نرفته است.
if ($stored || $emailed) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'ارسال با خطا مواجه شد']);
}
