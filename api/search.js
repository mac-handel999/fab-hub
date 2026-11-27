const {catalog}=require('./_lib');
module.exports=async(req,res)=>{
const q=String(req.query.q||'').trim().toLowerCase();
const apps=catalog.filter(a=>!q||[a.name,a.desc,...(a.tags||[])].join(' ').toLowerCase().includes(q));
let web=[];const k=process.env.BRAVE_API_KEY;
if(q&&k){try{const r=await fetch('https://api.search.brave.com/res/v1/web/search?count=8&q='+encodeURIComponent(q),{headers:{'X-Subscription-Token':k,Accept:'application/json'}});
const j=await r.json();web=(j.web?.results||[]).map(x=>({title:x.title,url:x.url,desc:x.description}))}catch{}}
res.json({apps,web})};
