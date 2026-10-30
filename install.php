<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$err = '';
try {
    $cfg = ns_config();
    $configured = !empty($cfg['db_name']) && !empty($cfg['db_user']);
    if (!$configured) throw new RuntimeException('انسخ config.example.php إلى config.local.php واضبط قاعدة البيانات ومفتاح التثبيت.');
    if (empty($cfg['install_token']) || strlen((string)$cfg['install_token']) < 24) {
        throw new RuntimeException('ضع install_token عشوائياً لا يقل عن 24 حرفاً داخل config.local.php أولاً.');
    }
    $pdo = ns_db();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!hash_equals($_SESSION['csrf'], $_POST['csrf'] ?? '')) throw new RuntimeException('رمز الجلسة غير صحيح.');
        if (!hash_equals((string)$cfg['install_token'], (string)($_POST['install_token'] ?? ''))) throw new RuntimeException('مفتاح التثبيت غير صحيح.');
        $adminName = ns_text($_POST['name'] ?? '', 120);
        $email = filter_var(trim((string)($_POST['email'] ?? '')), FILTER_VALIDATE_EMAIL);
        $password = (string)($_POST['password'] ?? '');
        if (!$adminName || !$email || strlen($password) < 12) throw new RuntimeException('أدخل اسماً وبريداً صحيحاً وكلمة مرور من 12 حرفاً على الأقل.');
        // Do not allow reinitalization if a real admin exists.
        $exists = $pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn();
        if ($exists && (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) throw new RuntimeException('النظام مثبت بالفعل. لا يمكن إعادة التثبيت.');
        $schema = file_get_contents(__DIR__ . '/schema.sql');
        foreach (explode(';', (string)$schema) as $statement) {
            $statement = preg_replace('/^\s*--[^\n]*\n/m', '', $statement);
            if (trim((string)$statement) !== '') $pdo->exec($statement);
        }
        if ((int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() !== 0) throw new RuntimeException('قاعدة البيانات تحتوي على مستخدمين؛ التثبيت متوقف.');
        $pdo->beginTransaction();
        try {
            ns_query("INSERT INTO branches(name) VALUES('الفرع الرئيسي')");
            $branch = (int)$pdo->lastInsertId();
            ns_query('INSERT INTO customers(name,phone,address) VALUES(?,?,?)', ['العميل النقدي','','']);
            $chart = [
                ['101','الصندوق','asset'], ['102','البنك','asset'],
                ['110','العملاء - ذمم مدينة','asset'], ['120','المخزون','asset'],
                ['121','ضريبة مدخلات','asset'], ['201','الموردون - ذمم دائنة','liability'],
                ['210','ضريبة مخرجات','liability'], ['300','رأس المال','equity'],
                ['400','إيرادات المبيعات','revenue'], ['500','مصروفات تشغيلية','expense'],
                ['510','تكلفة البضاعة المباعة','expense'],
            ];
            foreach ($chart as [$code,$name,$type]) ns_query(
                'INSERT INTO accounts(code,name,type,is_system) VALUES(?,?,?,1)', [$code,$name,$type]
            );
            ns_query('INSERT INTO users(name,email,password_hash,role,branch_id) VALUES(?,?,?,?,?)',
                [$adminName,$email,password_hash($password,PASSWORD_DEFAULT),'admin',$branch]);
            $uid = (int)$pdo->lastInsertId();
            ns_query('INSERT INTO settings(name,value) VALUES(?,?),(?,?),(?,?)',
                ['company','شركتي','currency','YER','low_stock_alert','1']);
            $pdo->commit();
        } catch (Throwable $t) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $t;
        }
        // Prevent rerunning from the same shared-hosting account accidentally.
        @file_put_contents(__DIR__ . '/storage/installed.lock', date(DATE_ATOM));
        session_regenerate_id(true);
        $_SESSION['uid'] = $uid;
        header('Location: index.php');
        exit;
    }
    if ($pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn()) {
        if ((int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) {
            header('Location: index.php'); exit;
        }
    }
} catch (Throwable $t) { $err = $t->getMessage(); }
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>تثبيت NineSoft</title><link rel="stylesheet" href="assets/style.css"></head>
<body class="auth-body"><main class="auth-card"><div class="brandmark">N</div><h1>إعداد نظام NineSoft</h1>
<p>يُستخدم هذا التثبيت مرة واحدة فقط. جهّز قاعدة بيانات MySQL فارغة في Hostinger.</p>
<?php if ($err): ?><div class="message error"><?= ns_escape($err) ?></div><?php endif; ?>
<form method="post" autocomplete="off">
<input type="hidden" name="csrf" value="<?= ns_escape($_SESSION['csrf']) ?>">
<label>مفتاح التثبيت من config.local.php<input type="password" name="install_token" required></label>
<label>اسم مدير النظام<input name="name" maxlength="120" required></label>
<label>البريد الإلكتروني<input name="email" type="email" required></label>
<label>كلمة مرور قوية (12 حرفاً على الأقل)<input name="password" type="password" minlength="12" required></label>
<button type="submit" class="primary">إنشاء قاعدة البيانات وبدء العمل</button>
</form><p class="muted">لا تستخدم كلمة المرور التجريبية. احذف أو امنع install.php من الخادم بعد التثبيت.</p></main></body></html>
