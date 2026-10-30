'use strict';
/* Offline UI preview only. Never connects to PHP, MySQL, or a live company. */
(function(){
 var KEY='ninesoft-demo-local-v1';
 var now=new Date();
 var today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
 function cp(x){return JSON.parse(JSON.stringify(x));}
 function round(x){return Math.round(Number(x)*100)/100;}
 function seed(){return {
  csrf:'demo',today:today,user:{id:1,name:'مدير التجربة',role:'admin',branch_id:1},
  settings:{company:'شركة تجريبية - NineSoft',currency:'YER'},
  branches:[{id:1,name:'الفرع الرئيسي',active:1},{id:2,name:'فرع تجريبي آخر',active:1}],
  customers:[{id:1,name:'عميل نقدي',phone:'',address:''},{id:2,name:'مؤسسة الأمل',phone:'777123456',address:'صنعاء'}],
  suppliers:[{id:1,name:'مورد نقدي',phone:'',address:''},{id:2,name:'شركة التوريدات',phone:'777654321',address:'صنعاء'}],
  products:[{id:1,name:'أرز بسمتي 5 كجم',sku:'100001',category:'غذائية',unit:'كيس',price:8500,cost:7000,stock:35,min_stock:8,track_stock:1},
    {id:2,name:'قهوة عربية 250 جرام',sku:'100002',category:'مشروبات',unit:'علبة',price:4500,cost:3000,stock:7,min_stock:10,track_stock:1},
    {id:3,name:'زيت نباتي 1 لتر',sku:'100003',category:'غذائية',unit:'عبوة',price:3500,cost:2900,stock:20,min_stock:5,track_stock:1}],
  accounts:[{id:1,code:'101',name:'الصندوق',type:'asset',is_system:1},{id:2,code:'102',name:'البنك',type:'asset',is_system:1},
    {id:3,code:'110',name:'العملاء',type:'asset',is_system:1},{id:4,code:'120',name:'المخزون',type:'asset',is_system:1},
    {id:5,code:'201',name:'الموردون',type:'liability',is_system:1},{id:6,code:'301',name:'رأس المال',type:'equity',is_system:1},
    {id:7,code:'401',name:'المبيعات',type:'revenue',is_system:1},{id:8,code:'501',name:'تكلفة البضاعة',type:'expense',is_system:1},
    {id:9,code:'601',name:'المصروفات الإدارية',type:'expense',is_system:0}],
  users:[{id:1,name:'مدير التجربة',email:'preview@ninesoft.local',role:'admin',branch_id:1}],
  docs:[
    {id:1,kind:'sale',number:'SAL-DEMO-001',date:today,customer_id:2,supplier_id:0,party_name:'مؤسسة الأمل',branch_id:1,
      payment:'cash',status:'posted',subtotal:21500,net:21500,total:21500,tax:0,paid:21500,discount:0,discount_type:'amount',tax_rate:0,revision:1,note:'فاتورة تجريبية',
      lines:[{product_id:1,qty:2,price:8500},{product_id:2,qty:1,price:4500}]},
    {id:2,kind:'purchase',number:'PUR-DEMO-002',date:today,customer_id:0,supplier_id:2,party_name:'شركة التوريدات',branch_id:1,
      payment:'cash',status:'posted',subtotal:35000,net:35000,total:35000,tax:0,paid:35000,discount:0,discount_type:'amount',tax_rate:0,revision:1,note:'فاتورة تجريبية',
      lines:[{product_id:1,qty:5,price:7000}]}
  ],
  journals:[
    {id:1,number:'JRN-DEMO-001',date:today,description:'بيع تجريبي',source:'sale',party_type:'customer',party_id:2,debit:21500,credit:21500,
      lines:[{account_id:1,debit:21500,credit:0},{account_id:7,debit:0,credit:21500}]},
    {id:2,number:'JRN-DEMO-002',date:today,description:'شراء تجريبي',source:'purchase',party_type:'supplier',party_id:2,debit:35000,credit:35000,
      lines:[{account_id:4,debit:35000,credit:0},{account_id:1,debit:0,credit:35000}]}
  ],vouchers:[]
 };}
 var db;
 try{db=JSON.parse(localStorage.getItem(KEY));if(!db||!db.products||!db.docs)db=seed();}
 catch(e){db=seed();}
 function persist(){localStorage.setItem(KEY,JSON.stringify(db));if(NS.data)NS.data=cp(db);}
 function next(arr){return 1+arr.reduce(function(n,r){return Math.max(n,+r.id||0);},0);}
 function find(arr,id){return arr.find(function(x){return +x.id===+id;});}
 function product(id){return find(db.products,id);}
 function account(id){return find(db.accounts,id);}
 function doclist(type){var kind={sales:'sale',purchases:'purchase',returns:'return'}[type];return db.docs.filter(function(x){return x.kind===kind;});}
 function ledger(){
  var rows=[];
  db.journals.forEach(function(j){(j.lines||[]).forEach(function(l){
   var a=account(l.account_id);if(a)rows.push({code:a.code,name:a.name,type:a.type,debit:Number(l.debit)||0,credit:Number(l.credit)||0,
    number:j.number,date:j.date,description:j.description,account_name:a.name,party_type:j.party_type,party_id:j.party_id});
  });});return rows;
 }
 function reports(q){
  if(q.type==='stock')return db.products.map(function(p){return {sku:p.sku,name:p.name,stock:p.stock,cost:p.cost,value:round(p.stock*p.cost)};});
  if(q.type==='statement')return ledger().filter(function(r){return r.party_type===(q.party_type||'customer')&&+r.party_id===+q.party_id;});
  var totals={};
  ledger().forEach(function(x){
   if(!totals[x.code])totals[x.code]={code:x.code,name:x.name,type:x.type,debit:0,credit:0};
   totals[x.code].debit+=x.debit;totals[x.code].credit+=x.credit;
  });
  return Object.values(totals).filter(function(x){
   return q.type==='pnl'?x.type==='revenue'||x.type==='expense':q.type==='cashbox'?x.code==='101'||x.code==='102':true;
  });
 }
 function journal(lines,description,source,partyType,partyId){
  var id=next(db.journals);
  var amount=round(lines.reduce(function(n,l){return n+Number(l.debit||0);},0));
  db.journals.push({id:id,number:'JRN-DEMO-'+String(id).padStart(3,'0'),date:today,
   description:description,source:source,party_type:partyType||'',party_id:partyId||0,
   lines:cp(lines),debit:amount,credit:amount});
 }
 function entity(rows,d,fields){
  if(!String(d.name||'').trim())throw Error('أدخل الاسم أولاً');
  var obj=find(rows,d.id),id=obj?obj.id:next(rows),v=Object.assign({id:id},obj||{});
  fields.forEach(function(k){if(d[k]!==undefined)v[k]=d[k];});
  if(obj)Object.assign(obj,v);else rows.push(v);
  persist();return {id:id};
 }
 api=async function(op,data,query){
  var d=data||{},q=query||{};
  if(op==='bootstrap')return cp(db);
  if(op==='dashboard'){
   var docs=db.docs.filter(function(x){return x.status==='posted';}),totals={sale:0,purchase:0,return:0};
   docs.forEach(function(x){totals[x.kind]+=Number(x.total)||0;});
   return {totals:totals,stock:{value:round(db.products.reduce(function(n,p){return n+p.stock*p.cost;},0)),total_items:db.products.length},
    customers:db.customers.length,low:cp(db.products.filter(function(p){return +p.stock<=+p.min_stock;})),
    recent:cp(db.docs.slice().reverse().slice(0,5)),
    monthly:docs.map(function(x){return {ym:x.date.slice(0,7),kind:x.kind,total:x.total};})};
  }
  if(op==='list'){
   var map={inventory:'products',customers:'customers',suppliers:'suppliers',accounts:'accounts',
    branches:'branches',users:'users',journal:'journals',vouchers:'vouchers'};
   if(['sales','purchases','returns'].includes(q.type))return cp(doclist(q.type));
   if(map[q.type])return cp(db[map[q.type]]);
   throw Error('قسم غير متاح');
  }
  if(op==='doc'){
   var a=find(db.docs,q.id);if(!a)throw Error('الفاتورة غير موجودة');
   return Object.assign(cp(a),{lines:a.lines.map(function(l){
    var p=product(l.product_id)||{};
    return Object.assign({},l,{product_name:p.name||'صنف',unit:p.unit||'حبة'});
   })});
  }
  if(op==='journal_doc'){
   var j=find(db.journals,q.id);if(!j)throw Error('القيد غير موجود');
   return Object.assign(cp(j),{lines:j.lines.map(function(l){var a=account(l.account_id)||{};return Object.assign({},l,{code:a.code,account_name:a.name});})});
  }
  if(op==='report')return cp(reports(q));
  if(op==='save_invoice'){
   if(!d.lines||!d.lines.length)throw Error('أضف صنفاً واحداً على الأقل');
   d.lines.forEach(function(l){if(!product(l.product_id)||!(Number(l.qty)>0)||!(Number(l.price)>=0))throw Error('صنف أو كمية غير صحيحة');});
   var subtotal=round(d.lines.reduce(function(n,l){return n+l.qty*l.price;},0));
   var discount=d.discount_type==='percent'?round(subtotal*(Number(d.discount)||0)/100):Number(d.discount)||0;
   if(discount<0||discount>subtotal)throw Error('الخصم غير صحيح');
   var net=round(subtotal-discount),tax=round(net*(Number(d.tax_rate)||0)/100),total=round(net+tax);
   var old=find(db.docs,d.id);if(old&&old.status==='posted')throw Error('فاتورة مرحلة لا يمكن تعديلها');
   var id=old?old.id:next(db.docs),number=old?old.number:({sale:'SAL',purchase:'PUR',return:'RET'}[d.kind]||'DOC')+'-DEMO-'+String(id).padStart(3,'0');
   var party=find(d.kind==='purchase'?db.suppliers:db.customers,d.kind==='purchase'?d.supplier_id:d.customer_id);
   var row=Object.assign({},cp(d),{id:id,number:number,status:'draft',subtotal:subtotal,net:net,tax:tax,total:total,
    party_name:party?.name||'طرف تجريبي',paid:d.paid===''||d.paid===undefined?(d.payment==='credit'?0:total):Number(d.paid),revision:(old?.revision||0)+1});
   if(old)Object.assign(old,row);else db.docs.push(row);
   persist();return {id:id,number:number,revision:row.revision};
  }
  if(op==='post_invoice'){
   var inv=find(db.docs,d.id);if(!inv)throw Error('المستند غير موجود');
   if(inv.status==='posted')throw Error('مرحّل مسبقاً');
   if(inv.kind==='return'&&!inv.reference_id)throw Error('اختر الفاتورة الأصلية أولاً');
   var sign=inv.kind==='sale'?-1:1;
   inv.lines.forEach(function(l){var p=product(l.product_id);if(!p||sign<0&&p.stock<Number(l.qty))throw Error('المخزون غير كافٍ');});
   inv.lines.forEach(function(l){product(l.product_id).stock=round(product(l.product_id).stock+sign*l.qty);});
   inv.status='posted';
   var debit=inv.kind==='purchase'?4:inv.kind==='return'?7:1,credit=inv.kind==='purchase'?1:inv.kind==='return'?1:7;
   journal([{account_id:debit,debit:inv.total,credit:0},{account_id:credit,debit:0,credit:inv.total}],inv.number,'demo',
    inv.kind==='purchase'?'supplier':'customer',inv.kind==='purchase'?inv.supplier_id:inv.customer_id);
   persist();return {number:inv.number};
  }
  if(op==='post_journal'){
   var dr=(d.lines||[]).reduce(function(n,l){return n+Number(l.debit||0);},0);
   var cr=(d.lines||[]).reduce(function(n,l){return n+Number(l.credit||0);},0);
   if(!(dr>0)||Math.abs(dr-cr)>0.001)throw Error('القيد غير متوازن');
   d.lines.forEach(function(l){if(!account(l.account_id)||Number(l.debit)<0||Number(l.credit)<0)throw Error('سطر غير صحيح');});
   journal(d.lines,d.description||'قيد تجريبي','manual','','');
   persist();return {number:db.journals[db.journals.length-1].number};
  }
  if(op==='post_voucher'){
   if(!(Number(d.amount)>0))throw Error('مبلغ السند غير صحيح');
   var parties=d.kind==='receipt'?db.customers:db.suppliers,party=find(parties,d.party_id);
   if(!party||!account(d.account_id))throw Error('اختر الطرف والحساب');
   var id=next(db.vouchers),number='VCH-DEMO-'+String(id).padStart(3,'0');
   db.vouchers.push({id:id,number:number,date:d.date||today,kind:d.kind,party_name:party.name,amount:round(d.amount),description:d.description||''});
   journal([{account_id:d.kind==='receipt'?d.account_id:5,debit:Number(d.amount),credit:0},
     {account_id:d.kind==='receipt'?3:d.account_id,debit:0,credit:Number(d.amount)}],number,'voucher',d.kind==='receipt'?'customer':'supplier',d.party_id);
   persist();return {number:number};
  }
  if(op==='save_party')return entity(db[d.kind==='suppliers'?'suppliers':'customers'],d,['name','phone','address']);
  if(op==='save_product'){
   var result=entity(db.products,d,['name','sku','unit','category','price','cost','track_stock','min_stock']);
   var p=find(db.products,result.id);
   if(p.stock===undefined)p.stock=Number(d.opening_qty)||0;
   p.price=Number(p.price)||0;p.cost=Number(p.cost)||0;
   persist();return result;
  }
  if(op==='save_account')return entity(db.accounts,d,['name','code','type']);
  if(op==='save_branch')return entity(db.branches,d,['name']);
  if(op==='save_user')return entity(db.users,d,['name','email','role','branch_id']);
  if(op==='save_settings'){db.settings.company=d.company;db.settings.currency=d.currency;persist();return {ok:true};}
  if(op==='logout')return {ok:true};
  throw Error('تحتاج هذه الوظيفة إلى الخادم الحقيقي');
 };

 var originalShell=shell;
 shell=function(content){
  var banner='<div class="demo-notice"><div><strong>نسخة تجريبية دون إنترنت</strong>'+
   '<p>المبالغ والأسماء وهمية. الحفظ والترحيل هنا محاكاة محلية وليست قيوداً محاسبية معتمدة.</p></div>'+
   '<div class="demo-buttons"><button type="button" data-demo-connect>ربط Hostinger</button>'+
   '<button class="alt" type="button" data-demo-reset>إعادة التجربة</button></div></div>';
  return originalShell(content).replace('● قاعدة بيانات متصلة','● وضع تجريبي').replace('<main class="main">','<main class="main">'+banner);
 };
 backupPage=function(){
  return mkHead('النسخ والبيانات','التجربة المحلية لا تحتوي على نسخ MySQL',null,'backup','blue')+
   '<section class="panel"><h2>بيانات تجريبية فقط</h2><p>لا توجد قاعدة بيانات حقيقية مرتبطة. يمكنك إعادة البيانات من الزر أعلى الشاشة.</p></section>';
 };
 document.addEventListener('click',function(e){
  var open=e.target.closest('[data-demo-connect]');
  if(open){e.preventDefault();e.stopPropagation();if(window.NineSoftDemo)NineSoftDemo.openSetup();else setToast('اتصال الخادم متاح في تطبيق Android',true);return;}
  var reset=e.target.closest('[data-demo-reset]');
  if(reset){e.preventDefault();e.stopPropagation();if(confirm('هل تريد حذف كل التغييرات التجريبية من هذا الهاتف؟')){localStorage.removeItem(KEY);location.reload();}return;}
  var link=e.target.closest('a[href^="api.php"]');
  if(link){e.preventDefault();e.stopPropagation();setToast('هذه الوظيفة تتطلب اتصالاً بالخادم الحقيقي',true);}
 },true);
})();