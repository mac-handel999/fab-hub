const catalog=require('../catalog.json');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeUrl(u){try{const x=new URL(/^https?:\/\//i.test(u)?u:'https://'+u);
if(!/^https?:$/.test(x.protocol))return null;const h=x.hostname;
if(!h.includes('.')||/^(127|10|0)\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^\[|\.local$|\.internal$/.test(h))return null;
return x.href}catch{return null}}
async function get(url,opt={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),6000);
try{return await fetch(url,{redirect:'follow',signal:c.signal,headers:{'user-agent':'FabHubBot/1.0'},...opt})}finally{clearTimeout(t)}}
const hex=c=>{c=(c||'').trim();if(/^#[0-9a-f]{3}$/i.test(c))c='#'+[...c.slice(1)].map(x=>x+x).join('');return /^#[0-9a-f]{6}$/i.test(c)?c:null};
const gen=(n,c)=>`/api/icon?n=${encodeURIComponent(n)}&c=${encodeURIComponent(c)}`;
function resolveApp(q){const a=catalog.find(x=>x.id===q.slug);
if(a)return{...a,color:hex(a.color)||'#0f172a',icon:a.icon||gen(a.name,hex(a.color)||'#0f172a')};
const url=safeUrl(q.u||'');if(!url)return null;
const name=(q.n||new URL(url).hostname.replace(/^www\./,'')).slice(0,40),color=hex(q.c)||'#0f172a';
return{name,url,color,icon:q.i||gen(name,color)}}
module.exports={catalog,esc,safeUrl,get,hex,resolveApp};
