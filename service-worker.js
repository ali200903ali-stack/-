/* Safe PWA cache: static assets only. Never cache API responses or authenticated HTML. */
const CACHE='ninesoft-assets-v1';
const ASSETS=['./assets/style.css?v=1','./assets/core.js?v=1','./assets/pages.js?v=1','./assets/actions.js?v=1','./assets/logo.svg','./manifest.webmanifest','./offline.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.endsWith('/api.php')||url.pathname.endsWith('/index.php')||url.pathname.endsWith('/install.php'))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match('./offline.html')));return}
 if(url.pathname.includes('/assets/')||url.pathname.endsWith('/manifest.webmanifest')||url.pathname.endsWith('/offline.html')){
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res})));
 }
});
