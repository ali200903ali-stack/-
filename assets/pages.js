'use strict';
function searchBar(){
 return '<div class="page-filter"><div class="search-box"><input type="search" id="list-search" value="'+E(NS.search)+'" placeholder="بحث بالاسم أو الرقم أو الباركود..." aria-label="بحث"></div>'+
 '<div class="date-filter"><input type="date" id="filter-from" aria-label="من تاريخ" value="'+E(NS.from)+'"><input type="date" id="filter-to" aria-label="إلى تاريخ" value="'+E(NS.to)+'"></div>'+
 B('apply-filter','تحديث','search','btn-subtle')+' '+B('export-csv','CSV','download','btn-subtle')+'</div>';
}
function table(columns, rows, emptyMessage){
 if(!rows||!rows.length)return '<div class="empty"><span class="empty-emoji">📂</span><strong>لا توجد سجلات</strong><p>'+E(emptyMessage||'يمكنك إضافة أول سجل من زر الإنشاء بالأعلى.')+'</p></div>';
 return '<div class="table-wrap"><table class="data-table"><thead><tr>'+columns.map(function(c){return '<th>'+E(c)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
function filteredRows(){
 var q=(NS.search||'').toLowerCase().trim();
 if(!q)return NS.rows||[];
 return (NS.rows||[]).filter(function(r){return Object.values(r).some(function(x){return String(x??'').toLowerCase().includes(q)})});
}
function periodBranchLabel(){return NS.branch?'الفرع المحدد':'جميع الفروع المصرّح بها'}
function dashboardPage(){
 var s=NS.stats||{totals:{sale:0,purchase:0,return:0},stock:{value:0,total_items:0},customers:0,low:[],recent:[],monthly:[]};
 var kpis=[['إجمالي المبيعات',s.totals.sale,'sales','mint','فواتير مرحلة'],['إجمالي المشتريات',s.totals.purchase,'purchases','blue','فواتير مرحلة'],['قيمة المخزون',s.stock.value,'inventory','orange',F(s.stock.total_items,0)+' صنف'],['إجمالي العملاء',s.customers,'customers','cyan','العملاء المسجلون']];
 var monthly={};
 (s.monthly||[]).forEach(function(m){if(!monthly[m.ym])monthly[m.ym]={sale:0,purchase:0};monthly[m.ym][m.kind]=N(m.total)});
 var months=Object.keys(monthly).sort().slice(-6),max=Math.max(1,...months.map(function(m){return Math.max(monthly[m].sale,monthly[m].purchase)}));
 var chart='<div class="chart">'+months.map(function(m){return '<div class="chart-col"><div class="chart-bars"><div class="chart-bar" title="مبيعات '+F(monthly[m].sale)+'" style="height:'+Math.max(3,100*monthly[m].sale/max)+'%"></div><div class="chart-bar purchase" title="مشتريات '+F(monthly[m].purchase)+'" style="height:'+Math.max(3,100*monthly[m].purchase/max)+'%"></div></div><div class="chart-label num">'+E(m)+'</div></div>'}).join('')+'</div>';
 if(!months.length)chart='<div class="empty"><span class="empty-emoji">📊</span><p>سيظهر الرسم بعد ترحيل فواتير حقيقية.</p></div>';
 var recent=(s.recent||[]).map(function(d){return '<tr><td class="cell-name num">'+E(d.number)+'</td><td>'+E({sale:'بيع',purchase:'شراء',return:'مرتجع'}[d.kind])+'</td><td class="num">'+E(d.date)+'</td><td>'+M(d.total)+'</td><td>'+badge(d.status)+'</td></tr>'});
 var alerts=(s.low||[]).length?(s.low||[]).map(function(p){return '<div class="alert-row"><div><strong>'+E(p.name)+'</strong><br><small class="muted">الباركود '+E(p.sku)+'</small></div><span class="num">'+F(p.stock,3)+' / '+F(p.min_stock,3)+'</span></div>'}).join(''):'<div class="success-line">لا توجد أصناف تحت حد المخزون الأدنى.</div>';
 return '<section class="hero"><div class="hero-text"><h2>مرحباً بك في</h2><h1>ناين سوفت</h1><p>إدارة أعمالك بسهولة وكفاءة</p><div class="actions">'+B('new-sale','فاتورة مبيعات جديدة','plus','btn')+B('new-journal','قيد يومية','journal','btn-ghost')+'</div></div><div class="hero-visual"><div class="hero-logo-ring"></div><span class="hero-arrow">↗</span></div></section>'+
 '<section class="kpi-grid">'+kpis.map(function(k){return '<article class="kpi-card"><span class="kpi-icon tone-'+k[3]+'">'+S(k[2],28)+'</span><div class="kpi-label">'+k[0]+'</div><div class="kpi-number num">'+F(k[1])+'</div><div class="kpi-footer">'+E(k[3]==='cyan'?'عميل':'ريال')+' · '+k[4]+'</div></article>'}).join('')+'</section>'+
 '<section class="tile-grid">'+TILES.map(function(t){return '<button type="button" data-nav="'+t[0]+'" class="section-tile"><span class="tile-icon tone-'+t[2]+'">'+S(t[0],34)+'</span><span>'+E(t[1])+'</span></button>'}).join('')+'</section>'+
 '<section class="two-cols"><div class="panel"><div class="panel-heading"><div><h2>آخر العمليات</h2><p>المستندات المحفوظة من قاعدة البيانات</p></div><button data-nav="sales" class="text-link">عرض الكل</button></div>'+
 table(['الرقم','النوع','التاريخ','الإجمالي','الحالة'],recent,'لا توجد مستندات بعد')+
 '</div><div class="panel"><div class="panel-heading"><div><h2>المبيعات خلال آخر 6 أشهر</h2><p>مبيعات ومشتريات مرحّلة</p></div><div class="chart-key"><span><i></i>مبيعات</span><span><i class="blue"></i>مشتريات</span></div></div>'+chart+'</div></section>'+
 '<section class="panel"><div class="panel-heading"><div><h2>تنبيهات المخزون</h2><p>أصناف وصلت إلى الحد الأدنى أو دونه</p></div><button class="text-link" data-nav="inventory">المخزون</button></div><div class="alert-list">'+alerts+'</div></section>';
}
function documentList(kind){
 var info={sales:['فواتير المبيعات','بيع نقدي وآجل وترحيل محاسبي وتحديث المخزون','sale','purple'],purchases:['فواتير المشتريات','فواتير الموردين والتكلفة المتوسطة للمخزون','purchase','blue'],returns:['مرتجعات المبيعات','مرتجعات مربوطة بفواتير البيع الأصلية','return','red']};
 var x=info[kind];
 var rows=filteredRows().map(function(d){return '<tr><td class="cell-name"><button class="text-link num" data-doc="'+E(d.id)+'">'+E(d.number)+'</button></td><td class="num">'+E(d.date)+'</td><td>'+E(d.party_name)+'</td><td>'+E({cash:'نقداً',bank:'بنكي',credit:'آجل'}[d.payment]||d.payment)+'</td><td>'+M(d.total)+'</td><td>'+badge(d.status)+'</td><td><button class="btn small-btn" data-doc="'+E(d.id)+'">'+S('eye',14)+'عرض</button></td></tr>'});
 return mkHead(x[0],x[1],canWrite()?B('new-'+x[2],'إنشاء جديد','plus','primary'):'',kind,x[3])+
 '<div class="panel">'+searchBar()+table(['رقم المستند','التاريخ','العميل / المورد','السداد','الإجمالي','الحالة','إجراءات'],rows,'لم تُسجل فواتير من هذا النوع بعد')+'</div>';
}
function genericList(type){
 var titles={inventory:['المخزون والأصناف','الباركود، الوحدات، التكلفة، الرصيد والتنبيه','orange','product','صنف جديد'],customers:['العملاء','إدارة العملاء وبيانات التواصل','cyan','customer','عميل جديد'],suppliers:['الموردون','إدارة حسابات الموردين وبياناتهم','cyan','supplier','مورد جديد'],accounts:['شجرة الحسابات','دليل الحسابات وميزان الحسابات','red','account','حساب جديد'],branches:['الفروع','إدارة فروع المؤسسة','slate','branch','فرع جديد'],users:['المستخدمون والصلاحيات','أدوار محكومة بصلاحيات الخادم','slate','user','مستخدم جديد']};
 var t=titles[type];
 var allow= type==='users'||type==='branches'?isAdmin():type==='inventory'||type==='accounts'?canManage():canWrite();
 var rows=filteredRows().map(function(r){
  if(type==='inventory')return '<tr><td class="num">'+E(r.sku)+'</td><td class="cell-name">'+E(r.name)+'</td><td>'+E(r.category||'—')+'</td><td>'+E(r.unit)+'</td><td>'+M(r.price)+'</td><td>'+M(r.cost)+'</td><td class="num">'+F(r.stock,3)+'</td><td>'+(N(r.stock)<=N(r.min_stock)?'<span class="badge danger">منخفض</span>':'<span class="badge good">متوفر</span>')+'</td><td>'+(allow?'<button class="btn small-btn" data-edit="product" data-id="'+r.id+'">تعديل</button>':'')+'</td></tr>';
  if(type==='customers'||type==='suppliers')return '<tr><td class="num">'+E(r.id)+'</td><td class="cell-name">'+E(r.name)+'</td><td class="num">'+E(r.phone||'—')+'</td><td>'+E(r.address||'—')+'</td><td>'+(allow?'<button class="btn small-btn" data-edit="'+(type==='customers'?'customer':'supplier')+'" data-id="'+r.id+'">تعديل</button>':'')+'</td></tr>';
  if(type==='accounts')return '<tr><td class="num">'+E(r.code)+'</td><td class="cell-name">'+E(r.name)+'</td><td>'+E({asset:'أصول',liability:'خصوم',equity:'حقوق ملكية',revenue:'إيرادات',expense:'مصروفات'}[r.type]||r.type)+'</td><td>'+((+r.is_system)?'<span class="badge off">أساسي</span>':'<span class="badge good">مخصص</span>')+'</td><td>'+(allow&&!+r.is_system?'<button class="btn small-btn" data-edit="account" data-id="'+r.id+'">تعديل</button>':'')+'</td></tr>';
  if(type==='branches')return '<tr><td class="num">'+E(r.id)+'</td><td class="cell-name">'+E(r.name)+'</td><td>'+badge(r.active?'نشط':'متوقف')+'</td><td>'+(allow?'<button class="btn small-btn" data-edit="branch" data-id="'+r.id+'">تعديل</button>':'')+'</td></tr>';
  return '<tr><td class="num">'+E(r.id)+'</td><td class="cell-name">'+E(r.name)+'</td><td class="num">'+E(r.email)+'</td><td>'+E(r.role)+'</td><td>'+E(byId('branches',r.branch_id)?.name||'—')+'</td><td>'+(allow?'<button class="btn small-btn" data-edit="user" data-id="'+r.id+'">تعديل</button>':'')+'</td></tr>';
 });
 var columns={inventory:['الباركود / SKU','اسم الصنف','التصنيف','الوحدة','السعر','التكلفة','الرصيد','الحالة','إجراء'],customers:['الرقم','اسم العميل','الهاتف','العنوان','إجراء'],suppliers:['الرقم','اسم المورد','الهاتف','العنوان','إجراء'],accounts:['رمز الحساب','اسم الحساب','النوع','الحالة','إجراء'],branches:['الرقم','اسم الفرع','الحالة','إجراء'],users:['الرقم','الاسم','البريد','الدور','الفرع','إجراء']};
 return mkHead(t[0],t[1],allow?B('add-'+t[3],t[4],'plus','primary'):'',type,t[2])+'<section class="panel">'+searchBar()+table(columns[type],rows)+'</section>';
}
function journalPage(){
 var rows=filteredRows().map(function(j){return '<tr><td class="cell-name"><button class="text-link num" data-journal="'+j.id+'">'+E(j.number)+'</button></td><td class="num">'+E(j.date)+'</td><td>'+E(j.description)+'</td><td>'+E({manual:'يدوي',sale:'بيع',purchase:'شراء',return:'مرتجع',voucher:'سند',opening:'افتتاحي'}[j.source]||j.source)+'</td><td>'+M(j.debit)+'</td><td>'+M(j.credit)+'</td><td><span class="badge good">متوازن</span></td></tr>'});
 return mkHead('القيود اليومية','دفتر القيود المحاسبية مع منع ترحيل القيود غير المتوازنة',canManage()?B('new-journal','قيد جديد','plus','primary'):'','journal','violet')+
 '<div class="panel">'+searchBar()+table(['رقم القيد','التاريخ','البيان','المصدر','مدين','دائن','الحالة'],rows)+'</div>';
}
function vouchersPage(){
 var rows=filteredRows().map(function(v){return '<tr><td class="cell-name num">'+E(v.number)+'</td><td class="num">'+E(v.date)+'</td><td><span class="badge '+(v.kind==='receipt'?'good':'warn')+'">'+(v.kind==='receipt'?'قبض':'صرف')+'</span></td><td>'+E(v.party_name)+'</td><td>'+M(v.amount)+'</td><td>'+E(v.description)+'</td></tr>'});
 return mkHead('سندات القبض والصرف','سندات طرفية تنتج قيداً مزدوجاً عند الترحيل',canWrite()?B('new-voucher','سند جديد','plus','primary'):'','vouchers','gold')+
 '<div class="panel">'+searchBar()+table(['الرقم','التاريخ','النوع','الطرف','المبلغ','البيان'],rows)+'</div>';
}
function reportPage(cashbox){
 var name=cashbox?'الصندوق والبنوك':'التقارير والتحليلات';
 var tab=cashbox?'cashbox':NS.currentReport;
 var titles={trial:'ميزان المراجعة',pnl:'الأرباح والخسائر',stock:'تقييم المخزون',cashbox:'أرصدة النقدية',statement:'كشف حساب طرف',account_statement:'كشف حساب شامل'};
 var rows=[],cols=[];
 if(tab==='stock'){
  cols=['SKU','الصنف','الكمية','التكلفة','قيمة المخزون'];
  rows=(NS.report||[]).map(function(r){return '<tr><td class="num">'+E(r.sku)+'</td><td>'+E(r.name)+'</td><td class="num">'+F(r.stock,3)+'</td><td>'+M(r.cost)+'</td><td>'+M(r.value)+'</td></tr>'});
 }else if(tab==='account_statement'){
  cols=['رقم القيد','التاريخ','البيان','مدين','دائن','الرصيد (مدين + / دائن -)'];
  rows=(NS.report||[]).map(function(r){return '<tr><td class="num">'+E(r.number)+'</td><td class="num">'+E(r.date)+'</td><td>'+E(r.description)+'</td><td>'+M(r.debit)+'</td><td>'+M(r.credit)+'</td><td>'+M(r.balance)+'</td></tr>'});
 }else if(tab==='statement'){
  cols=['رقم القيد','التاريخ','البيان','الحساب','مدين','دائن'];
  rows=(NS.report||[]).map(function(r){return '<tr><td class="num">'+E(r.number)+'</td><td class="num">'+E(r.date)+'</td><td>'+E(r.description)+'</td><td>'+E(r.account_name)+'</td><td>'+M(r.debit)+'</td><td>'+M(r.credit)+'</td></tr>'});
 }else{
  cols=['الكود','اسم الحساب','النوع','مدين','دائن','صافي'];
  rows=(NS.report||[]).map(function(r){var delta=N(r.debit)-N(r.credit);return '<tr><td class="num">'+E(r.code)+'</td><td class="cell-name">'+E(r.name)+'</td><td>'+E({asset:'أصول',liability:'خصوم',equity:'حقوق ملكية',revenue:'إيرادات',expense:'مصروفات'}[r.type])+'</td><td>'+M(r.debit)+'</td><td>'+M(r.credit)+'</td><td>'+M(delta)+'</td></tr>'});
 }
 var totalDr=(NS.report||[]).reduce(function(s,r){return s+N(r.debit)},0),totalCr=(NS.report||[]).reduce(function(s,r){return s+N(r.credit)},0);
 var netProfit=(NS.report||[]).reduce(function(s,r){return s+(r.type==='revenue'?N(r.credit)-N(r.debit):-(N(r.debit)-N(r.credit)))},0);
 var selectReport=cashbox?'':'<select id="report-tab">'+[['trial','ميزان المراجعة'],['pnl','الأرباح والخسائر'],['stock','المخزون'],['statement','كشف حساب طرف'],['account_statement','كشف حساب شامل']].map(function(t){return '<option value="'+t[0]+'" '+(tab===t[0]?'selected':'')+'>'+t[1]+'</option>'}).join('')+'</select>';
 var selectParty=tab==='statement'?'<select id="report-party-type"><option value="customer" '+(NS.reportPartyType!=='supplier'?'selected':'')+'>عميل</option><option value="supplier" '+(NS.reportPartyType==='supplier'?'selected':'')+'>مورد</option></select><select id="report-party">'+opts(NS.data[NS.reportPartyType==='supplier'?'suppliers':'customers'],NS.reportPartyId)+'</select>':'';
 var selectAccount=tab==='account_statement'?'<select id="report-account" aria-label="الحساب">'+opts(NS.data.accounts,NS.reportAccountId||NS.data.accounts[0]?.id)+'</select>':'';
 var stats=tab==='trial'||tab==='cashbox'?'<div class="three-cols"><div class="stat-mini"><span>إجمالي المدين</span><strong>'+M(totalDr)+'</strong></div><div class="stat-mini"><span>إجمالي الدائن</span><strong>'+M(totalCr)+'</strong></div><div class="stat-mini"><span>الفرق</span><strong>'+M(totalDr-totalCr)+'</strong></div></div>':
 tab==='pnl'?'<div class="stat-mini"><span>صافي الربح / الخسارة</span><strong>'+M(netProfit)+'</strong></div>':'';
 return mkHead(name,cashbox?'أرصدة الصندوق والحسابات البنكية من القيود':'تقارير مالية حقيقية عن الفترة المحددة',B('print','طباعة / PDF','print','btn-subtle'),'reports','violet')+
 '<div class="panel"><div class="page-filter">'+selectReport+selectParty+selectAccount+
 '<div class="date-filter"><input type="date" id="filter-from" value="'+E(NS.from)+'"><input type="date" id="filter-to" value="'+E(NS.to)+'"></div>'+
 B('apply-filter','تحديث','search','btn-subtle')+B('export-csv','CSV','download','btn-subtle')+'</div>'+
 '<div class="panel-heading"><div><h2>'+titles[tab]+'</h2><p>الفترة '+(NS.from||'من البداية')+' إلى '+(NS.to||'اليوم')+' — '+periodBranchLabel()+'</p></div></div>'+stats+
 '<div style="margin-top:15px">'+table(cols,rows,'لا توجد حركات خلال الفترة')+'</div>'+
 (tab==='pnl'?'<p class="note">يعتمد التقرير على القيود المرحلة فقط؛ لا يشمل الاستحقاقات غير المسجلة.</p>':'')+'</div>';
}
function settingsPage(){
 var s=NS.data.settings;
 return mkHead('إعدادات النظام','بيانات الشركة والعملة والتفضيلات العامة',null,'settings','slate')+
 '<section class="panel"><h2>هوية المؤسسة</h2><form id="settings-form"><div class="form-grid two"><label>اسم الشركة<input name="company" required value="'+E(s.company||'')+'" '+(isAdmin()?'':'disabled')+'></label>'+
 '<label>رمز العملة<input name="currency" required maxlength="3" value="'+E(s.currency||'YER')+'" '+(isAdmin()?'':'disabled')+'></label></div>'+
 '<div class="actions" style="margin-top:16px">'+(isAdmin()?'<button class="primary" type="submit">حفظ التغييرات</button>':'<span class="note">التعديل لمدير النظام فقط.</span>')+'</div></form></section>'+
 '<section class="panel" style="margin-top:15px"><h2>إعدادات الواجهة</h2>'+B('theme','تغيير الوضع الفاتح / الداكن','moon','btn')+'<p class="note">التغيير يخص مظهر هذا الجهاز فقط.</p></section>';
}
function backupPage(){
 return mkHead('النسخ الاحتياطي والبيانات','تصدير بيانات منظمة وتحضير النسخ الاحتياطي',null,'backup','blue')+
 '<section class="panel"><h2>تصدير البيانات الحالية</h2><p>يمكن لمدير النظام تنزيل نسخة JSON منظمة من البيانات المحاسبية. لا تحتوي على كلمات مرور المستخدمين.</p>'+
 '<div class="info-card warn">هام: هذا الملف للتصدير والمراجعة، وليس بديلاً عن النسخ الاحتياطي الكامل لقاعدة بيانات MySQL. استعادة JSON من المتصفح غير مفعّلة لحماية دفتر الأستاذ من التكرار أو التلف. احتفظ بنسخ قاعدة البيانات اليومية عبر Hostinger.</div>'+
 '<div class="actions" style="margin-top:17px">'+(isAdmin()?'<a href="api.php?op=backup" class="primary">'+S('download')+' تنزيل تصدير JSON</a>':'<span class="note">يتطلب صلاحية مدير النظام.</span>')+'</div></section>';
}
function integrationPage(type){
 var wasl=type==='wasl';
 var title=wasl?'تكامل وخدمات WASL':'واتساب للأعمال';
 return mkHead(title,wasl?'خدمة خارجية تحتاج إعداد بيانات اعتماد رسمية':'إرسال المستندات باستخدام خدمة موثّقة بعد ربط مزود الخدمة',null,type,wasl?'blue':'mint')+
 '<section class="panel integration"><div class="head-title"><span class="head-icon tone-'+(wasl?'blue':'mint')+'">'+S(type,29)+'</span><div><h2>'+title+'</h2><span class="badge off">غير مفعّل</span></div></div><hr class="sep">'+
 '<div class="info-card warn"><strong>لا توجد جلسة تكامل فعلية مثبتة.</strong><p>واجهة هذه الخدمة متوفرة ضمن الأقسام التسعة عشر، لكنها لا ترسل مستندات أو معلومات مالية إلى طرف ثالث دون إعداد API رسمي وصلاحيات وموافقة على نقل البيانات.</p></div>'+
 '<p class="note">مكان التوسعة: توصيل API لدى المزود، حفظ أسراره خارج GitHub، سجلات إخفاق وتسليم، ومنع الإرسال المكرر.</p></section>';
}
function quarantinePage(){
 var rows=(NS.rows||[]).map(function(d){return '<tr><td class="num"><button class="text-link" data-doc="'+d.id+'">'+E(d.number)+'</button></td><td>'+E({sale:'بيع',purchase:'شراء',return:'مرتجع'}[d.kind])+'</td><td class="num">'+E(d.date)+'</td><td>'+E(d.party_name)+'</td><td>'+M(d.total)+'</td><td>'+badge(d.status)+'</td></tr>'});
 return mkHead('مراجعة المسودات','مستندات لم تُرحّل إلى دفتر الأستاذ بعد',null,'quarantine_review','orange')+
 '<section class="panel">'+table(['الرقم','النوع','التاريخ','الطرف','الإجمالي','الحالة'],rows,'لا توجد مسودات قيد المراجعة')+
 '<p class="note">الترحيل الفعلي متاح من شاشة المستند بحسب صلاحية المستخدم؛ لا يوجد اعتماد آلي للمسودات.</p></section>';
}
function invoiceNew(kind){
 var d=NS.editor||{};
 var title={sale:'فاتورة مبيعات',purchase:'فاتورة مشتريات',return:'مرتجع مبيعات'}[kind];
 var customer=kind!=='purchase';
 var partyName=customer?'العميل':'المورد',partyList=customer?'customers':'suppliers';
 var original=kind==='return'?'<label>الفاتورة الأصلية<select data-ed="reference_id" id="return-ref"><option value="">اختر فاتورة مبيعات</option>'+opts(NS.returnSources||[],d.reference_id,'number')+'</select></label>':'';
 var lines=(d.lines||[]).map(function(l,i){
   var p=byId('products',l.product_id);
   return '<tr><td class="num">'+(i+1)+'</td><td><select data-line="'+i+'" data-col="product_id"><option value="">اختر الصنف</option>'+opts(NS.data.products,l.product_id)+'</select></td><td>'+E(p?.unit||'—')+'</td>'+
   '<td><input type="number" min="0.001" step="0.001" data-line="'+i+'" data-col="qty" value="'+E(l.qty)+'"></td>'+
   '<td><input type="number" min="0" step="0.01" data-line="'+i+'" data-col="price" value="'+E(l.price)+'" '+(kind==='return'?'readonly':'')+'></td>'+
   '<td class="num">'+F(N(l.qty)*N(l.price))+'</td><td><button type="button" class="btn small-btn btn-danger" data-del-line="'+i+'">حذف</button></td></tr>';
 }).join('');
 var tot=estimate(d);
 var write=canWrite();
 return mkHead(title,'احفظ كمسودة، ثم رحّل بعد المراجعة — قرار الترحيل النهائي على الخادم',
 B('back-list','رجوع',null,'btn-subtle')+(write?B('save-invoice','حفظ المسودة','save','btn')+B('post-invoice','حفظ وترحيل','check','primary'):'')+B('print','معاينة الطباعة','print','btn-subtle'),'sales',kind==='purchase'?'blue':'purple')+
 '<section class="panel"><div class="panel-heading"><div><h2>بيانات المستند</h2><p>الرقم: <span class="num">'+E(d.number||'يُحدد من الخادم عند أول حفظ')+'</span>'+(d.status==='draft'?' — مسودة':'')+'</p></div><span class="badge warn">قبل الترحيل</span></div>'+
 '<div class="form-grid four"><label>'+partyName+'<select data-ed="'+(customer?'customer_id':'supplier_id')+'" required>'+opts(NS.data[partyList],customer?d.customer_id:d.supplier_id)+'</select></label>'+
 '<label>تاريخ المستند<input type="date" data-ed="date" value="'+E(d.date)+'"></label>'+
 '<label>الفرع<select data-ed="branch_id">'+opts(NS.data.branches,d.branch_id)+'</select></label>'+
 '<label>طريقة السداد<select data-ed="payment"><option value="cash" '+(d.payment==='cash'?'selected':'')+'>نقداً</option><option value="bank" '+(d.payment==='bank'?'selected':'')+'>بنكي</option><option value="credit" '+(d.payment==='credit'?'selected':'')+'>آجل</option></select></label>'+
 original+'</div><div class="editor-lines"><div class="panel-heading"><div><h2>الأصناف والكميات</h2><p>يمكن البحث بالباركود أو اختيار صنف</p></div>'+
 B('add-invoice-line','إضافة سطر','plus','btn-subtle')+'</div>'+
 '<div class="page-filter"><input type="search" id="scan-barcode" placeholder="امسح الباركود واضغط Enter" style="width:270px;max-width:100%">'+
 '<span class="field-help">F4 للباركود • F2 لإضافة سطر • Ctrl+S للحفظ</span></div>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th>حذف</th></tr></thead><tbody>'+lines+'</tbody></table></div></div>'+
 '<div class="form-grid four" style="margin-top:16px"><label>الخصم<input type="number" min="0" step="0.01" data-ed="discount" value="'+E(d.discount||0)+'" '+(kind==='return'?'readonly':'')+'></label>'+
 '<label>نوع الخصم<select data-ed="discount_type" '+(kind==='return'?'disabled':'')+'><option value="amount" '+(d.discount_type==='amount'?'selected':'')+'>مبلغ</option><option value="percent" '+(d.discount_type==='percent'?'selected':'')+'>نسبة %</option></select></label>'+
 '<label>الضريبة %<input type="number" min="0" max="100" step="0.001" data-ed="tax_rate" value="'+E(d.tax_rate||0)+'" '+(kind==='return'?'readonly':'')+'></label>'+
 '<label>المدفوع (فارغ = تلقائي)<input type="number" min="0" step=".01" data-ed="paid" placeholder="تلقائي" value="'+E(d.paid??'')+'" '+(kind==='return'?'readonly':'')+'></label></div>'+
 '<div class="editor-totals"><div class="total-box"><span>الإجمالي قبل الخصم</span><strong>'+M(tot.subtotal)+'</strong></div><div class="total-box"><span>الخصم</span><strong>'+M(tot.discount)+'</strong></div><div class="total-box"><span>الضريبة</span><strong>'+M(tot.tax)+'</strong></div><div class="total-box emphasis"><span>صافي الفاتورة</span><strong>'+M(tot.total)+'</strong></div><div class="total-box"><span>المتبقي</span><strong>'+M(tot.remaining)+'</strong></div></div>'+
 '<label style="margin-top:15px">ملاحظات<textarea data-ed="note" placeholder="ملاحظات الفاتورة">'+E(d.note||'')+'</textarea></label>'+
 '<p class="note">الأرقام هنا معاينة قبل الحفظ؛ الخادم يعيد الحساب ويتحقق من المخزون والأرصدة قبل الترحيل.</p></section>';
}
function estimate(d){
 var subtotal=(d.lines||[]).reduce(function(s,l){return s+N(l.qty)*N(l.price)},0);
 var discount=d.discount_type==='percent'?subtotal*N(d.discount)/100:N(d.discount);
 discount=Math.max(0,Math.min(discount,subtotal));
 var tax=(subtotal-discount)*N(d.tax_rate)/100,total=subtotal-discount+tax;
 var paid=d.paid===null||d.paid===''||d.paid===undefined?(d.payment==='credit'?0:total):N(d.paid);
 return {subtotal:subtotal,discount:discount,tax:tax,total:total,remaining:total-paid};
}
function journalEditor(){
 var j=NS.journal||{date:NS.data.today,lines:[]};
 var debit=(j.lines||[]).reduce(function(x,l){return x+N(l.debit)},0);
 var credit=(j.lines||[]).reduce(function(x,l){return x+N(l.credit)},0);
 var rows=(j.lines||[]).map(function(l,i){return '<tr><td>'+optsJournal(i,l.account_id)+'</td><td><input type="number" min="0" step=".01" data-jline="'+i+'" data-col="debit" value="'+E(l.debit)+'"></td><td><input type="number" min="0" step=".01" data-jline="'+i+'" data-col="credit" value="'+E(l.credit)+'"></td><td><button class="btn small-btn btn-danger" data-del-jline="'+i+'">حذف</button></td></tr>'}).join('');
 return mkHead('قيد يومية جديد','الطرف المدين يجب أن يساوي الطرف الدائن',B('back-journal','رجوع',null,'btn-subtle')+B('post-journal','ترحيل القيد','check','primary'),'journal','violet')+
 '<section class="panel"><div class="form-grid two"><label>التاريخ<input type="date" data-journal="date" value="'+E(j.date)+'"></label><label>الفرع<select data-journal="branch_id">'+opts(NS.data.branches,j.branch_id)+'</select></label>'+
 '<label class="full">بيان القيد<input data-journal="description" value="'+E(j.description||'')+'" placeholder="سبب القيد المحاسبي"></label></div><div class="panel-heading" style="margin-top:20px"><h2>بنود القيد</h2>'+B('add-jline','سطر جديد','plus','btn-subtle')+'</div>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>إجراء</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<div class="editor-totals"><div class="total-box"><span>إجمالي المدين</span><strong>'+M(debit)+'</strong></div><div class="total-box"><span>إجمالي الدائن</span><strong>'+M(credit)+'</strong></div><div class="total-box '+(Math.abs(debit-credit)<.001&&debit>0?'emphasis':'')+'"><span>الفرق</span><strong>'+M(Math.abs(debit-credit))+'</strong></div></div>'+
 '<p class="'+(debit>0&&Math.abs(debit-credit)<.001?'success-line':'warning-line')+'" style="margin-top:15px">'+(debit>0&&Math.abs(debit-credit)<.001?'القيد متوازن':'يجب تساوي المدين والدائن قبل الترحيل')+'</p></section>';
}
function optsJournal(i,id){
 return '<select data-jline="'+i+'" data-col="account_id">'+opts(NS.data.accounts,id,'name')+'</select>';
}
function voucherEditor(){
 var v=NS.voucher||{};
 var isReceipt=v.kind==='receipt';
 return mkHead('سند '+(isReceipt?'قبض':'صرف'),'يتم إنشاء القيد في نفس عملية قاعدة البيانات',B('back-vouchers','رجوع',null,'btn-subtle')+B('post-voucher','حفظ وترحيل','check','primary'),'vouchers','gold')+
 '<section class="panel"><div class="form-grid two"><label>نوع السند<select data-voucher="kind"><option value="receipt" '+(isReceipt?'selected':'')+'>قبض من عميل</option><option value="payment" '+(!isReceipt?'selected':'')+'>صرف لمورد</option></select></label>'+
 '<label>تاريخ السند<input type="date" data-voucher="date" value="'+E(v.date)+'"></label>'+
 '<label>الطرف<select data-voucher="party_id">'+opts(NS.data[isReceipt?'customers':'suppliers'],v.party_id)+'</select></label>'+
 '<label>حساب النقدية<select data-voucher="account_id">'+opts(NS.data.accounts.filter(function(a){return ['101','102'].includes(a.code)}),v.account_id,'name')+'</select></label>'+
 '<label>المبلغ<input type="number" min="0.01" step=".01" data-voucher="amount" value="'+E(v.amount||'')+'"></label>'+
 '<label class="full">البيان<textarea data-voucher="description">'+E(v.description||'')+'</textarea></label></div>'+
 '<div class="info-card" style="margin-top:15px">لا يُقبل سند بأكثر من الذمم المستحقة للطرف في الفرع. لا تُدعم السلف المقدمة في هذه النسخة.</div></section>';
}
function docView(){
 var d=NS.document;
 if(!d)return '<div class="panel">المستند غير متاح</div>';
 if(d.lines&&d.source!==undefined) return journalView();
 var type={sale:'فاتورة مبيعات',purchase:'فاتورة شراء',return:'مرتجع'}[d.kind];
 var party=byId(d.kind==='purchase'?'suppliers':'customers',d.kind==='purchase'?d.supplier_id:d.customer_id);
 var trs=(d.lines||[]).map(function(l,i){return '<tr><td>'+(i+1)+'</td><td>'+E(l.product_name)+'</td><td>'+E(l.unit)+'</td><td class="num">'+F(l.qty,3)+'</td><td class="num">'+F(l.price)+'</td><td class="num">'+F(N(l.qty)*N(l.price))+'</td></tr>'}).join('');
 var tableHtml='<table><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>'+trs+'</tbody></table>';
 var header='<header><div><strong>NineSoft - '+E(NS.data.settings.company)+'</strong><h2>'+type+'</h2><p>'+E(party?.name||'—')+'</p></div><div><strong class="num">'+E(d.number)+'</strong><p class="num">'+E(d.date)+'</p>'+badge(d.status)+'</div></header>';
 return mkHead(type+' '+d.number,'معاينة المستند والحركات المسجلة',B('print','طباعة / حفظ PDF','print','btn-subtle')+B('back-list','رجوع',null,'btn-subtle')+(d.status==='draft'&&canWrite()?B('edit-doc','تحرير المسودة','save','primary')+B('post-doc','ترحيل','check','btn'):'') ,'sales','purple')+
 '<section class="panel"><div class="print-document">'+header+tableHtml+'<p>الصافي: '+M(d.total)+' | المدفوع: '+M(d.paid)+'</p></div>'+
 '<div class="no-print">'+header+'<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>'+trs+'</tbody></table></div>'+
 '<div class="editor-totals"><div class="total-box"><span>قبل الخصم</span><strong>'+M(d.subtotal)+'</strong></div><div class="total-box"><span>بعد الخصم</span><strong>'+M(d.net)+'</strong></div><div class="total-box"><span>الضريبة</span><strong>'+M(d.tax)+'</strong></div><div class="total-box emphasis"><span>الإجمالي</span><strong>'+M(d.total)+'</strong></div><div class="total-box"><span>المدفوع</span><strong>'+M(d.paid)+'</strong></div></div><p>'+E(d.note||'')+'</p></div></section>';
}
function journalView(){
 var j=NS.document;
 return mkHead('القيد '+j.number,j.description,B('print','طباعة','print','btn-subtle')+B('back-journal','رجوع',null,'btn-subtle'),'journal','violet')+
 '<section class="panel"><div class="print-document"><h2>قيد يومية '+E(j.number)+'</h2><p>'+E(j.date)+' - '+E(j.description)+'</p></div>'+
 table(['الحساب','المدين','الدائن'],(j.lines||[]).map(function(l){return '<tr><td>'+E(l.code)+' - '+E(l.account_name)+'</td><td>'+M(l.debit)+'</td><td>'+M(l.credit)+'</td></tr>'}))+'</section>';
}
function renderPage(){
 if(NS.page==='dashboard')return dashboardPage();
 if(['sales','purchases','returns'].includes(NS.page))return documentList(NS.page);
 if(['inventory','customers','suppliers','accounts','branches','users'].includes(NS.page))return genericList(NS.page);
 if(NS.page==='journal')return journalPage();
 if(NS.page==='vouchers')return vouchersPage();
 if(NS.page==='cashbox'||NS.page==='reports')return reportPage(NS.page==='cashbox');
 if(NS.page==='settings')return settingsPage();
 if(NS.page==='backup')return backupPage();
 if(NS.page==='wasl'||NS.page==='whatsapp')return integrationPage(NS.page);
 if(NS.page==='quarantine_review')return quarantinePage();
 if(NS.page==='invoice-editor')return invoiceNew(NS.editor?.kind||'sale');
 if(NS.page==='journal-editor')return journalEditor();
 if(NS.page==='voucher-editor')return voucherEditor();
 if(NS.page==='doc-view'||NS.page==='journal-view')return docView();
 return mkHead('الصفحة غير موجودة','',null,'dashboard','slate');
}
function textInput(name,title,value,type,other){
 return '<label>'+E(title)+'<input name="'+E(name)+'" '+(type?'type="'+type+'"':'')+' value="'+E(value||'')+'" '+(other||'')+'></label>';
}
function selInput(name,title,value,choices){
 return '<label>'+E(title)+'<select name="'+E(name)+'">'+choices.map(function(x){return '<option value="'+E(x[0])+'" '+(String(x[0])===String(value)?'selected':'')+'>'+E(x[1])+'</option>'}).join('')+'</select></label>';
}
var HELP={
 dashboard:'لوحة القيادة تلخص حركة الفواتير المرحلة ومؤشرات المخزون. افتح أي قسم من البطاقات.',
 sales:'أنشئ فاتورة بيع، أضف الأصناف، اختر طريقة السداد ثم احفظ وترحّل. البيع الآجل يتطلب عميلاً غير نقدي.',
 purchases:'تُرحّل المشتريات كأصل مخزون ويتم تحديث متوسط التكلفة وتسجيل الالتزامات على المورد.',
 returns:'حدد فاتورة بيع أصلية، ثم الأصناف والكميات المراد إرجاعها. تُراجع الكميات السابقة عند الترحيل.',
 inventory:'أدخل صنفاً وسعره وحده الأدنى. الكمية الافتتاحية تسجل قيداً؛ لا تُعدّل أرصدة المخزون مباشرة بعد ذلك.',
 customers:'سجّل العملاء بأسمائهم وأرقام التواصل. كشف الحساب من التقارير.',
 suppliers:'سجّل الموردين؛ يدعم السند صرفاً جزئياً لتسوية الذمم.',
 accounts:'شجرة الحسابات تحتوي حسابات نظام ثابتة وحسابات فرعية مخصصة للقيود.',
 journal:'كل قيد يحتاج مديناً ودائناً متساويين. التحقق النهائي على الخادم.',
 vouchers:'يولد سند القبض أو الصرف قيداً مزدوجاً بعد التحقق من رصيد الطرف.',
 cashbox:'الحسابات النقدية معروضة من دفتر القيود؛ لا تعدّل الرصيد من هذه الشاشة.',
 reports:'اختر التقرير والفترة لعرض الميزان والأرباح والمخزون وكشوف الأطراف. CSV أو الطباعة.',
 wasl:'لم تُوصل الخدمة بمزود رسمي بعد؛ لا توجد عمليات تبادل بيانات.',
 whatsapp:'لم تُضبط جلسة واتساب موثّقة؛ لا يوجد إرسال فعلي من هذه الشاشة.',
 backup:'نزّل تصديراً منظماً JSON، وخذ نسخ MySQL كاملة من الاستضافة. الاستعادة من واجهة ويب غير مفعلة.',
 users:'مدير النظام فقط ينشئ المستخدمين. الصلاحيات مطبقة في API وليس في عرض الأزرار فحسب.',
 branches:'إدارة أسماء الفروع. مستخدم الصندوق يقتصر على فرعه.',
 quarantine_review:'تعرض هذه الصفحة مسودات لم ترحل بعد. لا يوجد ترحيل آلي.',
 settings:'مدير النظام يعدل اسم الشركة والعملة. الثيم خيار محلي للعرض.'
};
function modalMarkup(){
 var m=NS.modal;
 if(!m)return '';
 var d=m.data||{},form='',title='';
 if(m.kind==='help'){title='مساعدة: '+(TITLES[NS.page]||'القسم');form='<p>'+E(HELP[NS.page]||'راجع دليل الاستخدام.')+'</p>';}
 if(m.kind==='customer'||m.kind==='supplier'){title=(d.id?'تعديل ':'إضافة ')+(m.kind==='customer'?'عميل':'مورد');form='<form id="modal-form"><div class="form-grid two">'+textInput('name','الاسم',d.name,'text','required')+textInput('phone','الهاتف',d.phone,'tel')+textInput('address','العنوان',d.address)+'</div><div class="actions"><button type="submit" class="primary">حفظ</button></div></form>';}
 if(m.kind==='product'){title=d.id?'تعديل صنف':'إضافة صنف';form='<form id="modal-form"><div class="form-grid two">'+textInput('name','اسم الصنف',d.name,'text','required')+textInput('sku','الباركود / SKU',d.sku,'text','required')+textInput('category','التصنيف',d.category)+textInput('unit','الوحدة',d.unit||'حبة')+textInput('price','سعر البيع',d.price,'number','step=".01" min="0"')+
 (!d.id?textInput('cost','تكلفة الافتتاح',d.cost,'number','step=".01" min="0"')+textInput('opening_qty','كمية افتتاحية',0,'number','step=".001" min="0"'):'')+
 textInput('min_stock','الحد الأدنى للمخزون',d.min_stock||0,'number','step=".001" min="0"')+
 '<label>تتبع المخزون<select name="track_stock"><option value="1" '+(+d.track_stock!==0?'selected':'')+'>نعم</option><option value="0" '+(+d.track_stock===0?'selected':'')+'>لا</option></select></label></div><div class="actions"><button type="submit" class="primary">حفظ</button></div></form>';}
 if(m.kind==='branch'){title=d.id?'تعديل الفرع':'إضافة فرع';form='<form id="modal-form">'+textInput('name','اسم الفرع',d.name,'text','required')+'<div class="actions"><button type="submit" class="primary">حفظ</button></div></form>';}
 if(m.kind==='account'){title=d.id?'تعديل حساب':'إضافة حساب';form='<form id="modal-form"><div class="form-grid two">'+textInput('code','الكود المحاسبي',d.code,'text','required')+textInput('name','اسم الحساب',d.name,'text','required')+
 selInput('type','التصنيف',d.type||'expense',[['asset','أصل'],['liability','خصم'],['equity','حقوق ملكية'],['revenue','إيراد'],['expense','مصروف']])+'</div><div class="actions"><button type="submit" class="primary">حفظ</button></div></form>';}
 if(m.kind==='user'){title=d.id?'تعديل مستخدم':'إضافة مستخدم';form='<form id="modal-form"><div class="form-grid two">'+textInput('name','الاسم',d.name,'text','required')+textInput('email','البريد الإلكتروني',d.email,'email','required')+
 selInput('role','الدور',d.role||'cashier',[['admin','مدير'],['accountant','محاسب'],['cashier','كاشير'],['viewer','عرض فقط']])+
 '<label>الفرع<select name="branch_id">'+opts(NS.data.branches,d.branch_id||NS.data.branches[0]?.id)+'</select></label>'+
 textInput('password',d.id?'كلمة مرور جديدة (اختياري)':'كلمة المرور (12 حرفاً على الأقل)','', 'password',d.id?'':'required minlength="12"')+
 '</div><div class="actions"><button type="submit" class="primary">حفظ</button></div></form>';}
 return '<div class="overlay" id="modal-overlay" data-action="dismiss-modal"><section class="dialog" role="dialog" aria-modal="true"><div class="dialog-head"><h2>'+E(title)+'</h2><button type="button" data-action="dismiss-modal" class="icon-btn">'+S('close')+'</button></div>'+form+'</section></div>';
}
