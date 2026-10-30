<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/bootstrap.php';
require_once dirname(__DIR__).'/src/Accounting.php';
$_SERVER['REMOTE_ADDR']='127.0.0.1';
function assertEq(mixed $actual,mixed $expected,string $label): void {
    if ((string)$actual!==(string)$expected) throw new RuntimeException("$label: expected ".var_export($expected,true).' but got '.var_export($actual,true));
    echo "PASS: $label\n";
}
function sumBalance(): array {
    return ns_one('SELECT ROUND(COALESCE(SUM(debit),0),2) debit, ROUND(COALESCE(SUM(credit),0),2) credit FROM journal_lines') ?? [];
}
$pdo=ns_db();
$sql=preg_replace('/^\s*--[^\n]*\n/m','',file_get_contents(dirname(__DIR__).'/schema.sql'));
foreach(explode(';',(string)$sql) as $stmt) if(trim($stmt)!=='')$pdo->exec($stmt);
ns_query("INSERT INTO branches (name) VALUES ('الرئيسي')");
ns_query("INSERT INTO customers (name) VALUES ('عميل نقدي'),('عميل اختبار')");
ns_query("INSERT INTO suppliers (name) VALUES ('المورد التجريبي')");
$chart=[
    ['101','Cash','asset'],['102','Bank','asset'],
    ['110','Accounts receivable','asset'],['120','Stock','asset'],
    ['121','VAT Input','asset'],['201','Accounts payable','liability'],
    ['210','VAT Output','liability'],['300','Capital','equity'],
    ['400','Sales','revenue'],['500','Expenses','expense'],['510','Cost of sales','expense']
];
foreach($chart as [$code,$name,$type])ns_query('INSERT INTO accounts(code,name,type,is_system) VALUES(?,?,?,1)',[$code,$name,$type]);
ns_query('INSERT INTO users(name,email,password_hash,role,branch_id) VALUES(?,?,?,?,?)',
    ['Smoke','smoke@example.com',password_hash('test-password-for-smoke',PASSWORD_DEFAULT),'admin',1]);
$u=ns_one('SELECT * FROM users WHERE id=1');
ns_query('INSERT INTO products(sku,name,unit,price,cost,stock,min_stock,track_stock) VALUES(?,?,?,?,?,?,?,?)',
    ['SMOKE001','صنف اختبار','حبة','12.00','5.00','10.000',1,1]);
assertEq((int)ns_one('SELECT COUNT(*) n FROM products')['n'],1,'product seeded');

$pdo->beginTransaction();
$openNumber=ns_sequence('OPEN');
ns_journal_post($u,'opening',1,$openNumber,'2026-10-29','Opening inventory',1,[
    ns_line(ns_account('120'),5000),
    ns_line(ns_account('300'),0,5000)
]);
$pdo->commit();
assertEq(str_starts_with($openNumber,'OPEN-'),true,'opening source journal');

$sale=ns_save_invoice($u,[
    'kind'=>'sale','date'=>'2026-10-29','branch_id'=>1,'customer_id'=>2,
    'payment'=>'credit','lines'=>[['product_id'=>1,'qty'=>2,'price'=>12]],
    'discount'=>0,'tax_rate'=>0
]);
assertEq($sale['status'],'draft','sale saved as draft');
assertEq($sale['revision'],1,'new draft revision');
$posted=ns_post_invoice($u,$sale['id']);
assertEq($posted['status'],'posted','sale posted');
assertEq(ns_one('SELECT stock FROM products WHERE id=1')['stock'],'8.000','sale decrements stock');
assertEq(ns_one('SELECT total FROM invoices WHERE id=?',[$sale['id']])['total'],'24.00','sale total');
$duplicate=ns_post_invoice($u,$sale['id']);
assertEq($duplicate['already_posted'],true,'duplicate posting is idempotent');
assertEq(ns_one('SELECT stock FROM products WHERE id=1')['stock'],'8.000','idempotence preserves stock');

$purchase=ns_save_invoice($u,[
    'kind'=>'purchase','date'=>'2026-10-29','branch_id'=>1,'supplier_id'=>1,
    'payment'=>'credit','lines'=>[['product_id'=>1,'qty'=>4,'price'=>8]],
    'discount'=>0,'tax_rate'=>0
]);
ns_post_invoice($u,$purchase['id']);
assertEq(ns_one('SELECT stock FROM products WHERE id=1')['stock'],'12.000','purchase increments stock');
assertEq(ns_one('SELECT cost FROM products WHERE id=1')['cost'],'6.00','weighted-average cost');

$receipt=ns_post_voucher($u,[
    'kind'=>'receipt','date'=>'2026-10-29','party_id'=>2,
    'account_id'=>ns_account('101'),'branch_id'=>1,'amount'=>10,'description'=>'Debt payment'
]);
assertEq(str_starts_with($receipt['number'],'VCH-'),true,'customer receipt');

$payment=ns_post_voucher($u,[
    'kind'=>'payment','date'=>'2026-10-29','party_id'=>1,
    'account_id'=>ns_account('101'),'branch_id'=>1,'amount'=>15,'description'=>'Supplier payment'
]);
assertEq(str_starts_with($payment['number'],'VCH-'),true,'supplier payment');

$cashSale=ns_save_invoice($u,[
    'kind'=>'sale','date'=>'2026-10-29','branch_id'=>1,'customer_id'=>2,
    'payment'=>'cash','lines'=>[['product_id'=>1,'qty'=>3,'price'=>12]],
    'discount'=>0,'tax_rate'=>0
]);
ns_post_invoice($u,$cashSale['id']);
assertEq(ns_one('SELECT stock FROM products WHERE id=1')['stock'],'9.000','cash sale decrements stock');

$return=ns_save_invoice($u,[
    'kind'=>'return','date'=>'2026-10-29','branch_id'=>1,'customer_id'=>2,
    'reference_id'=>$cashSale['id'],'payment'=>'cash','lines'=>[['product_id'=>1,'qty'=>1,'price'=>12]],
    'discount'=>0,'tax_rate'=>0
]);
ns_post_invoice($u,$return['id']);
assertEq(ns_one('SELECT stock FROM products WHERE id=1')['stock'],'10.000','cash refund returns item to stock');

$manual=ns_post_manual_journal($u,[
    'date'=>'2026-10-29','description'=>'Operational expense','branch_id'=>1,
    'lines'=>[
        ['account_id'=>ns_account('500'),'debit'=>2.5,'credit'=>0],
        ['account_id'=>ns_account('101'),'debit'=>0,'credit'=>2.5]
    ]
]);
assertEq(str_starts_with($manual['number'],'JV-'),true,'manual journal on allowed accounts');
$bal=sumBalance();
assertEq($bal['debit'],$bal['credit'],'debits equal credits across ledger');
assertEq(ns_one("SELECT COUNT(*) n FROM journal_entries WHERE source='sale'")['n'],2,'two sales produced two journal entries');
assertEq(ns_one("SELECT COUNT(*) n FROM journal_entries WHERE source='return'")['n'],1,'return produced journal entry');
assertEq(ns_one("SELECT COUNT(*) n FROM journal_entries WHERE source='voucher'")['n'],2,'vouchers produced journal entries');
echo "ALL ACCOUNTING SMOKE TESTS PASSED\n";
