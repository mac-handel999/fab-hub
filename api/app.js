const {resolveApp,esc}=require('./_lib');
module.exports=(req,res)=>{
const a=resolveApp(req.query);if(!a)return res.status(404).send('App not found');
const {slug,...rest}=req.query,q=new URLSearchParams(rest).toString();
const mf='/a/'+esc(slug)+'/manifest.json'+(q?'?'+esc(q):'');
const j=s=>JSON.stringify(s).replace(/</g,'\\u003c');
res.setHeader('Content-Type','text/html; charset=utf-8');
res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(a.name)}</title>
<meta name="theme-color" content="${esc(a.color)}"><link rel="manifest" href="${mf}"><link rel="apple-touch-icon" href="${esc(a.icon)}"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="${esc(a.name)}">
<style>html,body{margin:0;height:100%;font-family:system-ui,sans-serif}body{background:${esc(a.color)};color:#fff;display:grid;place-content:center;text-align:center;padding:24px}iframe{position:fixed;inset:0;width:100%;height:100%;border:0;background:#fff}img{width:96px;height:96px;border-radius:24px;margin:auto}button,a{display:block;margin:12px auto;padding:12px 22px;border-radius:999px;border:0;background:#fff;color:#111;font:inherit;text-decoration:none}[hidden]{display:none!important}</style></head><body>
<div id="card"><img src="${esc(a.icon)}" alt=""><h1>${esc(a.name)}</h1><p id="m"></p><button id="i" hidden>Install app</button><a href="${esc(a.url)}" rel="noopener">Open site</a></div>
<script>
var U=${j(a.url)},st=matchMedia('(display-mode: standalone)').matches||navigator.standalone,ev;
if(st){fetch('/api/frameable?url='+encodeURIComponent(U)).then(function(r){return r.json()}).then(function(d){if(d.ok){var f=document.createElement('iframe');f.src=U;f.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads';document.body.appendChild(f)}else location.replace(U)}).catch(function(){location.replace(U)})}
else{var m=document.getElementById('m');m.textContent=/iphone|ipad/i.test(navigator.userAgent)?'Tap Share, then Add to Home Screen.':'Use your browser menu and choose Install app.';
addEventListener('beforeinstallprompt',function(e){e.preventDefault();ev=e;var b=document.getElementById('i');b.hidden=false;m.textContent='';b.onclick=function(){ev.prompt()}})}
</script></body></html>`)};
