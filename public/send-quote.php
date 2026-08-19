<?php
/**
 * دریافت‌کنندهٔ فرم درخواست مشاوره — بدون سرویس شخص‌ثالث.
 * روی هر هاست معمولی PHP (مثل هاست فعلی نماد نیرو) بدون نیاز به تنظیم اضافه کار می‌کند.
 */

declare(strict_types=1);

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

if ($name === '' || $phone === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'نام و شمارهٔ تماس الزامی است']);
    exit;
}

$subjectText = 'درخواست مشاورهٔ جدید از سایت نماد نیرو';
$subject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';

$body = "درخواست جدید از فرم سایت namadniroo.ir\n\n"
      . "نام و نام خانوادگی: {$name}\n"
      . "شمارهٔ تماس: {$phone}\n"
      . "ظرفیت موردنظر: " . ($capacity !== '' ? $capacity : '—') . "\n"
      . "حوزهٔ درخواست: " . ($area !== '' ? $area : '—') . "\n";

$headers  = "From: no-reply@namadniroo.ir\r\n";
$headers .= "Reply-To: no-reply@namadniroo.ir\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$sent = @mail($to, $subject, $body, $headers);

if ($sent) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'ارسال با خطا مواجه شد']);
}
