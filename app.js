const $=s=>document.querySelector(s),LS='fabhub.apps',enc=encodeURIComponent;
let mine=JSON.parse(localStorage.getItem(LS)||'[]'),tabs=[],ai=-1,timer,editing=false,suppress=false;
const save=()=>localStorage.setItem(LS,JSON.stringify(mine));
const cur=()=>tabs[ai]&&tabs[ai].app;
const gen=a=>`/api/icon?n=${enc(a.name)}&c=${enc(a.color||'#0f172a')}`;
const has=a=>mine.some(m=>m.url===a.url);
const installUrl=a=>a.id?`/a/${a.id}`:'/a/site?'+new URLSearchParams({u:a.url,n:a.name,c:a.color,i:a.icon||''});
const api=async p=>(await fetch(p)).json();
const urlLike=v=>/^(https?:\/\/)?[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(v);
const icon=a=>{const i=new Image();i.src=a.icon||gen(a);i.alt='';i.draggable=false;i.onerror=()=>{i.onerror=null;i.src=gen(a)};return i};

/* ---- reorder (press and hold, then drag) ---- */
const rects=()=>new Map([...$('#mineGrid').children].map(c=>[c,c.getBoundingClientRect()]));
function flip(f){for(const [c,r] of f){const n=c.getBoundingClientRect(),dx=r.left-n.left,dy=r.top-n.top;
if(dx||dy)c.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:200,easing:'ease'})}}
function edit(on){editing=on;$('#mineGrid').classList.toggle('edit',on);$('#done').hidden=!on}
function drag(el){const g=$('#mineGrid');el.classList.add('drag');
const mv=e=>{const t=document.elementFromPoint(e.clientX,e.clientY)?.closest('#mineGrid .tile');
if(t&&t!==el){const f=rects(),k=[...g.children];
if(k.indexOf(t)>k.indexOf(el))g.insertBefore(t,el);else g.insertBefore(t,el.nextSibling);flip(f)}};
const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);
el.classList.remove('drag');mine=[...g.children].map(c=>mine.find(m=>m.url===c.dataset.url)).filter(Boolean);save()};
addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up)}

function tile(a,m){const d=document.createElement('div');d.className='tile';d.dataset.url=a.url;
const s=document.createElement('span');s.textContent=a.name;d.append(icon(a),s);
d.onclick=()=>{if(editing||suppress){suppress=false;return}open(a)};
if(m){const x=document.createElement('button');x.className='x';x.textContent='×';
x.onclick=e=>{e.stopPropagation();mine=mine.filter(z=>z.url!==a.url);save();renderMine()};d.append(x);
let t,sx,sy;
d.onpointerdown=e=>{sx=e.clientX;sy=e.clientY;if(editing)return drag(d);t=setTimeout(()=>{suppress=true;edit(true)},500)};
d.onpointermove=e=>{if(Math.hypot(e.clientX-sx,e.clientY-sy)>8)clearTimeout(t)};
d.onpointerup=d.onpointercancel=()=>{clearTimeout(t);if(suppress)setTimeout(()=>suppress=false,50)}}
return d}
const fill=(el,list,m)=>el.replaceChildren(...list.map(a=>tile(a,m)));
function row(p,t,s,fn){const d=document.createElement('div');d.className='row';
const b=document.createElement('b'),m=document.createElement('small');b.textContent=t;m.textContent=s;d.append(b,m);d.onclick=fn;p.append(d)}
const renderMine=()=>{fill($('#mineGrid'),mine,true);$('#empty').hidden=mine.length>0};

function tab(t){edit(false);$('#results').hidden=true;$('#store').hidden=t!=='store';$('#mine').hidden=t!=='mine';
document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t))}

async function search(v){v=v.trim();const r=$('#results');
if(!v)return tab(document.querySelector('nav .on')?.dataset.tab||'store');
$('#store').hidden=$('#mine').hidden=true;r.hidden=false;r.replaceChildren();
if(urlLike(v))row(r,'Open '+v,'Fetch its name, icon and colors, then open',()=>addSite(v));
const {apps,web}=await api('/api/search?q='+enc(v));
if(apps.length){const g=document.createElement('div');g.className='grid';fill(g,apps);r.append(g)}
web.forEach(w=>row(r,w.title,w.url,()=>addSite(w.url)));
if(!apps.length&&!web.length&&!urlLike(v))r.append(Object.assign(document.createElement('p'),{className:'empty',textContent:'No results. Try a website address like example.com'}))}
async function addSite(u){try{const a=await api('/api/meta?url='+enc(u));if(a.error)throw 0;open(a)}catch{alert('Could not load that site.')}}

/* ---- tabs ---- */
function renderTabs(){
$('#tabs').replaceChildren(...tabs.map((t,i)=>{const b=document.createElement('div');b.className='tab'+(i===ai?' on':'');
const s=document.createElement('span'),x=document.createElement('button');s.textContent=t.app.name;x.textContent='×';
x.onclick=e=>{e.stopPropagation();closeTab(i)};b.append(icon(t.app),s,x);b.onclick=()=>activate(i);return b}));
$('#navTabs').textContent='Tabs'+(tabs.length?` (${tabs.length})`:'')}
function activate(i){ai=i;const t=tabs[i];$('#viewer').hidden=false;
tabs.forEach(z=>z.frame&&(z.frame.hidden=z!==t));$('#blocked').hidden=!t.blocked;
$('#vName').textContent=t.app.name;$('#vAdd').hidden=has(t.app);renderTabs()}
function closeTab(i){const[t]=tabs.splice(i,1);t.frame&&t.frame.remove();
if(!tabs.length){ai=-1;$('#viewer').hidden=true;return renderTabs()}
if(i<ai)ai--;else if(i===ai)ai=Math.min(ai,tabs.length-1);activate(ai)}
async function open(a){let i=tabs.findIndex(t=>t.app.url===a.url);
if(i>=0)return activate(i);
const t={app:a,frame:null,blocked:false};tabs.push(t);activate(tabs.length-1);
const j=await api('/api/frameable?url='+enc(a.url)).catch(()=>({ok:false}));if(!tabs.includes(t))return;
if(j.ok){const f=document.createElement('iframe');f.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads';
f.src=a.url;f.hidden=tabs[ai]!==t;t.frame=f;$('#frames').append(f)}else t.blocked=true;
if(tabs[ai]===t&&!$('#viewer').hidden)activate(ai)}

$('#vBack').onclick=()=>{$('#viewer').hidden=true;renderTabs()};
$('#vReload').onclick=()=>{const f=tabs[ai]&&tabs[ai].frame;if(f)f.src=f.src};
$('#vOpen').onclick=$('#bOpen').onclick=()=>cur()&&window.open(cur().url,'_blank','noopener');
$('#vAdd').onclick=()=>{const a=cur();if(a&&!has(a)){mine.push(a);save();renderMine()}$('#vAdd').hidden=true};
$('#vInstall').onclick=()=>cur()&&window.open(installUrl(cur()),'_blank');
$('#navTabs').onclick=()=>tabs.length&&activate(Math.max(ai,0));
$('#done').onclick=()=>edit(false);
$('#q').oninput=e=>{clearTimeout(timer);timer=setTimeout(()=>search(e.target.value),250)};
const go=()=>{const v=$('#q').value.trim();urlLike(v)?addSite(v):search(v)};
$('#go').onclick=go;$('#q').onkeydown=e=>e.key==='Enter'&&go();
document.querySelectorAll('nav button[data-tab]').forEach(b=>b.onclick=()=>{$('#q').value='';tab(b.dataset.tab)});

renderMine();api('/api/search?q=').then(d=>fill($('#storeGrid'),d.apps));
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js');
