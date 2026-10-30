<?php
declare(strict_types=1);
require_once __DIR__ . '/../bootstrap.php';

/**
 * Server-authoritative accounting service.
 * No browser localStorage is ever an accounting source.
 * All posting is executed inside one database transaction and cannot be repeated.
 */
function ns_totals(array $doc, array $lines): array {
    if (!$lines || count($lines) > 100) ns_fail('يجب إدخال صنف واحد على الأقل (بحد أقصى 100)');
    $gross = 0;
    foreach ($lines as $l) {
        $qty = ns_qty($l['qty']);
        $price = ns_money($l['price']);
        $gross += (int)round($qty * $price);
    }
    if ($gross <= 0) ns_fail('إجمالي الفاتورة يجب أن يكون أكبر من صفر');
    $discount = ns_money($doc['discount'] ?? 0);
    if (($doc['discount_type'] ?? 'amount') === 'percent') {
        if ($discount > 10000) ns_fail('الخصم النسبي أكبر من 100%');
        $discount = (int)round($gross * $discount / 10000);
    } elseif (($doc['discount_type'] ?? 'amount') !== 'amount') ns_fail('نوع الخصم غير صالح');
    if ($discount > $gross) ns_fail('الخصم أكبر من قيمة البنود');
    $taxPercent = (float)($doc['tax_rate'] ?? 0);
    if (!is_finite($taxPercent) || $taxPercent < 0 || $taxPercent > 100) ns_fail('نسبة الضريبة غير صحيحة');
    $net = $gross - $discount;
    $tax = (int)round($net * $taxPercent / 100);
    $total = $net + $tax;
    $paid = isset($doc['paid']) && $doc['paid'] !== '' ? ns_money($doc['paid'])
        : (($doc['payment'] ?? 'cash') === 'credit' ? 0 : $total);
    if ($paid > $total) ns_fail('المبلغ المدفوع أكبر من الإجمالي');
    return compact('gross','discount','net','tax','total','paid');
}
function ns_journal_post(
    array $u, string $source, ?int $sourceId, string $number, string $date,
    string $description, int $branch, array $lines
): int {
    $dr = 0; $cr = 0;
    if (count($lines) < 2 || count($lines) > 100) ns_fail('القيد يحتاج سطرين على الأقل');
    foreach ($lines as $l) {
        $d = (int)$l['debit']; $c = (int)$l['credit'];
        if ($d < 0 || $c < 0 || ($d && $c) || (!$d && !$c)) ns_fail('كل سطر يجب أن يحتوي مديناً أو دائناً فقط');
        $dr += $d; $cr += $c;
    }
    if ($dr <= 0 || $dr !== $cr) ns_fail('القيد غير متوازن؛ لا يمكن الترحيل');
    ns_query('INSERT INTO journal_entries(number,date,description,branch_id,source,source_id,created_by) VALUES(?,?,?,?,?,?,?)',
        [$number,$date,$description,$branch,$source,$sourceId,$u['id']]);
    $jid = (int)ns_db()->lastInsertId();
    foreach ($lines as $l) {
        ns_query('INSERT INTO journal_lines(journal_id,account_id,debit,credit,party_type,party_id) VALUES(?,?,?,?,?,?)',[
            $jid,(int)$l['account'],ns_dec((int)$l['debit']),ns_dec((int)$l['credit']),
            $l['party_type'] ?? null,$l['party_id'] ?? null,
        ]);
    }
    return $jid;
}
function ns_line(int $account, int $debit = 0, int $credit = 0, ?string $partyType = null, ?int $partyId = null): array {
    return ['account'=>$account,'debit'=>$debit,'credit'=>$credit,'party_type'=>$partyType,'party_id'=>$partyId];
}
function ns_save_invoice(array $u, array $body): array {
    ns_role($u, ['admin','accountant','cashier']);
    $pdo = ns_db();
    $kind = (string)($body['kind'] ?? '');
    if (!in_array($kind,['sale','purchase','return'],true)) ns_fail('نوع الفاتورة غير صالح');
    $payment = (string)($body['payment'] ?? 'cash');
    if (!in_array($payment,['cash','bank','credit'],true)) ns_fail('طريقة الدفع غير صالحة');
    $branch = ns_int($body['branch_id'] ?? $u['branch_id'] ?? 1, 1);
    ns_branch($u,$branch);
    $date = ns_date($body['date'] ?? date('Y-m-d'));
    $party = ns_int($kind === 'purchase' ? ($body['supplier_id'] ?? 0) : ($body['customer_id'] ?? 0),1);
    $table = $kind === 'purchase' ? 'suppliers' : 'customers';
    if (!ns_one("SELECT id FROM $table WHERE id=?",[$party])) ns_fail('الطرف المحدد غير موجود');
    $reference = $kind === 'return' ? ns_int($body['reference_id'] ?? 0,1) : null;
    $lines = $body['lines'] ?? [];
    if (!is_array($lines) || count($lines) < 1 || count($lines) > 100) ns_fail('أضف أصنافاً إلى الفاتورة');
    $clean = [];
    $seen = [];
    foreach ($lines as $l) {
        if (!is_array($l)) ns_fail('سطر فاتورة غير صالح');
        $pid = ns_int($l['product_id'] ?? 0,1);
        if (isset($seen[$pid])) ns_fail('ادمج سطور الصنف المكرر في سطر واحد');
        $seen[$pid] = true;
        $qty = ns_qty($l['qty'] ?? 0);
        $price = ns_dec(ns_money($l['price'] ?? -1));
        $clean[] = ['product_id'=>$pid,'qty'=>$qty,'price'=>$price];
    }
    $discountType = (string)($body['discount_type'] ?? 'amount');
    $doc = [
        'discount'=>$body['discount'] ?? 0,
        'discount_type'=>$discountType,
        'tax_rate'=>$body['tax_rate'] ?? 0,
        'payment'=>$payment,
        'paid'=>$body['paid'] ?? null,
    ];
    $totals = ns_totals($doc,$clean);
    if ($kind === 'return') {
        $original = ns_one("SELECT * FROM invoices WHERE id=? AND kind='sale' AND status='posted'",[$reference]);
        if (!$original) ns_fail('يجب اختيار فاتورة مبيعات مرحّلة');
        if (ns_money($original['paid']) !== ns_money($original['total'])) ns_fail('مرتجع الآجل أو المدفوع جزئياً يحتاج تسوية ذمم غير متاحة في هذا الإصدار');
        if ((int)$original['branch_id'] !== $branch) ns_fail('مرتجع من فرع مختلف غير مدعوم');
        if ((int)$original['customer_id'] !== $party) ns_fail('عميل المرتجع لا يطابق فاتورته');
        if (ns_money($doc['discount']) !== 0 || abs((float)$doc['tax_rate']-(float)$original['tax_rate']) > .001) {
            ns_fail('لا تعدّل ضريبة أو خصم المرتجع عن الأصل');
        }
        $srcLines = ns_rows('SELECT product_id,qty,price FROM invoice_lines WHERE invoice_id=?',[$reference]);
        $originGross = ns_money($original['subtotal']);
        $ratio = $originGross > 0 ? ns_money($original['net'])/$originGross : 1;
        foreach ($clean as $r) {
            $src = null;
            foreach ($srcLines as $s) if ((int)$s['product_id']===(int)$r['product_id']) $src = $s;
            if (!$src) ns_fail('الصنف غير موجود في الفاتورة الأصلية');
            $expected = (int)round(ns_money($src['price']) * $ratio);
            if (abs(ns_money($r['price']) - $expected) > 1) ns_fail('سعر المرتجع يجب أن يطابق سعر البيع بعد الخصم');
        }
    }
    $id = isset($body['id']) ? ns_int($body['id']) : 0;
    $pdo->beginTransaction();
    try {
        if ($id) {
            $old = ns_one('SELECT * FROM invoices WHERE id=? FOR UPDATE',[$id]);
            if (!$old || $old['kind'] !== $kind || $old['status'] !== 'draft') ns_fail('المسودة غير قابلة للتعديل',409);
            ns_branch($u,(int)$old['branch_id']);
            if ((int)$old['revision'] !== (int)($body['revision'] ?? 0)) ns_fail('تم تعديل المسودة من جهاز آخر. أعد تحميلها.',409);
            $number = $old['number'];
        } else {
            $number = ns_sequence(['sale'=>'INV','purchase'=>'PUR','return'=>'RET'][$kind]);
        }
        $sqlFields = [$branch,$kind==='purchase'?null:$party,$kind==='purchase'?$party:null,
            $reference,$date,$payment,ns_dec($totals['paid']),ns_dec(ns_money($doc['discount'])),
            $discountType,(float)$doc['tax_rate'],ns_dec($totals['gross']),ns_dec($totals['net']),
            ns_dec($totals['tax']),ns_dec($totals['total']),ns_text($body['note'] ?? '',2000)];
        if ($id) {
            ns_query('UPDATE invoices SET branch_id=?,customer_id=?,supplier_id=?,reference_id=?,date=?,payment=?,paid=?,discount=?,discount_type=?,tax_rate=?,subtotal=?,net=?,tax=?,total=?,note=?,revision=revision+1 WHERE id=?',
                [...$sqlFields,$id]);
            ns_query('DELETE FROM invoice_lines WHERE invoice_id=?',[$id]);
        } else {
            ns_query('INSERT INTO invoices(branch_id,customer_id,supplier_id,reference_id,date,payment,paid,discount,discount_type,tax_rate,subtotal,net,tax,total,note,number,kind,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [...$sqlFields,$number,$kind,$u['id']]);
            $id = (int)$pdo->lastInsertId();
        }
        foreach ($clean as $l) {
            if (!ns_one('SELECT id FROM products WHERE id=? AND active=1',[$l['product_id']])) ns_fail('صنف غير موجود');
            ns_query('INSERT INTO invoice_lines(invoice_id,product_id,qty,price) VALUES(?,?,?,?)',
                [$id,$l['product_id'],$l['qty'],$l['price']]);
        }
        ns_audit($u,'draft_saved','invoice',$id);
        $pdo->commit();
        return ['id'=>$id,'number'=>$number,'status'=>'draft','revision'=>($old['revision'] ?? 0)+1];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
function ns_post_invoice(array $u, int $id): array {
    ns_role($u,['admin','accountant','cashier']);
    $pdo = ns_db();
    $pdo->beginTransaction();
    try {
        $d = ns_one('SELECT * FROM invoices WHERE id=? FOR UPDATE',[$id]);
        if (!$d) ns_fail('الفاتورة غير موجودة',404);
        ns_branch($u,(int)$d['branch_id']);
        if ($d['status'] === 'posted') {
            $pdo->commit();
            return ['id'=>$id,'number'=>$d['number'],'status'=>'posted','already_posted'=>true];
        }
        $lines = ns_rows('SELECT * FROM invoice_lines WHERE invoice_id=? ORDER BY product_id,id',[$id]);
        $t = ns_totals($d,$lines);
        if ($d['kind'] === 'sale' && $t['total'] > $t['paid'] && (int)$d['customer_id'] === 1) ns_fail('البيع الآجل يتطلب عميلاً حقيقياً');
        // Verify totals have not changed since draft was saved.
        if (abs(ns_money($d['total']) - $t['total']) > 1) ns_fail('مجموع الفاتورة غير متطابق، احفظ المسودة مجدداً');
        $products = [];
        foreach ($lines as $l) {
            $pid = (int)$l['product_id'];
            if (!isset($products[$pid])) {
                $p = ns_one('SELECT * FROM products WHERE id=? AND active=1 FOR UPDATE',[$pid]);
                if (!$p) ns_fail('أحد الأصناف غير متوفر');
                $products[$pid] = $p;
            }
        }
        $account = $d['payment']==='bank' ? ns_account('102') : ns_account('101');
        $ledger = [];
        $paid = $t['paid']; $due = $t['total']-$paid;
        if ($d['kind'] === 'sale') {
            if ($paid) $ledger[] = ns_line($account,$paid);
            if ($due) $ledger[] = ns_line(ns_account('110'),$due,0,'customer',(int)$d['customer_id']);
            $ledger[] = ns_line(ns_account('400'),0,$t['net']);
            if ($t['tax']) $ledger[] = ns_line(ns_account('210'),0,$t['tax']);
            $cost = 0;
            $byProduct = [];
            foreach ($lines as $l) {
                $pid=(int)$l['product_id']; $q=(float)$l['qty'];
                $byProduct[$pid]=($byProduct[$pid]??0)+$q;
                $c=(int)$products[$pid]['track_stock'] ? ns_money($products[$pid]['cost']) : 0;
                $cost+=(int)round($q*$c);
                ns_query('UPDATE invoice_lines SET cost_at_post=? WHERE id=?',[ns_dec($c),(int)$l['id']]);
            }
            foreach ($byProduct as $pid=>$q) {
                if ((int)$products[$pid]['track_stock'] && (float)$products[$pid]['stock']+.0001 < $q) ns_fail('المخزون غير كاف للصنف '.$products[$pid]['name']);
                if ((int)$products[$pid]['track_stock']) ns_query('UPDATE products SET stock=stock-? WHERE id=?',[$q,$pid]);
            }
            if ($cost) {
                $ledger[]=ns_line(ns_account('510'),$cost);
                $ledger[]=ns_line(ns_account('120'),0,$cost);
            }
        } elseif ($d['kind'] === 'purchase') {
            if ($t['tax']) $ledger[]=ns_line(ns_account('121'),$t['tax']);
            if ($paid) $ledger[]=ns_line($account,0,$paid);
            if ($due) $ledger[]=ns_line(ns_account('201'),0,$due,'supplier',(int)$d['supplier_id']);
            // Allocate discount proportionally between inventory and non-stock expenses.
            $ratio = $t['gross'] > 0 ? $t['net']/$t['gross'] : 1;
            $trackedNet=0;
            foreach ($lines as $l) {
                $p = $products[(int)$l['product_id']]; $q=(float)$l['qty'];
                if (!(int)$p['track_stock']) {
                    ns_query('UPDATE invoice_lines SET cost_at_post=0 WHERE id=?',[(int)$l['id']]);
                    continue;
                }
                $oldQ=(float)$p['stock']; $oldCost=ns_money($p['cost']);
                $unitNew=(int)round(ns_money($l['price'])*$ratio);
                $avg=(int)round(($oldQ*$oldCost+$q*$unitNew)/max(.001,$oldQ+$q));
                $trackedNet+=(int)round(ns_money($l['price'])*$q*$ratio);
                ns_query('UPDATE products SET stock=stock+?,cost=? WHERE id=?',
                    [$q,ns_dec($avg),(int)$p['id']]);
                ns_query('UPDATE invoice_lines SET cost_at_post=? WHERE id=?',[ns_dec($unitNew),(int)$l['id']]);
                $products[(int)$p['id']]['stock']=$oldQ+$q;
                $products[(int)$p['id']]['cost']=ns_dec($avg);
            }
            $trackedNet=min($trackedNet,$t['net']);
            if ($trackedNet) $ledger[]=ns_line(ns_account('120'),$trackedNet);
            if ($t['net']>$trackedNet) $ledger[]=ns_line(ns_account('500'),$t['net']-$trackedNet);
        } else {
            $source = ns_one("SELECT * FROM invoices WHERE id=? AND kind='sale' AND status='posted' FOR UPDATE",[(int)$d['reference_id']]);
            if (!$source || (int)$source['customer_id'] !== (int)$d['customer_id'] || (int)$source['branch_id'] !== (int)$d['branch_id']) ns_fail('مرجع المرتجع غير صالح');
            if (ns_money($source['paid']) !== ns_money($source['total'])) ns_fail('مرتجع المبيعات الآجلة غير مدعوم دون تسوية ذمم');
            $srcLines = ns_rows('SELECT * FROM invoice_lines WHERE invoice_id=?',[$source['id']]);
            $returns = ns_rows("SELECT il.product_id, SUM(il.qty) qty FROM invoice_lines il JOIN invoices i ON i.id=il.invoice_id WHERE i.kind='return' AND i.status='posted' AND i.reference_id=? GROUP BY il.product_id",[$source['id']]);
            $used = []; foreach ($returns as $r) $used[(int)$r['product_id']] = (float)$r['qty'];
            $sold = []; $costMap=[];
            foreach ($srcLines as $r) {
                $pid=(int)$r['product_id'];
                $sold[$pid]=($sold[$pid]??0)+(float)$r['qty'];
                $costMap[$pid]=ns_money($r['cost_at_post']??0);
            }
            $newQty=[];$cost=0;
            foreach ($lines as $l) {
                $pid=(int)$l['product_id'];$q=(float)$l['qty'];
                $newQty[$pid]=($newQty[$pid]??0)+$q;
                if (!isset($sold[$pid]) || $newQty[$pid]+($used[$pid]??0)>$sold[$pid]+.0001) ns_fail('المرتجع يتجاوز كمية البيع الأصلية');
                $c=$costMap[$pid]; $cost+=(int)round($c*$q);
                ns_query('UPDATE invoice_lines SET cost_at_post=? WHERE id=?',[ns_dec($c),(int)$l['id']]);
            }
            $ledger[]=ns_line(ns_account('400'),$t['net']);
            if ($t['tax']) $ledger[]=ns_line(ns_account('210'),$t['tax']);
            if ($t['paid'] !== $t['total'] || $d['payment'] !== 'cash') ns_fail('المرتجع يصرف نقداً بالقيمة الكاملة فقط');
            // Return is always a cash refund in v1. No hidden customer-credit adjustment.
            $ledger[]=ns_line(ns_account('101'),0,$t['total']);
            if ($cost) {
                $ledger[]=ns_line(ns_account('120'),$cost);
                $ledger[]=ns_line(ns_account('510'),0,$cost);
            }
            foreach ($newQty as $pid=>$q) if ((int)$products[$pid]['track_stock']) ns_query('UPDATE products SET stock=stock+? WHERE id=?',[$q,$pid]);
        }
        ns_journal_post($u,$d['kind'],(int)$d['id'],$d['number'],$d['date'],
            ['sale'=>'فاتورة بيع','purchase'=>'فاتورة شراء','return'=>'مرتجع مبيعات'][$d['kind']].' '.$d['number'],
            (int)$d['branch_id'],$ledger);
        ns_query("UPDATE invoices SET status='posted',posted_at=NOW(),revision=revision+1 WHERE id=? AND status='draft'",[$id]);
        ns_audit($u,'posted','invoice',$id);
        $pdo->commit();
        return ['id'=>$id,'number'=>$d['number'],'status'=>'posted','already_posted'=>false];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
function ns_post_manual_journal(array $u,array $body): array {
    ns_role($u,['admin','accountant']);
    $branch=ns_int($body['branch_id']??1,1);ns_branch($u,$branch);
    $date=ns_date($body['date']??date('Y-m-d'));
    $desc=ns_text($body['description']??'',500);
    if (!$desc) ns_fail('أدخل بيان القيد');
    $input=$body['lines']??[];if (!is_array($input) || count($input)<2 || count($input)>100) ns_fail('القيد يتطلب سطرين على الأقل');
    $lines=[];
    foreach ($input as $l) {
        $accountId=ns_int($l['account_id']??0,1);
        $acc=ns_one('SELECT id,code FROM accounts WHERE id=? AND active=1',[$accountId]);
        if (!$acc) ns_fail('الحساب غير متوفر');
        if (in_array($acc['code'],['110','120','201','121','210','400','510'],true)) {
            ns_fail('لا يمكن ترحيل قيد يدوي مباشرة إلى حساب رقابي أو إيرادات المبيعات أو تكلفة البضاعة دون مستند مصدر');
        }
        $lines[]=ns_line($accountId,ns_money($l['debit']??0),ns_money($l['credit']??0));
    }
    $pdo=ns_db();$pdo->beginTransaction();
    try {
        $number=ns_sequence('JV');
        $id=ns_journal_post($u,'manual',null,$number,$date,$desc,$branch,$lines);
        ns_audit($u,'posted','journal',$id);
        $pdo->commit();
        return ['id'=>$id,'number'=>$number];
    } catch (Throwable $e) {if ($pdo->inTransaction()) $pdo->rollBack(); throw $e;}
}
function ns_post_voucher(array $u,array $body): array {
    ns_role($u,['admin','accountant','cashier']);
    $kind=(string)($body['kind']??'');
    if (!in_array($kind,['receipt','payment'],true)) ns_fail('نوع السند غير صحيح');
    $branch=ns_int($body['branch_id']??1,1);ns_branch($u,$branch);
    $date=ns_date($body['date']??date('Y-m-d'));
    $amount=ns_money($body['amount']??0,false);
    $accountId=ns_int($body['account_id']??0,1);
    if (!ns_one("SELECT id FROM accounts WHERE id=? AND code IN('101','102') AND active=1",[$accountId])) ns_fail('اختر الصندوق أو البنك');
    $partyId=ns_int($body['party_id']??0,1);
    $table=$kind==='receipt'?'customers':'suppliers';
    $party=ns_one("SELECT id,name FROM $table WHERE id=?",[$partyId]);
    if (!$party) ns_fail('الطرف غير موجود');
    $desc=ns_text($body['description']??('سند '.($kind==='receipt'?'قبض':'صرف').' - '.$party['name']),500);
    $pdo=ns_db();$pdo->beginTransaction();
    try {
        // Serialize vouchers against the party row; prevents concurrent over-receipts.
        ns_one("SELECT id FROM $table WHERE id=? FOR UPDATE",[$partyId]);
        // Serialize voucher payments per party and check receivable/payable balance.
        $partyType=$kind==='receipt'?'customer':'supplier';
        $arAccount=ns_account($kind==='receipt'?'110':'201');
        $bal=ns_one("SELECT COALESCE(SUM(jl.debit-jl.credit),0) balance
            FROM journal_lines jl JOIN journal_entries j ON j.id=jl.journal_id
            WHERE jl.party_type=? AND jl.party_id=? AND jl.account_id=? AND j.branch_id=?",
            [$partyType,$partyId,$arAccount,$branch]);
        $outstanding=$kind==='receipt'?ns_money(max(0,(float)$bal['balance'])):ns_money(max(0,-(float)$bal['balance']));
        if ($amount>$outstanding) ns_fail('المبلغ أكبر من الرصيد المستحق للطرف. لا تُدعم الدفعات المقدمة في هذه النسخة.');
        $number=ns_sequence('VCH');
        ns_query('INSERT INTO vouchers(number,kind,date,party_id,account_id,amount,description,branch_id,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
            [$number,$kind,$date,$partyId,$accountId,ns_dec($amount),$desc,$branch,$u['id']]);
        $id=(int)$pdo->lastInsertId();
        $lines=$kind==='receipt'
            ? [ns_line($accountId,$amount),ns_line($arAccount,0,$amount,'customer',$partyId)]
            : [ns_line($arAccount,$amount,0,'supplier',$partyId),ns_line($accountId,0,$amount)];
        ns_journal_post($u,'voucher',$id,$number,$date,$desc,$branch,$lines);
        ns_audit($u,'posted','voucher',$id);
        $pdo->commit();
        return ['id'=>$id,'number'=>$number];
    } catch (Throwable $e) {if ($pdo->inTransaction()) $pdo->rollBack(); throw $e;}
}
