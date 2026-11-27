const {safeUrl,get}=require('./_lib');
module.exports=async(req,res)=>{
const url=safeUrl(req.query.url||'');if(!url)return res.status(400).json({ok:false});
try{const r=await get(url);
const xfo=(r.headers.get('x-frame-options')||'').toLowerCase(),csp=r.headers.get('content-security-policy')||'';
const fa=(csp.match(/frame-ancestors([^;]*)/i)||[])[1]||'';
const blocked=/deny|sameorigin/.test(xfo)||(fa&&!/\*/.test(fa));
res.setHeader('Cache-Control','s-maxage=3600');res.json({ok:r.ok&&!blocked})}catch{res.json({ok:false})}};
