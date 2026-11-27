const {resolveApp}=require('./_lib');
module.exports=(req,res)=>{
const a=resolveApp(req.query);if(!a)return res.status(404).end();
const {slug,...rest}=req.query,q=new URLSearchParams(rest).toString(),start='/a/'+slug+(q?'?'+q:'');
const t=/\/api\/icon/.test(a.icon)?'image/svg+xml':/\.png(\?|$)/.test(a.icon)?'image/png':undefined;
const ic=(s)=>({src:a.icon,sizes:s,...(t?{type:t}:{}),purpose:'any'});
const gi=a.icon.startsWith('/api/icon')?a.icon:'/api/icon?n='+encodeURIComponent(a.name)+'&c='+encodeURIComponent(a.color);
res.setHeader('Content-Type','application/manifest+json');res.setHeader('Cache-Control','s-maxage=3600');
res.json({id:start,name:a.name,short_name:a.name.slice(0,12),start_url:start,scope:'/a/'+slug,display:'standalone',
background_color:a.color,theme_color:a.color,icons:[ic('192x192'),ic('512x512'),{src:gi,sizes:'any',type:'image/svg+xml',purpose:'any'}]})};
