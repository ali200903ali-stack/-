<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/src/Accounting.php';

header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
$op = (string)($_GET['op'] ?? '');
$body = [];
try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        ns_csrf();
        $body = ns_input();
        $op = (string)($body['op'] ?? $op);
        if ($op === 'login') {
            $email = strtolower(trim((string)($body['email'] ?? '')));
            $pass = (string)($body['password'] ?? '');
            if (strlen($email) > 190 || strlen($pass) > 500) ns_fail('بيانات الدخول غير صحيحة',401);
            $u = ns_one('SELECT * FROM users WHERE email=? AND active=1',[$email]);
            // Timing-safe dummy hash to reduce observable account enumeration.
            $hash = $u['password_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi';
            if (!password_verify($pass,$hash) || !$u) {
                usleep(150000);
                ns_fail('البريد الإلكتروني أو كلمة المرور غير صحيحة',401);
            }
            session_regenerate_id(true);
            $_SESSION['uid']=(int)$u['id']; $_SESSION['csrf']=bin2hex(random_bytes(32));
            ns_json(['ok'=>true,'csrf'=>$_SESSION['csrf'],'user'=>[
                'id'=>(int)$u['id'],'name'=>$u['name'],'role'=>$u['role'],'branch_id'=>$u['branch_id']
            ]]);
        }
        if ($op === 'logout') {
            $_SESSION=[]; session_regenerate_id(true);
            ns_json(['ok'=>true]);
        }
    }
    $u = ns_user();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        switch ($op) {
            case 'save_invoice': ns_json(['ok'=>true,'data'=>ns_save_invoice($u,$body)]);
            case 'post_invoice': ns_json(['ok'=>true,'data'=>ns_post_invoice($u,ns_int($body['id']??0,1))]);
            case 'post_journal': ns_json(['ok'=>true,'data'=>ns_post_manual_journal($u,$body)]);
            case 'post_voucher': ns_json(['ok'=>true,'data'=>ns_post_voucher($u,$body)]);
            case 'save_party':
                ns_role($u,['admin','accountant','cashier']);
                $kind = (string)($body['kind'] ?? '');
                if (!in_array($kind,['customers','suppliers'],true)) ns_fail('نوع الطرف غير صحيح');
                $name=ns_text($body['name']??'');
                if (!$name) ns_fail('اسم العميل أو المورد مطلوب');
                $phone=ns_text($body['phone']??'',50);
                $address=ns_text($body['address']??'',255);
                $id=ns_int($body['id']??0);
                if ($id) {
                    if (!ns_one("SELECT id FROM $kind WHERE id=?",[$id])) ns_fail('السجل غير موجود',404);
                    ns_query("UPDATE $kind SET name=?,phone=?,address=? WHERE id=?",[$name,$phone,$address,$id]);
                } else {
                    ns_query("INSERT INTO $kind(name,phone,address) VALUES(?,?,?)",[$name,$phone,$address]);
                    $id=(int)ns_db()->lastInsertId();
                }
                ns_audit($u,'saved',$kind,$id);
                ns_json(['ok'=>true,'data'=>['id'=>$id]]);
            case 'save_product':
                ns_role($u,['admin','accountant']);
                $id=ns_int($body['id']??0);
                $sku=ns_text($body['sku']??'',100);
                $name=ns_text($body['name']??'');
                $unit=ns_text($body['unit']??'حبة',50);
                if (!$sku || !$name || !$unit) ns_fail('رمز الصنف واسمه ووحدته مطلوبة');
                $category=ns_text($body['category']??'',100);
                $price=ns_dec(ns_money($body['price']??0));
                $minStock=(float)($body['min_stock']??0);
                if (!is_finite($minStock) || $minStock<0) ns_fail('الحد الأدنى غير صالح');
                $track=!empty($body['track_stock'])?1:0;
                if ($id) {
                    if (!ns_one('SELECT id FROM products WHERE id=?',[$id])) ns_fail('الصنف غير موجود');
                    ns_query('UPDATE products SET sku=?,name=?,category=?,unit=?,price=?,min_stock=?,track_stock=? WHERE id=?',
                        [$sku,$name,$category,$unit,$price,$minStock,$track,$id]);
                    ns_audit($u,'updated','product',$id);
                } else {
                    $opening=round((float)($body['opening_qty']??0),3);
                    if (!is_finite($opening) || $opening<0 || $opening>1000000000) ns_fail('الكمية الافتتاحية غير صالحة');
                    $cost=ns_money($body['cost']??0);
                    $branch=ns_int($body['branch_id']??$u['branch_id']??1,1);
                    ns_branch($u,$branch);
                    $pdo=ns_db();$pdo->beginTransaction();
                    try {
                        ns_query('INSERT INTO products(sku,name,category,unit,price,cost,stock,min_stock,track_stock) VALUES(?,?,?,?,?,?,?,?,?)',
                            [$sku,$name,$category,$unit,$price,ns_dec($cost),$opening,$minStock,$track]);
                        $id=(int)$pdo->lastInsertId();
                        $value=(int)round($opening*$cost);
                        if ($value) {
                            $number=ns_sequence('OPEN');
                            ns_journal_post($u,'opening',$id,$number,date('Y-m-d'),'رصيد افتتاحي للصنف '.$name,$branch,[
                                ns_line(ns_account('120'),$value),ns_line(ns_account('300'),0,$value)
                            ]);
                        }
                        ns_audit($u,'created','product',$id);
                        $pdo->commit();
                    } catch (Throwable $e) {if($pdo->inTransaction())$pdo->rollBack();throw $e;}
                }
                ns_json(['ok'=>true,'data'=>['id'=>$id]]);
            case 'save_branch':
                ns_role($u,['admin']);
                $name=ns_text($body['name']??'',140);
                if (!$name) ns_fail('اسم الفرع مطلوب');
                $id=ns_int($body['id']??0);
                if ($id) ns_query('UPDATE branches SET name=? WHERE id=?',[$name,$id]);
                else {ns_query('INSERT INTO branches(name) VALUES(?)',[$name]);$id=(int)ns_db()->lastInsertId();}
                ns_audit($u,'saved','branch',$id);
                ns_json(['ok'=>true,'data'=>['id'=>$id]]);
            case 'save_account':
                ns_role($u,['admin','accountant']);
                $code=ns_text($body['code']??'',30);
                $name=ns_text($body['name']??'',160);
                $type=(string)($body['type']??'');
                if (!$code || !$name || !in_array($type,['asset','liability','equity','revenue','expense'],true)) ns_fail('أدخل بيانات الحساب كاملة');
                $id=ns_int($body['id']??0);
                if ($id) {
                    $old=ns_one('SELECT is_system FROM accounts WHERE id=?',[$id]);
                    if (!$old || $old['is_system']) ns_fail('لا يمكن تعديل الحسابات الأساسية');
                    ns_query('UPDATE accounts SET code=?,name=?,type=? WHERE id=?',[$code,$name,$type,$id]);
                } else {ns_query('INSERT INTO accounts(code,name,type) VALUES(?,?,?)',[$code,$name,$type]);$id=(int)ns_db()->lastInsertId();}
                ns_audit($u,'saved','account',$id);
                ns_json(['ok'=>true,'data'=>['id'=>$id]]);
            case 'save_user':
                ns_role($u,['admin']);
                $id=ns_int($body['id']??0);
                $name=ns_text($body['name']??'',120);
                $email=strtolower(ns_text($body['email']??'',190));
                $role=(string)($body['role']??'viewer');
                $branch=ns_int($body['branch_id']??1,1);
                if (!$name || !filter_var($email,FILTER_VALIDATE_EMAIL) || !in_array($role,['admin','accountant','cashier','viewer'],true)) ns_fail('بيانات المستخدم غير صالحة');
                ns_branch($u,$branch);
                $pass=(string)($body['password']??'');
                if ($id && $id===(int)$u['id'] && $role!=='admin') ns_fail('لا يمكن إزالة صلاحية مديرك الحالي');
                if ($id) {
                    ns_query('UPDATE users SET name=?,email=?,role=?,branch_id=? WHERE id=?',[$name,$email,$role,$branch,$id]);
                    if ($pass !== '') {
                        if (strlen($pass)<12) ns_fail('كلمة المرور يجب أن تكون 12 حرفاً على الأقل');
                        ns_query('UPDATE users SET password_hash=? WHERE id=?',[password_hash($pass,PASSWORD_DEFAULT),$id]);
                    }
                } else {
                    if (strlen($pass)<12) ns_fail('كلمة مرور المستخدم الجديد يجب أن تكون 12 حرفاً على الأقل');
                    ns_query('INSERT INTO users(name,email,password_hash,role,branch_id) VALUES(?,?,?,?,?)',
                        [$name,$email,password_hash($pass,PASSWORD_DEFAULT),$role,$branch]);
                    $id=(int)ns_db()->lastInsertId();
                }
                ns_audit($u,'saved','user',$id);
                ns_json(['ok'=>true,'data'=>['id'=>$id]]);
            case 'save_settings':
                ns_role($u,['admin']);
                $name=ns_text($body['company']??'',190);
                if (!$name) ns_fail('اسم الشركة مطلوب');
                $currency=ns_text($body['currency']??'YER',8);
                if (!preg_match('/^[A-Z]{3}$/',$currency)) ns_fail('كود العملة غير صالح');
                foreach (['company'=>$name,'currency'=>$currency] as $key=>$v) ns_query(
                    'INSERT INTO settings(name,value) VALUES(?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',[$key,$v]
                );
                ns_audit($u,'saved','settings',0);
                ns_json(['ok'=>true]);
            default: ns_fail('عملية غير مدعومة',404);
        }
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') ns_fail('الطلب غير مسموح',405);
    $scope = $u['role'] === 'cashier' ? (int)$u['branch_id'] : 0;
    $filterBranch=isset($_GET['branch']) && $_GET['branch']!=='' ? ns_int($_GET['branch']) : $scope;
    if ($scope && $filterBranch!==$scope) ns_fail('لا يمكنك عرض فرع آخر',403);
    if ($filterBranch && !ns_one('SELECT id FROM branches WHERE id=?',[$filterBranch])) ns_fail('الفرع غير موجود');
    $from=!empty($_GET['from'])?ns_date($_GET['from']):'2000-01-01';
    $to=!empty($_GET['to'])?ns_date($_GET['to']):'2099-12-31';
    if ($from>$to) ns_fail('بداية الفترة بعد نهايتها');
    switch ($op) {
        case 'bootstrap':
            $settings=[];foreach(ns_rows('SELECT name,value FROM settings') as $s)$settings[$s['name']]=$s['value'];
            ns_json(['ok'=>true,'data'=>[
                'user'=>$u,'csrf'=>$_SESSION['csrf'],'today'=>date('Y-m-d'),'settings'=>$settings,
                'products'=>ns_rows('SELECT * FROM products WHERE active=1 ORDER BY name'),
                'customers'=>ns_rows('SELECT * FROM customers ORDER BY name'),
                'suppliers'=>ns_rows('SELECT * FROM suppliers ORDER BY name'),
                'accounts'=>ns_rows('SELECT * FROM accounts WHERE active=1 ORDER BY code'),
                'branches'=>ns_rows('SELECT * FROM branches WHERE active=1 ORDER BY id'),
                'integrations'=>['wasl'=>'not_configured','whatsapp'=>'not_configured'],
            ]]);
        case 'list':
            $type=(string)($_GET['type']??'');
            if (in_array($type,['sales','purchases','returns'],true)) {
                $kind=['sales'=>'sale','purchases'=>'purchase','returns'=>'return'][$type];
                $sql="SELECT i.id,i.number,i.kind,i.status,i.date,i.total,i.paid,i.payment,i.branch_id,
                  COALESCE(c.name,s.name,'—') party_name
                  FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id
                  LEFT JOIN suppliers s ON s.id=i.supplier_id
                  WHERE i.kind=? AND i.date BETWEEN ? AND ?";
                $params=[$kind,$from,$to];
                if ($filterBranch) {$sql.=' AND i.branch_id=?';$params[]=$filterBranch;}
                $sql.=' ORDER BY i.id DESC LIMIT 500';
                ns_json(['ok'=>true,'data'=>ns_rows($sql,$params)]);
            }
            if (in_array($type,['products','customers','suppliers','accounts','branches'],true)) {
                $data=ns_rows('SELECT * FROM '.$type.' ORDER BY id DESC LIMIT 1000');
                ns_json(['ok'=>true,'data'=>$data]);
            }
            if ($type === 'users') {
                ns_role($u,['admin']);
                ns_json(['ok'=>true,'data'=>ns_rows('SELECT id,name,email,role,branch_id,active,created_at FROM users ORDER BY id DESC')]);
            }
            if ($type === 'journal') {
                $sql="SELECT j.id,j.number,j.date,j.description,j.source,j.branch_id,
                    SUM(jl.debit) debit,SUM(jl.credit) credit
                    FROM journal_entries j JOIN journal_lines jl ON jl.journal_id=j.id
                    WHERE j.date BETWEEN ? AND ?";
                $params=[$from,$to];
                if ($filterBranch){$sql.=' AND j.branch_id=?';$params[]=$filterBranch;}
                $sql.=' GROUP BY j.id ORDER BY j.id DESC LIMIT 500';
                ns_json(['ok'=>true,'data'=>ns_rows($sql,$params)]);
            }
            if ($type === 'vouchers') {
                $sql="SELECT v.*,COALESCE(c.name,s.name) party_name
                    FROM vouchers v LEFT JOIN customers c ON c.id=v.party_id AND v.kind='receipt'
                    LEFT JOIN suppliers s ON s.id=v.party_id AND v.kind='payment'
                    WHERE v.date BETWEEN ? AND ?";
                $params=[$from,$to];
                if ($filterBranch){$sql.=' AND v.branch_id=?';$params[]=$filterBranch;}
                $sql.=' ORDER BY v.id DESC LIMIT 500';
                ns_json(['ok'=>true,'data'=>ns_rows($sql,$params)]);
            }
            ns_fail('القسم غير معروف',404);
        case 'doc':
            $id=ns_int($_GET['id']??0,1);
            $doc=ns_one('SELECT * FROM invoices WHERE id=?',[$id]);
            if (!$doc) ns_fail('المستند غير موجود',404);
            if ($scope && (int)$doc['branch_id']!==$scope) ns_fail('غير مصرح',403);
            $doc['lines']=ns_rows('SELECT il.*,p.name product_name,p.sku,p.unit FROM invoice_lines il JOIN products p ON p.id=il.product_id WHERE il.invoice_id=? ORDER BY il.id',[$id]);
            ns_json(['ok'=>true,'data'=>$doc]);
        case 'journal_doc':
            $id=ns_int($_GET['id']??0,1);
            $doc=ns_one('SELECT * FROM journal_entries WHERE id=?',[$id]);
            if (!$doc) ns_fail('القيد غير موجود',404);
            if ($scope && (int)$doc['branch_id']!==$scope) ns_fail('غير مصرح',403);
            $doc['lines']=ns_rows('SELECT jl.*,a.code,a.name account_name FROM journal_lines jl JOIN accounts a ON a.id=jl.account_id WHERE jl.journal_id=?',[$id]);
            ns_json(['ok'=>true,'data'=>$doc]);
        case 'dashboard':
            $params=[$from,$to];
            $branchSql='';
            if ($filterBranch) {$branchSql=' AND branch_id=?';$params[]=$filterBranch;}
            $invoices=ns_rows("SELECT kind,COUNT(*) n,SUM(total) total FROM invoices WHERE status='posted' AND date BETWEEN ? AND ? $branchSql GROUP BY kind",$params);
            $totals=['sale'=>0,'purchase'=>0,'return'=>0];foreach($invoices as $s)$totals[$s['kind']]=(float)$s['total'];
            $c=(int)ns_one('SELECT COUNT(*) count FROM customers')['count'];
            $stock=ns_one('SELECT COUNT(*) total_items, COALESCE(SUM(stock*cost),0) value FROM products WHERE active=1');
            $low=ns_rows('SELECT id,sku,name,stock,min_stock FROM products WHERE track_stock=1 AND active=1 AND stock<=min_stock ORDER BY stock LIMIT 8');
            $sql="SELECT number,kind,date,total,status FROM invoices WHERE date BETWEEN ? AND ? $branchSql ORDER BY id DESC LIMIT 8";
            $recent=ns_rows($sql,$params);
            $monthly=ns_rows("SELECT DATE_FORMAT(date,'%Y-%m') ym,kind,SUM(total) total FROM invoices WHERE status='posted' AND date>=DATE_SUB(CURDATE(), INTERVAL 6 MONTH) ".
                ($filterBranch?'AND branch_id='.(int)$filterBranch:'')." GROUP BY ym,kind ORDER BY ym");
            ns_json(['ok'=>true,'data'=>compact('totals','stock','low','recent','monthly')+['customers'=>$c]]);
        case 'report':
            $type=(string)($_GET['type']??'trial');
            $params=[$from,$to];
            $branchSql='';
            if ($filterBranch){$branchSql=' AND j.branch_id=?';$params[]=$filterBranch;}
            if ($type === 'trial' || $type === 'pnl' || $type === 'cashbox') {
                $rows=ns_rows("SELECT a.id,a.code,a.name,a.type,
                    COALESCE(SUM(jl.debit),0) debit, COALESCE(SUM(jl.credit),0) credit
                    FROM accounts a LEFT JOIN journal_lines jl ON jl.account_id=a.id
                    LEFT JOIN journal_entries j ON j.id=jl.journal_id AND j.date BETWEEN ? AND ? $branchSql
                    GROUP BY a.id,a.code,a.name,a.type ORDER BY a.code",$params);
                // Correctly restrict joined lines when branch/date did not match.
                $rows=ns_rows("SELECT a.id,a.code,a.name,a.type,
                    COALESCE(t.debit,0) debit,COALESCE(t.credit,0) credit FROM accounts a LEFT JOIN
                    (SELECT jl.account_id,SUM(jl.debit) debit,SUM(jl.credit) credit FROM journal_lines jl
                    JOIN journal_entries j ON j.id=jl.journal_id
                    WHERE j.date BETWEEN ? AND ? $branchSql GROUP BY jl.account_id) t ON t.account_id=a.id
                    ORDER BY a.code",$params);
                if ($type==='pnl') $rows=array_values(array_filter($rows,fn($r)=>in_array($r['type'],['revenue','expense'],true)));
                if ($type==='cashbox') $rows=array_values(array_filter($rows,fn($r)=>in_array($r['code'],['101','102'],true)));
                ns_json(['ok'=>true,'data'=>$rows]);
            }
            if ($type === 'stock') ns_json(['ok'=>true,'data'=>ns_rows('SELECT sku,name,category,unit,price,cost,stock,min_stock,(stock*cost) value FROM products WHERE active=1 ORDER BY name')]);
            if ($type === 'statement') {
                $partyType=(string)($_GET['party_type']??'customer');
                if (!in_array($partyType,['customer','supplier'],true)) ns_fail('نوع الطرف غير صحيح');
                $partyId=ns_int($_GET['party_id']??0,1);
                $sql="SELECT j.number,j.date,j.description,a.code,a.name account_name,jl.debit,jl.credit
                    FROM journal_lines jl JOIN journal_entries j ON j.id=jl.journal_id
                    JOIN accounts a ON a.id=jl.account_id WHERE jl.party_type=? AND jl.party_id=? AND j.date BETWEEN ? AND ?";
                $p=[$partyType,$partyId,$from,$to];
                if ($filterBranch){$sql.=' AND j.branch_id=?';$p[]=$filterBranch;}
                $sql.=' ORDER BY j.date,j.id';
                ns_json(['ok'=>true,'data'=>ns_rows($sql,$p)]);
            }
            ns_fail('التقرير غير معروف',404);
        case 'backup':
            ns_role($u,['admin']);
            // Structured data export, not a full disaster-recovery SQL backup.
            // Password hashes are intentionally excluded.
            $tables=['branches','customers','suppliers','accounts','products','invoices','invoice_lines','journal_entries','journal_lines','vouchers','settings','sequences'];
            $backup=['version'=>1,'exported_at'=>date(DATE_ATOM),'source'=>'NineSoft','tables'=>[]];
            foreach($tables as $table)$backup['tables'][$table]=ns_rows("SELECT * FROM $table");
            header('Content-Type: application/json; charset=utf-8');
            header('Content-Disposition: attachment; filename="ninesoft-data-'.date('Ymd-His').'.json"');
            echo json_encode($backup,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
            exit;
        default: ns_fail('الطلب غير معروف',404);
    }
} catch (PDOException $e) {
    error_log('NineSoft database: '.$e->getMessage());
    if ((string)$e->getCode()==='23000') ns_fail('السجل مكرر أو مرتبط ببيانات أخرى',409);
    ns_fail('تعذر حفظ البيانات، تحقق من الاتصال وإعدادات قاعدة البيانات',500);
} catch (Throwable $e) {
    error_log('NineSoft: '.$e->getMessage());
    ns_fail('فشل الإجراء. تحقق من البيانات أو راجع سجل الخادم.',500);
}
