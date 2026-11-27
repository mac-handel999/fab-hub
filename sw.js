const C='fabhub-v2',SHELL=['/','/style.css','/app.js','/manifest.json','/icons/icon-192.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api')||u.pathname.startsWith('/a/'))return;
e.respondWith(fetch(e.request).then(r=>{const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));return r})
.catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))))});
