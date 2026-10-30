'use strict';
/* NineSoft production frontend: UI only. Transactions and validation are server-authoritative. */
var NS = {
  data:null, page:'dashboard', rows:[], report:[], stats:null, document:null,
  editor:null, journal:null, voucher:null, modal:null, selected:null,
  search:'', from:'', to:'', currentReport:'trial', branch:0,
  drawer:false, theme:localStorage.getItem('ns-theme')==='dark', loading:false
};
var ICONS = {
 dashboard:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/>',
 sales:'<path d="M5 9h14l1 12H4L5 9Z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
 purchases:'<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M2 3h2l2.5 12.5h13L22 6H5"/>',
 returns:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/>',
 inventory:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/>',
 customers:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 suppliers:'<rect x="3" y="7" width="12" height="11"/><path d="M15 11h4l3 4v3h-7"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
 accounts:'<path d="m3 9 9-6 9 6M5 10v9M10 10v9M14 10v9M19 10v9M2 21h20M2 10h20"/>',
 journal:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M8 8h8M8 12h6"/>',
 vouchers:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M7 3h12v3M16 15h2"/>',
 cashbox:'<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/>',
 reports:'<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-8"/>',
 wasl:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3A5 5 0 0 0 13.4 3.4l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
 whatsapp:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11h8M8 14h5"/>',
 backup:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 2 4 3 9 3s9-1 9-3V5M3 12c0 2 4 3 9 3s9-1 9-3"/>',
 users:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
 branches:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8 7h1M15 7h1M8 11h1M15 11h1"/>',
 quarantine_review:'<path d="m10.3 3.9-8.2 14.3A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="m19 13.5 2-1.5-2-1.5-.6-2 1-2.2-2.3-2.3-2.2 1-2-.6L12 2l-1.5 2-2 .6-2.2-1L4 5.9l1 2.2-.6 2L2 12l2.4 1.5.6 2-1 2.2 2.3 2.3 2.2-1 2 .6L12 22l1.5-2.4 2-.6 2.2 1 2.3-2.3-1-2.2Z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 21v-8h10v8"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 close:'<path d="M18 6 6 18M6 6l12 12"/>', help:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01"/>',
 print:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 check:'<path d="m5 12 4 4L19 6"/>', download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 logout:'<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M15 7l5 5-5 5M20 12H9"/>',
 moon:'<path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2"/>',
 clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'
};
var NAV_GROUPS = [
 ['مساحة العمل',[['dashboard','لوحة القيادة','mint']]],
 ['المبيعات والتجارة',[['sales','فواتير المبيعات','purple'],['purchases','المشتريات','blue'],['returns','المرتجعات','red'],['inventory','المخزون والأصناف','orange'],['customers','العملاء','cyan'],['suppliers','الموردون','cyan']]],
 ['الإدارة المالية',[['accounts','شجرة الحسابات','red'],['journal','القيود اليومية','violet'],['vouchers','القبض والصرف','gold'],['cashbox','الصندوق والحسابات','gold'],['reports','التقارير والتحليلات','violet']]],
 ['التكامل والإدارة',[['wasl','خدمات WASL','blue'],['whatsapp','واتساب','mint'],['backup','النسخ والبيانات','blue'],['users','المستخدمون والصلاحيات','slate'],['branches','الفروع','slate'],['quarantine_review','مراجعة المسودات','orange'],['settings','الإعدادات','slate']]]
];
var TILES = [['dashboard','الرئيسية','mint'],['sales','المبيعات','purple'],['purchases','المشتريات','blue'],['inventory','المخزون والأصناف','orange'],['customers','العملاء والموردون','cyan'],['accounts','الحسابات العامة','red'],['cashbox','العمليات المالية','gold'],['reports','التقارير والتحليلات','violet'],['wasl','التكامل والخدمات','blue'],['settings','الإدارة والنظام','slate']];
var TITLES = {};
NAV_GROUPS.forEach(function(g){g[1].forEach(function(i){TITLES[i[0]]=i[1]})});
TITLES['invoice-editor']='فاتورة جديدة';
TITLES['journal-editor']='قيد يومية جديد';
TITLES['voucher-editor']='سند مالي جديد';
TITLES['doc-view']='عرض المستند';
TITLES['journal-view']='تفاصيل القيد';
function E(str){return String(str===undefined||str===null?'':str).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function N(x){var v=Number(x);return Number.isFinite(v)?v:0}
function F(x,n){return new Intl.NumberFormat('en-US',{minimumFractionDigits:n||0,maximumFractionDigits:n===undefined?2:n}).format(N(x))}
function M(x){return '<span class="num">'+F(x)+'</span> <small class="muted">'+E(NS.data?.settings?.currency||'YER')+'</small>'}
function S(name,size){return '<svg width="'+(size||19)+'" height="'+(size||19)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[name]||ICONS.dashboard)+'</svg>'}
function B(action,title,icon,cls,extra){return '<button type="button" data-action="'+E(action)+'" '+(extra||'')+' class="'+(cls||'btn')+'">'+(icon?S(icon,17):'')+E(title)+'</button>'}
function badge(x){return '<span class="badge '+(x==='posted'?'good':x==='draft'?'warn':'off')+'">'+(x==='posted'?'مرحّل':x==='draft'?'مسودة':E(x))+'</span>'}
function opts(rows,value,labelKey,placeholder){var a=placeholder?'<option value="">'+E(placeholder)+'</option>':'';return a+(rows||[]).map(function(r){return '<option value="'+E(r.id)+'" '+(String(r.id)===String(value)?'selected':'')+'>'+E(r[labelKey||'name'])+'</option>'}).join('')}
function byId(type,id){return (NS.data?.[type]||[]).find(function(x){return String(x.id)===String(id)})}
function canWrite(){return NS.data && ['admin','accountant','cashier'].includes(NS.data.user.role)}
function canManage(){return NS.data && ['admin','accountant'].includes(NS.data.user.role)}
function isAdmin(){return NS.data && NS.data.user.role==='admin'}
function setToast(message,error){
 var box=document.getElementById('toasts');
 if(!box){console.warn(message);alert(message);return}
 var t=document.createElement('div');t.className='toast'+(error?' error':'');t.textContent=message;box.appendChild(t);
 setTimeout(function(){t.remove()},4300);
}
function api(op,data,query){
 var url='api.php?op='+encodeURIComponent(op);
 if(query)Object.keys(query).forEach(function(k){if(query[k]!==undefined&&query[k]!==null)url+='&'+encodeURIComponent(k)+'='+encodeURIComponent(query[k])});
 var options={credentials:'same-origin',headers:{'Accept':'application/json'}};
 if(data!==undefined){options.method='POST';options.headers['Content-Type']='application/json';options.headers['X-CSRF-Token']=window.NS_BOOT?.csrf||'';options.body=JSON.stringify(Object.assign({op:op},data))}
 return fetch(url,options).then(function(r){return r.json().then(function(body){if(!r.ok||!body.ok)throw new Error(body.error||'تعذر الاتصال بالخادم');return body.data===undefined?body:body.data})});
}
function period(){return {from:NS.from||undefined,to:NS.to||undefined,branch:NS.branch||undefined}}
function downloadCsv(name,rows){
 var text='\uFEFF'+rows.map(function(row){return row.map(function(v){var s=String(v??'');return '"'+s.replace(/"/g,'""')+'"'}).join(',')}).join('\r\n');
 var a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url)},800);
}
function mkHead(title,desc,actions,icon,tone){
 return '<div class="page-head"><div class="head-title"><span class="head-icon tone-'+(tone||'mint')+'">'+S(icon||'dashboard',26)+'</span><div><h1>'+E(title)+'</h1><p>'+E(desc||'سجلات مرتبطة مباشرة بقاعدة البيانات')+'</p></div></div><div class="actions">'+(actions||'')+B('help','شرح','help','btn-subtle')+'</div></div>';
}
function subNav(){return NAV_GROUPS.map(function(g){return '<div class="nav-caption">'+E(g[0])+'</div>'+g[1].map(function(it){return '<button type="button" data-nav="'+it[0]+'" class="nav-item '+(NS.page===it[0]?'active':'')+'"><span class="nav-icon tone-'+it[2]+'">'+S(it[0])+'</span><span>'+E(it[1])+'</span></button>'}).join('')}).join('')}
function shell(content){
 var u=NS.data.user, logged=E(u.name), company=E(NS.data.settings.company||'شركتي');
 return '<div class="app-shell '+(NS.theme?'theme-dark':'')+'"><aside class="sidebar '+(NS.drawer?'open':'')+'"><div class="sidebar-header"><img src="assets/logo.svg" alt="NineSoft"><div class="brand-line"><strong>Nine<span>Soft</span></strong><small>ناين سوفت للحلول المالية</small></div></div><div class="sidebar-scroll">'+subNav()+'</div><div class="sidebar-user"><span class="user-bubble">'+E(logged.slice(0,1))+'</span><span><strong>'+logged+'</strong><small>'+E(u.role)+' | '+company+'</small></span></div></aside><div class="scrim '+(NS.drawer?'show':'')+'" data-action="drawer"></div><section class="workspace"><header class="topbar"><div class="topbar-logo"><button class="icon-btn menu-button" data-action="drawer" aria-label="القائمة">'+S('menu')+'</button><img src="assets/logo.svg" alt="NineSoft"><div class="brand-line"><strong>Nine<span>Soft</span></strong><small>ناين سوفت للحلول المالية</small></div><span class="context-label">'+E(TITLES[NS.page]||'الرئيسية')+'</span></div><div class="top-actions"><span class="pill">● قاعدة بيانات متصلة</span><button class="icon-btn" data-action="search" title="البحث">'+S('search')+'</button><button class="icon-btn" data-action="theme" title="تغيير المظهر">'+S(NS.theme?'sun':'moon')+'</button><button class="icon-btn" data-action="logout" title="تسجيل الخروج">'+S('logout')+'</button><span class="icon-btn top-avatar">'+S('users')+'</span></div></header><main class="main">'+content+'</main></section><nav class="mobile-bottom">'+[['dashboard','الرئيسية','home'],['sales','المبيعات','sales'],['purchases','مشتريات','purchases'],['inventory','المخزون','inventory'],['cashbox','المالية','cashbox'],['reports','تقارير','reports']].map(function(i){return '<button data-nav="'+i[0]+'" class="'+(NS.page===i[0]?'active':'')+'">'+S(i[2],22)+'<span>'+i[1]+'</span></button>'}).join('')+'</nav><button class="floating-add" data-action="new-sale" aria-label="فاتورة جديدة">'+S('plus',26)+'</button></div><div id="modal-root">'+(NS.modal?modalMarkup():'')+'</div><div id="toasts" class="toasts"></div>';
}
async function loadPage(page){
 NS.page=page;NS.search='';NS.drawer=false;NS.loading=true;
 render();
 try {
  if(page==='dashboard')NS.stats=await api('dashboard',undefined,period());
  else if(['sales','purchases','returns','inventory','customers','suppliers','accounts','branches','users','journal','vouchers'].includes(page))NS.rows=await api('list',undefined,Object.assign({type:page},period()));
  else if(page==='cashbox')NS.report=await api('report',undefined,Object.assign({type:'cashbox'},period()));
  else if(page==='reports')NS.report=await api('report',undefined,Object.assign({type:NS.currentReport},period()));
  else if(page==='quarantine_review'){
   var result=await Promise.all(['sales','purchases','returns'].map(function(t){return api('list',undefined,Object.assign({type:t},period()))}));
   NS.rows=result.flat().filter(function(x){return x.status==='draft'});
  }else if(page==='doc-view') NS.document=await api('doc',undefined,{id:NS.selected});
  else if(page==='journal-view') NS.document=await api('journal_doc',undefined,{id:NS.selected});
 }catch(err){setToast(err.message,true);NS.rows=[]}
 NS.loading=false;render();
 window.scrollTo(0,0);
}
function render(){
 var mount=document.getElementById('app');
 if(!mount||!NS.data)return;
 var content=NS.loading?'<div class="panel empty"><div class="spinner"></div><p>جاري تحميل البيانات...</p></div>':renderPage();
 mount.innerHTML=shell(content);
}
