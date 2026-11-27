const {esc,hex}=require('./_lib');
module.exports=(req,res)=>{
const n=String(req.query.n||'?').trim()||'?',c=hex(req.query.c)||'#0f172a';
res.setHeader('Content-Type','image/svg+xml');res.setHeader('Cache-Control','public,max-age=86400');
res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${c}"/><text x="256" y="340" font-size="260" font-family="sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${esc([...n][0].toUpperCase())}</text></svg>`)};
