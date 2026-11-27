const {safeUrl,get,hex}=require('./_lib');
const pick=(h,re)=>(h.match(re)||[])[1];
module.exports=async(req,res)=>{
const url=safeUrl(req.query.url||'');if(!url)return res.status(400).json({error:'bad url'});
try{const r=await get(url),html=(await r.text()).slice(0,300000),base=r.url;
const abs=(h,b=base)=>{try{return new URL(h,b).href}catch{return null}};
const attr=(l,n)=>pick(l,new RegExp(n+'=["\']([^"\']+)','i'));
let name=pick(html,/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)||pick(html,/<title[^>]*>([^<]+)/i);
let color=pick(html,/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-f]{3,6})/i),icon=null;
const links=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]);
const size=l=>parseInt(attr(l,'sizes'))||0;
const best=links.filter(l=>/icon/i.test(attr(l,'rel')||'')).sort((a,b)=>size(b)-size(a))[0];
if(best)icon=abs(attr(best,'href'));
const mf=links.find(l=>/manifest/i.test(attr(l,'rel')||''));
if(mf){try{const mu=abs(attr(mf,'href')),m=await(await get(mu)).json();
name=m.short_name||m.name||name;color=m.theme_color||color;
const ic=(m.icons||[]).sort((a,b)=>(parseInt(b.sizes)||0)-(parseInt(a.sizes)||0))[0];if(ic)icon=abs(ic.src,mu)}catch{}}
res.setHeader('Cache-Control','s-maxage=3600');
res.json({name:(name||new URL(base).hostname).trim().slice(0,40),url:base,color:hex(color)||'#0f172a',icon:icon||abs('/favicon.ico')})
}catch{res.status(502).json({error:'fetch failed'})}};
