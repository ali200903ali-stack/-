<?php
declare(strict_types=1);

if (!defined('NINESOFT_BOOTSTRAPPED')) {
    define('NINESOFT_BOOTSTRAPPED', true);
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
    date_default_timezone_set('Asia/Aden');
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('NSSESSID');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'secure' => $secure,
        'httponly' => true, 'samesite' => 'Lax',
    ]);
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function ns_config(): array {
    static $config = null;
    if ($config !== null) return $config;
    $file = __DIR__ . '/config.local.php';
    $local = is_file($file) ? require $file : [];
    if (!is_array($local)) throw new RuntimeException('Invalid configuration');
    return $config = array_merge([
        'db_host' => getenv('DB_HOST') ?: 'localhost',
        'db_port' => getenv('DB_PORT') ?: '3306',
        'db_name' => getenv('DB_NAME') ?: '',
        'db_user' => getenv('DB_USER') ?: '',
        'db_pass' => getenv('DB_PASSWORD') ?: '',
        'app_url' => getenv('APP_URL') ?: '',
        'timezone' => 'Asia/Aden',
    ], $local);
}
function ns_db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $cfg = ns_config();
    if (!$cfg['db_name'] || !$cfg['db_user']) {
        throw new RuntimeException('Database is not configured. Please configure config.local.php first.');
    }
    date_default_timezone_set($cfg['timezone']);
    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $cfg['db_host'], $cfg['db_port'], $cfg['db_name']);
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+03:00'",
    ]);
    return $pdo;
}
function ns_query(string $sql, array $params = []): PDOStatement {
    $s = ns_db()->prepare($sql); $s->execute($params); return $s;
}
function ns_one(string $sql, array $params = []): ?array {
    $row = ns_query($sql, $params)->fetch();
    return $row ?: null;
}
function ns_rows(string $sql, array $params = []): array {
    return ns_query($sql, $params)->fetchAll();
}
function ns_json(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
    exit;
}
function ns_fail(string $message, int $code = 422): never {
    ns_json(['ok' => false, 'error' => $message], $code);
}
function ns_input(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 1_000_000) ns_fail('حجم الطلب كبير', 413);
    try { $v = json_decode(file_get_contents('php://input') ?: '{}', true, 64, JSON_THROW_ON_ERROR); }
    catch (Throwable $e) { ns_fail('صيغة JSON غير صالحة'); }
    if (!is_array($v)) ns_fail('طلب غير صالح');
    return $v;
}
function ns_csrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$token || !hash_equals($_SESSION['csrf'] ?? '', $token)) ns_fail('انتهت صلاحية الجلسة. أعد تحميل الصفحة.', 419);
}
function ns_user(): array {
    if (empty($_SESSION['uid'])) ns_fail('يجب تسجيل الدخول', 401);
    $u = ns_one('SELECT id,name,email,role,branch_id,active FROM users WHERE id = ?', [(int)$_SESSION['uid']]);
    if (!$u || !$u['active']) {
        unset($_SESSION['uid']); ns_fail('الحساب غير متاح', 401);
    }
    return $u;
}
function ns_role(array $u, array $allowed): void {
    if (!in_array($u['role'], $allowed, true)) ns_fail('غير مصرح لك بهذه العملية', 403);
}
function ns_branch(array $u, int $branch): void {
    if ($branch < 1) ns_fail('اختر الفرع');
    if (!ns_one('SELECT id FROM branches WHERE id=? AND active=1', [$branch])) ns_fail('الفرع غير موجود');
    if ($u['role'] === 'cashier' && (int)$u['branch_id'] !== $branch) ns_fail('ليس لديك صلاحية لهذا الفرع', 403);
}
function ns_text(mixed $v, int $limit = 190): string {
    $s = trim((string)($v ?? ''));
    if (strlen($s) > $limit * 4) ns_fail('النص أطول من الحد المسموح');
    if (function_exists('mb_substr')) $s = mb_substr($s, 0, $limit);
    return $s;
}
function ns_int(mixed $v, int $min = 0): int {
    if (!filter_var($v, FILTER_VALIDATE_INT) && (string)$v !== '0') ns_fail('معرّف رقمي غير صالح');
    $n = (int)$v;
    if ($n < $min) ns_fail('قيمة رقمية غير مقبولة');
    return $n;
}
function ns_money(mixed $v, bool $allowZero = true): int {
    if (!is_int($v) && !is_float($v) && !is_string($v)) ns_fail('مبلغ غير صالح');
    if (!is_numeric($v) || !is_finite((float)$v) || abs((float)$v) > 1000000000000) ns_fail('مبلغ غير صالح');
    $value = (int)round(((float)$v) * 100);
    if ($value < 0 || (!$allowZero && $value === 0)) ns_fail('المبلغ يجب أن يكون موجباً');
    return $value;
}
function ns_dec(int $cents): string { return number_format($cents / 100, 2, '.', ''); }
function ns_qty(mixed $v): float {
    if (!is_numeric($v) || !is_finite((float)$v)) ns_fail('الكمية غير صالحة');
    $q = round((float)$v, 3);
    if ($q <= 0 || $q > 1000000000) ns_fail('الكمية غير صالحة');
    return $q;
}
function ns_date(mixed $v): string {
    $d = (string)$v;
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $d);
    if (!$parsed || $parsed->format('Y-m-d') !== $d) ns_fail('التاريخ غير صالح');
    return $d;
}
function ns_sequence(string $prefix): string {
    if (!in_array($prefix, ['INV','PUR','RET','JV','VCH','OPEN'], true)) ns_fail('نوع الترقيم غير صحيح');
    ns_query('INSERT IGNORE INTO sequences(name,current_value) VALUES(?,0)', [$prefix]);
    $r = ns_one('SELECT current_value FROM sequences WHERE name=? FOR UPDATE', [$prefix]);
    $next = (int)$r['current_value'] + 1;
    ns_query('UPDATE sequences SET current_value=? WHERE name=?', [$next, $prefix]);
    return $prefix . '-' . str_pad((string)$next, 6, '0', STR_PAD_LEFT);
}
function ns_account(string $code): int {
    $a = ns_one('SELECT id FROM accounts WHERE code=? AND active=1', [$code]);
    if (!$a) throw new RuntimeException('Missing system account: ' . $code);
    return (int)$a['id'];
}
function ns_audit(array $u, string $action, string $entity, string|int $id): void {
    ns_query('INSERT INTO audit_logs(user_id,action,entity,entity_id,ip) VALUES(?,?,?,?,?)',
        [$u['id'], $action, $entity, (string)$id, substr($_SERVER['REMOTE_ADDR'] ?? 'CLI', 0, 50)]);
}
function ns_escape(mixed $s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
