<?php
/**
 * پنل مشاهدهٔ درخواست‌های ثبت‌شده.
 *
 * ⚠️ امنیت: این صفحه خودش رمز ندارد. حتماً باید کل پوشهٔ /leads از پنل هاست
 *    (cPanel → Directory Privacy) با نام کاربری و رمز محافظت شود.
 *    بدون آن، اطلاعات تماس مشتریان برای همه قابل مشاهده است.
 */

declare(strict_types=1);

require_once __DIR__ . '/../_lib/lead-store.php';

$pdo = lead_db();
$rows = [];
$dbError = null;

if ($pdo === null) {
    $dbError = 'اتصال به دیتابیس ممکن نشد (پوشهٔ ذخیره‌سازی قابل نوشتن نیست).';
} else {
    try {
        $rows = $pdo->query('SELECT * FROM leads ORDER BY id DESC')->fetchAll();
    } catch (Throwable $e) {
        $dbError = 'خطا در خواندن دیتابیس: ' . $e->getMessage();
    }
}

/* ---------- خروجی CSV ---------- */
if (isset($_GET['export']) && $_GET['export'] === 'csv' && $dbError === null) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="namadniroo-leads-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM تا اکسل فارسی را درست باز کند
    fputcsv($out, ['شناسه', 'تاریخ ثبت', 'نام', 'تلفن', 'ظرفیت', 'حوزه', 'صفحهٔ مبدأ', 'ایمیل ارسال شد']);
    foreach ($rows as $r) {
        fputcsv($out, [
            $r['id'], $r['created_at'], $r['name'], $r['phone'],
            $r['capacity'] ?? '', $r['area'] ?? '', $r['source'] ?? '',
            $r['emailed'] ? 'بله' : 'خیر',
        ]);
    }
    fclose($out);
    exit;
}

function e(?string $v): string {
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

/** تاریخ ISO را به شکل خواناتر نشان می‌دهد. */
function show_date(?string $iso): string {
    if (!$iso) return '—';
    $ts = strtotime($iso);
    return $ts ? date('Y-m-d H:i', $ts) : e($iso);
}

$total = count($rows);
$weekAgo = strtotime('-7 days');
$recent = 0;
foreach ($rows as $r) {
    if (strtotime($r['created_at']) >= $weekAgo) $recent++;
}
$notEmailed = 0;
foreach ($rows as $r) {
    if (!$r['emailed']) $notEmailed++;
}
?>
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>درخواست‌های ثبت‌شده | نماد نیرو</title>
<style>
  :root {
    --bg: #0A0A0A; --bg-2: #191919; --panel: #202020;
    --line: rgba(255,255,255,.10); --ink: #F4F3F1; --muted: #B4B4B4;
    --yellow: #FFC41A;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 28px 20px; background: var(--bg); color: var(--ink);
    font-family: Tahoma, system-ui, sans-serif; font-size: 14px; line-height: 1.7;
  }
  .wrap { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .sub { color: var(--muted); margin: 0 0 24px; }
  .cards { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
  .card {
    background: var(--bg-2); border: 1px solid var(--line); border-radius: 12px;
    padding: 16px 20px; min-width: 150px;
  }
  .card b { display: block; font-size: 26px; color: var(--yellow); }
  .card span { color: var(--muted); font-size: 13px; }
  .btn {
    display: inline-block; background: var(--yellow); color: #101010;
    padding: 9px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;
  }
  .btn:hover { opacity: .9; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { padding: 11px 12px; text-align: right; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 700; font-size: 13px; white-space: nowrap; }
  tr:hover td { background: rgba(255,255,255,.03); }
  .tel { direction: ltr; text-align: right; font-family: monospace; }
  .empty, .error { background: var(--bg-2); border: 1px solid var(--line);
    border-radius: 12px; padding: 30px; text-align: center; color: var(--muted); }
  .error { border-color: rgba(255,90,90,.4); color: #ff9b9b; }
  .pill { font-size: 12px; padding: 2px 9px; border-radius: 99px; border: 1px solid var(--line); color: var(--muted); }
  .pill.warn { color: var(--yellow); border-color: rgba(255,196,26,.45); }
  .table-scroll { overflow-x: auto; }
</style>
</head>
<body>
<div class="wrap">
  <h1>درخواست‌های ثبت‌شده</h1>
  <p class="sub">همهٔ درخواست‌هایی که از فرم مشاورهٔ سایت ارسال شده‌اند.</p>

  <?php if ($dbError !== null): ?>
    <div class="error"><?= e($dbError) ?></div>
  <?php else: ?>

    <div class="cards">
      <div class="card"><b><?= $total ?></b><span>کل درخواست‌ها</span></div>
      <div class="card"><b><?= $recent ?></b><span>۷ روز اخیر</span></div>
      <?php if ($notEmailed > 0): ?>
        <div class="card"><b><?= $notEmailed ?></b><span>ایمیلشان ارسال نشده</span></div>
      <?php endif; ?>
    </div>

    <?php if ($total > 0): ?>
      <a class="btn" href="?export=csv">دانلود خروجی CSV</a>

      <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th><th>تاریخ</th><th>نام</th><th>تلفن</th>
            <th>ظرفیت</th><th>حوزه</th><th>مبدأ</th><th>ایمیل</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($rows as $r): ?>
            <tr>
              <td><?= (int)$r['id'] ?></td>
              <td><?= show_date($r['created_at']) ?></td>
              <td><?= e($r['name']) ?></td>
              <td class="tel"><?= e($r['phone']) ?></td>
              <td><?= e($r['capacity'] ?: '—') ?></td>
              <td><?= e($r['area'] ?: '—') ?></td>
              <td><?= e($r['source'] ?: '—') ?></td>
              <td>
                <?php if ($r['emailed']): ?>
                  <span class="pill">ارسال شد</span>
                <?php else: ?>
                  <span class="pill warn">ارسال نشد</span>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
      </div>
    <?php else: ?>
      <div class="empty">هنوز درخواستی ثبت نشده است.</div>
    <?php endif; ?>

  <?php endif; ?>
</div>
</body>
</html>
