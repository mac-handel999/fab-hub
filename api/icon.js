const {esc,hex,safeUrl,get}=require('./_lib');
async function fetchFaviconBuffer(domain){
  const u=safeUrl('https://'+domain);
  if(!u)return null;
  try{
    const r=await get(u);
    const html=await r.text();
    const base=r.url;
    const abs=(h,b=base)=>{try{return new URL(h,b).href}catch{return null}};
    const attr=(l,n)=>(l.match(new RegExp(n+'=["\']([^"\']+)','i'))||[])[1];
    const links=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]);
    const size=l=>parseInt(attr(l,'sizes'))||0;
    let icon=links.filter(l=>/icon/i.test(attr(l,'rel')||'')).sort((a,b)=>size(b)-size(a))[0];
    if(icon)icon=abs(attr(icon,'href'));
    if(!icon)icon=abs('/favicon.ico',base);
    if(icon){
      const ir=await get(icon);
      if(ir.ok){
        const buf=await ir.arrayBuffer();
        const ct=ir.headers.get('content-type')||'image/png';
        return {buf,ct};
      }
    }
  }catch{}
  try{
    const googleUrl=`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
    const gr=await get(googleUrl);
    if(gr.ok){
      const buf=await gr.arrayBuffer();
      const ct=gr.headers.get('content-type')||'image/png';
      return {buf,ct};
    }
  }catch{}
  return null;
}
module.exports=async(req,res)=>{
  const domain=req.query.domain;
  if(domain){
    const u=safeUrl('https://'+domain);
    if(!u)return res.status(400).send('bad domain');
    const data=await fetchFaviconBuffer(domain);
    if(data){
      res.setHeader('Content-Type',data.ct);
      res.setHeader('Cache-Control','public,max-age=86400');
      return res.send(Buffer.from(data.buf));
    }
    return res.status(404).send('not found');
  }
  const n=String(req.query.n||'?').trim()||'?',c=hex(req.query.c)||'#0f172a';
  res.setHeader('Content-Type','image/svg+xml');
  res.setHeader('Cache-Control','public,max-age=86400');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${c}"/><text x="256" y="340" font-size="260" font-family="sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${esc([...n][0].toUpperCase())}</text></svg>`);
};