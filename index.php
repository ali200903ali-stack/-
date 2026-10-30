<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
$installed=true;$user=null;$error='';
try {
    $db=ns_db();
    if (!$db->query("SHOW TABLES LIKE 'users'")->fetchColumn()) $installed=false;
    elseif (!(int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()) $installed=false;
    if ($installed && !empty($_SESSION['uid'])) {
        $user=ns_one('SELECT id,name,role,branch_id,active FROM users WHERE id=?',[(int)$_SESSION['uid']]);
        if ($user && !$user['active'])$user=null;
    }
} catch (Throwable $e) { $installed=false;$error='لم يكتمل إعداد قاعدة البيانات. راجع config.local.php.'; }
?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a294d">
<meta name="description" content="NineSoft - نظام محاسبي وإدارة مبيعات ومخزون باللغة العربية">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'">
<title>NineSoft | ناين سوفت للحلول المالية</title>
<link rel="icon" href="assets/logo.svg" type="image/svg+xml">
<link rel="manifest" href="manifest.webmanifest">
<link rel="stylesheet" href="assets/style.css?v=1">
</head>
<body data-auth="<?= $user?'1':'0' ?>">
<?php if(!$installed): ?>
<main class="auth-body"><section class="auth-card"><img src="assets/logo.svg" alt="NineSoft" class="auth-logo"><h1>تهيئة نظام ناين سوفت</h1>
<p><?= ns_escape($error ?: 'النظام جاهز لبدء معالج التثبيت الأول.') ?></p>
<a class="primary" href="install.php">الانتقال إلى التثبيت</a></section></main>
<?php elseif (!$user): ?>
<main class="auth-body"><section class="auth-card"><img src="assets/logo.svg" alt="NineSoft" class="auth-logo">
<div class="brand-line"><strong>Nine<span>Soft</span></strong><small>ناين سوفت للأنظمة والحلول المالية</small></div>
<h1>أهلاً بعودتك</h1><p>سجّل دخولك للوصول إلى مساحة العمل المحاسبية الآمنة.</p>
<form id="login-form" autocomplete="on">
<label>البريد الإلكتروني<input id="login-email" type="email" name="username" autocomplete="username" required></label>
<label>كلمة المرور<input id="login-password" type="password" name="password" autocomplete="current-password" required></label>
<button class="primary" type="submit" id="login-submit">دخول النظام</button>
<p class="message error hidden" role="alert" id="login-error"></p>
</form><p class="muted">بيانات الشركة تُحفظ على الخادم وليست في هذا الجهاز.</p></section></main>
<?php else: ?>
<div id="app" class="app-loading"><div class="spinner"></div><p>جاري تحميل مساحة العمل...</p></div>
<?php endif; ?>
<script>window.NS_BOOT = <?= json_encode(['csrf'=>$_SESSION['csrf'],'user'=>$user], JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?>;</script>
<script src="assets/core.js?v=1" defer></script>
<script src="assets/pages.js?v=1" defer></script>
<script src="assets/actions.js?v=1" defer></script>
</body>
</html>
