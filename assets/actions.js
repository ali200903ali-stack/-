'use strict';
function newInvoice(kind){
 var products=NS.data.products;
 NS.editor={kind:kind,id:0,number:'',revision:0,date:NS.data.today,branch_id:NS.data.user.branch_id||NS.data.branches[0]?.id||1,
 customer_id:NS.data.customers[0]?.id||0,supplier_id:NS.data.suppliers[0]?.id||0,reference_id:'',
 payment:'cash',paid:'',discount:0,discount_type:'amount',tax_rate:0,note:'',
 lines:products.length&&kind!=='return'?[{product_id:products[0].id,qty:1,price:kind==='purchase'?products[0].cost:products[0].price}]:[]};
 NS.page='invoice-editor';NS.drawer=false;render();window.scrollTo(0,0);
 if(kind==='return'){
  api('list',undefined,{type:'sales'}).then(function(items){
   NS.returnSources=items.filter(function(x){return x.status==='posted'});
   if(!NS.returnSources.length)setToast('لا توجد فواتير بيع مرحّلة يمكن إرجاعها',true);
   render();
  }).catch(function(e){setToast(e.message,true)});
 }
}
function newJournal(){
 NS.journal={date:NS.data.today,branch_id:NS.data.user.branch_id||NS.data.branches[0]?.id||1,
 description:'',lines:[
 {account_id:NS.data.accounts[0]?.id||0,debit:'',credit:''},
 {account_id:NS.data.accounts[1]?.id||0,debit:'',credit:''}
 ]};
 NS.page='journal-editor';render();window.scrollTo(0,0);
}
function newVoucher(){
 var cash=NS.data.accounts.find(function(a){return a.code==='101'});
 NS.voucher={kind:'receipt',date:NS.data.today,branch_id:NS.data.user.branch_id||NS.data.branches[0]?.id||1,
 party_id:NS.data.customers[0]?.id||0,account_id:cash?.id||0,amount:'',description:''};
 NS.page='voucher-editor';render();window.scrollTo(0,0);
}
function backFromInvoice(){
 var kind=NS.editor?.kind||NS.document?.kind||'sale';
 return {sale:'sales',purchase:'purchases',return:'returns'}[kind];
}
function addBarcode(code){
 var p=NS.data.products.find(function(x){return x.sku===code.trim()||x.name===code.trim()});
 if(!p){setToast('الصنف غير موجود في المخزون',true);return}
 if(NS.editor.kind==='return' && !NS.returnOriginal?.lines.some(function(l){return String(l.product_id)===String(p.id)})){setToast('الصنف غير موجود بالفاتورة الأصلية',true);return}
 var row=NS.editor.lines.find(function(l){return String(l.product_id)===String(p.id)});
 if(row)row.qty=N(row.qty)+1;
 else NS.editor.lines.push({product_id:p.id,qty:1,price:NS.editor.kind==='purchase'?p.cost:p.price});
 render();document.getElementById('scan-barcode')?.focus();
 setToast('تمت إضافة الصنف: '+p.name);
}
async function updateReturnSource(sourceId){
 if(!sourceId)return;
 var src=await api('doc',undefined,{id:sourceId});
 NS.returnOriginal=src;
 var ratio=N(src.subtotal)>0?N(src.net)/N(src.subtotal):1;
 NS.editor.reference_id=String(src.id);
 NS.editor.customer_id=src.customer_id;
 NS.editor.branch_id=src.branch_id;
 NS.editor.tax_rate=src.tax_rate;
 NS.editor.discount=0;
 NS.editor.discount_type='amount';
 NS.editor.payment='cash'; NS.editor.paid='';
 NS.editor.lines=(src.lines||[]).map(function(l){return {product_id:l.product_id,qty:1,price:Math.round(N(l.price)*ratio*100)/100}});
 render();
}
var NS_BUSY=false;
async function saveInvoice(silent){
 if(!NS.editor)throw new Error('لا توجد فاتورة');
 var payload=Object.assign({},NS.editor,{lines:NS.editor.lines.map(function(l){return {product_id:Number(l.product_id),qty:N(l.qty),price:N(l.price)}})});
 var result=await api('save_invoice',payload);
 NS.editor.id=result.id;NS.editor.number=result.number;NS.editor.revision=result.revision;NS.editor.status='draft';
 if(!silent){render();setToast('تم حفظ المسودة على الخادم: '+result.number)}
 return result.id;
}
async function postInvoice(){
 if(NS_BUSY)return;
 NS_BUSY=true;
 try {
  var id=await saveInvoice(true);
  var out=await api('post_invoice',{id:id});
  setToast('تم ترحيل '+out.number+' وتسجيل القيد المحاسبي');
  NS.editor=null;await loadPage(backFromPosted(out.number));
 }catch(e){render();setToast(e.message,true)}
 finally{NS_BUSY=false}
}
function backFromPosted(number){return number.startsWith('PUR')?'purchases':number.startsWith('RET')?'returns':'sales'}
async function loadAccountReport(){
 var q=Object.assign({type:NS.currentReport},period());
 if(NS.currentReport==='statement'){
  NS.reportPartyType=NS.reportPartyType||'customer';
  var arr=NS.data[NS.reportPartyType==='supplier'?'suppliers':'customers'];
  NS.reportPartyId=NS.reportPartyId||arr[0]?.id||0;
  q.party_type=NS.reportPartyType;q.party_id=NS.reportPartyId;
 }
 NS.report=await api('report',undefined,q);NS.loading=false;render();
}
async function doAction(a,target){
 switch(a){
 case 'drawer':NS.drawer=!NS.drawer;render();return;
 case 'theme':NS.theme=!NS.theme;localStorage.setItem('ns-theme',NS.theme?'dark':'light');render();return;
 case 'logout':await api('logout',{});location.reload();return;
 case 'search':document.querySelector('#list-search')?.focus();return;
 case 'help':NS.modal={kind:'help'};render();return;
 case 'dismiss-modal':NS.modal=null;render();return;
 case 'new-sale':newInvoice('sale');return;
 case 'new-purchase':newInvoice('purchase');return;
 case 'new-return':newInvoice('return');return;
 case 'new-journal':newJournal();return;
 case 'new-voucher':newVoucher();return;
 case 'back-list':await loadPage(backFromInvoice());return;
 case 'back-journal':await loadPage('journal');return;
 case 'back-vouchers':await loadPage('vouchers');return;
 case 'add-invoice-line':{
  var p=NS.data.products[0];
  NS.editor.lines.push({product_id:p?.id||0,qty:1,price:NS.editor.kind==='purchase'?(p?.cost||0):(p?.price||0)});
  render();return;
 }
 case 'save-invoice':{
  if(NS_BUSY)return;NS_BUSY=true;
  try{await saveInvoice(false)}finally{NS_BUSY=false}
  return;
 }
 case 'post-invoice':await postInvoice();return;
 case 'post-doc':{
  if(!NS.document)return;
  if(!confirm('هل تريد ترحيل هذا المستند؟ لا يمكن تعديل مستند مرحّل.'))return;
  var out=await api('post_invoice',{id:NS.document.id});
  setToast('تم ترحيل المستند '+out.number);await loadPage('doc-view');return;
 }
 case 'edit-doc':{
  if(NS.document?.status!=='draft')return;
  var d=NS.document;
  NS.editor=Object.assign({},d,{lines:d.lines.map(function(l){return {product_id:l.product_id,qty:N(l.qty),price:N(l.price)}})});
  NS.page='invoice-editor';render();return;
 }
 case 'add-jline':NS.journal.lines.push({account_id:NS.data.accounts[0]?.id||0,debit:'',credit:''});render();return;
 case 'post-journal':{
  if(NS_BUSY)return;NS_BUSY=true;
  try {
   var j=Object.assign({},NS.journal,{lines:NS.journal.lines.map(function(l){return {account_id:Number(l.account_id),debit:N(l.debit),credit:N(l.credit)}})});
   var result=await api('post_journal',j);
   setToast('ترحيل قيد متوازن: '+result.number);await loadPage('journal');
  }finally{NS_BUSY=false}
  return;
 }
 case 'post-voucher':{
  if(NS_BUSY)return;NS_BUSY=true;
  try {
   var result=await api('post_voucher',NS.voucher);
   setToast('تم تسجيل السند: '+result.number);await loadPage('vouchers');
  }finally{NS_BUSY=false}
  return;
 }
 case 'apply-filter':{
  NS.from=document.getElementById('filter-from')?.value||'';
  NS.to=document.getElementById('filter-to')?.value||'';
  if(NS.page==='reports'){NS.loading=true;render();await loadAccountReport()}else await loadPage(NS.page);
  return;
 }
 case 'export-csv':{
  var tab=document.querySelector('.data-table');
  if(!tab){setToast('لا يوجد جدول للتصدير',true);return}
  var arr=Array.from(tab.querySelectorAll('tr')).map(function(r){return Array.from(r.querySelectorAll('th,td')).map(function(c){return c.textContent.trim()})});
  downloadCsv('NineSoft-'+NS.page+'-'+NS.data.today+'.csv',arr);setToast('تم تجهيز ملف CSV');return;
 }
 case 'print':window.print();return;
 }
 if(a.startsWith('add-')){
  NS.modal={kind:a.replace('add-',''),data:{}};render();return;
 }
}
async function submitModal(form){
 if(!NS.modal)return;
 var kind=NS.modal.kind;
 var body={id:NS.modal.data?.id||0};
 new FormData(form).forEach(function(value,key){body[key]=value});
 var op,nav;
 if(['customer','supplier'].includes(kind)){
  op='save_party';body.kind=kind==='customer'?'customers':'suppliers';nav=body.kind;
 }else if(kind==='product'){op='save_product';nav='inventory';body.branch_id=NS.data.user.branch_id||NS.data.branches[0]?.id||1;
 }else if(kind==='branch'){op='save_branch';nav='branches';
 }else if(kind==='account'){op='save_account';nav='accounts';
 }else if(kind==='user'){op='save_user';nav='users';
 }else return;
 await api(op,body);
 NS.modal=null;
 NS.data=await api('bootstrap');
 await loadPage(nav);
 setToast('تم حفظ البيانات بنجاح');
}
document.addEventListener('click',function(ev){
 var nav=ev.target.closest('[data-nav]');
 if(nav){loadPage(nav.dataset.nav);return}
 var doc=ev.target.closest('[data-doc]');
 if(doc){NS.selected=doc.dataset.doc;NS.document=null;loadPage('doc-view');return}
 var journal=ev.target.closest('[data-journal]');
 if(journal){NS.selected=journal.dataset.journal;NS.document=null;loadPage('journal-view');return}
 var edit=ev.target.closest('[data-edit]');
 if(edit){
  var kind=edit.dataset.edit;
  var plural={product:'products',customer:'customers',supplier:'suppliers',account:'accounts',branch:'branches',user:'users'}[kind];
  var item=NS.rows.find(function(x){return String(x.id)===String(edit.dataset.id)});
  NS.modal={kind:kind,data:item||{}};render();return;
 }
 var del=ev.target.closest('[data-del-line]');
 if(del&&NS.editor){NS.editor.lines.splice(+del.dataset.delLine,1);render();return}
 var delJ=ev.target.closest('[data-del-jline]');
 if(delJ&&NS.journal){NS.journal.lines.splice(+delJ.dataset.delJline,1);render();return}
 var action=ev.target.closest('[data-action]');
 if(action){
  if(action.id==='modal-overlay'&&ev.target.closest('.dialog'))return;
  doAction(action.dataset.action,action).catch(function(e){setToast(e.message,true)});
 }
});
document.addEventListener('input',function(ev){
 var el=ev.target;
 if(el.id==='list-search'){
  var pos=el.selectionStart;NS.search=el.value;render();
  var newEl=document.getElementById('list-search');
  if(newEl){newEl.focus();newEl.setSelectionRange(pos,pos)}
  return;
 }
 if(NS.editor&&el.dataset.ed){NS.editor[el.dataset.ed]=el.value;return}
 if(NS.editor&&el.dataset.line!==undefined){
  var l=NS.editor.lines[Number(el.dataset.line)];
  if(l)l[el.dataset.col]=el.value;
  return;
 }
 if(NS.journal&&el.dataset.journal){NS.journal[el.dataset.journal]=el.value;return}
 if(NS.journal&&el.dataset.jline!==undefined){
  var ln=NS.journal.lines[+el.dataset.jline];if(ln)ln[el.dataset.col]=el.value;
  return;
 }
 if(NS.voucher&&el.dataset.voucher){NS.voucher[el.dataset.voucher]=el.value;return}
});
document.addEventListener('change',function(ev){
 var el=ev.target;
 if(el.id==='report-tab'){
  NS.currentReport=el.value;NS.loading=true;render();
  loadAccountReport().catch(function(e){NS.loading=false;render();setToast(e.message,true)});
  return;
 }
 if(el.id==='report-party-type'){
  NS.reportPartyType=el.value;NS.reportPartyId=null;
  NS.loading=true;render();loadAccountReport().catch(function(e){setToast(e.message,true)});
  return;
 }
 if(el.id==='report-party'){
  NS.reportPartyId=el.value;NS.loading=true;render();loadAccountReport().catch(function(e){setToast(e.message,true)});
  return;
 }
 if(NS.editor&&el.dataset.ed==='reference_id'){
  updateReturnSource(el.value).catch(function(e){setToast(e.message,true)});return;
 }
 if(NS.editor&&el.dataset.line!==undefined&&el.dataset.col==='product_id'){
  var l=NS.editor.lines[+el.dataset.line],p=byId('products',l.product_id);
  if(p)l.price=NS.editor.kind==='purchase'?p.cost:p.price;
  render();return;
 }
 if(NS.editor&&el.dataset.ed){NS.editor[el.dataset.ed]=el.value;render();return}
 if(NS.editor&&el.dataset.line!==undefined){NS.editor.lines[+el.dataset.line][el.dataset.col]=el.value;render();return}
 if(NS.journal&&el.dataset.jline!==undefined){NS.journal.lines[+el.dataset.jline][el.dataset.col]=el.value;render();return}
 if(NS.voucher&&el.dataset.voucher==='kind'){
  NS.voucher.kind=el.value;var list=NS.data[el.value==='receipt'?'customers':'suppliers'];
  NS.voucher.party_id=list[0]?.id||0;render();return;
 }
});
document.addEventListener('submit',function(ev){
 var form=ev.target;
 if(form.id==='login-form'){
  ev.preventDefault();var button=document.getElementById('login-submit'),err=document.getElementById('login-error');
  button.disabled=true;err.classList.add('hidden');
  api('login',{email:document.getElementById('login-email').value,password:document.getElementById('login-password').value}).then(function(){location.reload()})
  .catch(function(e){err.textContent=e.message;err.classList.remove('hidden');button.disabled=false});
  return;
 }
 if(form.id==='modal-form'){
  ev.preventDefault();var b=form.querySelector('[type="submit"]');if(b)b.disabled=true;
  submitModal(form).catch(function(e){setToast(e.message,true);if(b)b.disabled=false});return;
 }
 if(form.id==='settings-form'){
  ev.preventDefault();var fd=new FormData(form);
  api('save_settings',{company:fd.get('company'),currency:fd.get('currency')}).then(async function(){
   NS.data=await api('bootstrap');render();setToast('حُفظت الإعدادات')
  }).catch(function(e){setToast(e.message,true)});
 }
});
document.addEventListener('keydown',function(ev){
 if(ev.key==='Escape'&&NS.modal){NS.modal=null;render();return}
 if(ev.key==='Enter'&&ev.target.id==='scan-barcode'){ev.preventDefault();addBarcode(ev.target.value);return}
 if(ev.key==='F4'&&NS.page==='invoice-editor'){ev.preventDefault();document.getElementById('scan-barcode')?.focus();return}
 if(ev.key==='F2'&&NS.page==='invoice-editor'){ev.preventDefault();doAction('add-invoice-line').catch(console.error);return}
 if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='s'&&NS.page==='invoice-editor'){ev.preventDefault();doAction('save-invoice').catch(function(e){setToast(e.message,true)});return}
 if((ev.ctrlKey||ev.metaKey)&&ev.key==='Enter'&&NS.page==='invoice-editor'){ev.preventDefault();postInvoice();return}
 if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();document.querySelector('#list-search')?.focus();return}
});
document.addEventListener('DOMContentLoaded',function(){
 var el=document.getElementById('app');
 if(el){
  api('bootstrap').then(function(data){
   NS.data=data;window.NS_BOOT.csrf=data.csrf;
   if(data.user.role==='cashier')NS.branch=Number(data.user.branch_id);
   return loadPage('dashboard');
  }).catch(function(e){el.innerHTML='<div class="auth-body"><div class="auth-card"><h2>تعذر تحميل بيانات النظام</h2><p>'+E(e.message)+'</p><a href="index.php">إعادة التحميل</a></div></div>'});
 }
});
