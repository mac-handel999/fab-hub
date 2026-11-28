const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const LS='fabhub.apps',LS_TRASH='fabhub.trash',LS_RECENTS='fabhub.recents',LS_SESSION='fabhub.session',LS_DARK='fabhub.dark',LS_ICON_CACHE='fabhub.iconCache',LS_APP_SETTINGS='fabhub.appSettings',LS_PINNED='fabhub.pinned',LS_FOLDERS='fabhub.folders',LS_BLOCKED='fabhub.blocked',enc=encodeURIComponent;
function sanitize(arr){return (arr||[]).filter(x=>x&&x.url)}
let mine=sanitize(JSON.parse(localStorage.getItem(LS)||'[]')),trash=sanitize(JSON.parse(localStorage.getItem(LS_TRASH)||'[]')),recents=sanitize(JSON.parse(localStorage.getItem(LS_RECENTS)||'[]')),tabs=[],ai=-1,timer,editing=false,suppress=false,currentPage=0;
let darkPrefs=JSON.parse(localStorage.getItem(LS_DARK)||'{}'),iconCache=JSON.parse(localStorage.getItem(LS_ICON_CACHE)||'{}'),appSettings=JSON.parse(localStorage.getItem(LS_APP_SETTINGS)||'{}'),pinned=JSON.parse(localStorage.getItem(LS_PINNED)||'[]'),folders=JSON.parse(localStorage.getItem(LS_FOLDERS)||'{}'),blockedSites=JSON.parse(localStorage.getItem(LS_BLOCKED)||'[]');
const save=()=>localStorage.setItem(LS,JSON.stringify(mine));
const saveTrash=()=>localStorage.setItem(LS_TRASH,JSON.stringify(trash));
const saveRecents=()=>localStorage.setItem(LS_RECENTS,JSON.stringify(recents));
const saveIconCache=()=>localStorage.setItem(LS_ICON_CACHE,JSON.stringify(iconCache));
const saveAppSettings=()=>localStorage.setItem(LS_APP_SETTINGS,JSON.stringify(appSettings));
const savePinned=()=>localStorage.setItem(LS_PINNED,JSON.stringify(pinned));
const saveFolders=()=>localStorage.setItem(LS_FOLDERS,JSON.stringify(folders));
const saveBlocked=()=>localStorage.setItem(LS_BLOCKED,JSON.stringify(blockedSites));
function addRecent(app){if(!app||!app.url)return;recents=recents.filter(r=>r.url!==app.url);recents.unshift({url:app.url,name:app.name,icon:app.icon,color:app.color,ts:Date.now()});if(recents.length>20)recents.pop();saveRecents();renderRecents()}
function saveSession(){const session={tabs:tabs.map(t=>t.app.url),active:ai>=0?tabs[ai].app.url:null};localStorage.setItem(LS_SESSION,JSON.stringify(session))}
function restoreSession(){try{const s=JSON.parse(localStorage.getItem(LS_SESSION)||'null');if(!s||!s.tabs?.length)return;s.tabs.forEach(url=>{const a=mine.find(m=>m.url===url);if(a)open(a)});if(s.active){const idx=tabs.findIndex(t=>t.app.url===s.active);if(idx>=0)activate(idx)}}catch{}}
function purgeOldTrash(){const now=Date.now(),cutoff=30*24*60*60*1000;trash=trash.filter(t=>now-t.ts<cutoff);saveTrash()}
purgeOldTrash();
const DEFAULT_THEME='#0b1020';
const themeMeta=document.getElementById('theme-color-meta');
function setThemeColor(c){
  if(!themeMeta)return;
  const theme=localStorage.getItem('fabhub-theme')||'system';
  const isDark=theme==='system'?window.matchMedia('(prefers-color-scheme:dark)').matches:theme==='dark';
  themeMeta.content=c||(isDark?'#0b1020':'#f4f6fb');
}
function getDark(url){return !!darkPrefs[url]}
function setDark(url,on){darkPrefs[url]=on;localStorage.setItem(LS_DARK,JSON.stringify(darkPrefs))}
function applyDark(t){if(t.frame)t.frame.style.filter=t.dark?'invert(1) hue-rotate(180deg)':'none'}
const cur=()=>tabs[ai]&&tabs[ai].app;
const gen=a=>`/api/icon?n=${enc(a.name)}&c=${enc(a.color||'#0f172a')}`;
function getDomain(u){try{return new URL(u).hostname.replace(/^www\./,'')}catch{return ''}}
function getFaviconUrl(u){const d=getDomain(u);return d?`/api/icon?domain=${encodeURIComponent(d)}`:''}
const has=a=>mine.some(m=>m.url===a.url);
const installUrl=a=>a.id?`/a/${a.id}`:'/a/site?'+new URLSearchParams({u:a.url,n:a.name,c:a.color,i:a.icon||''});
const api=async p=>{try{const r=await fetch(p);if(!r.ok)return null;return r.json()}catch{return null}};
const urlLike=v=>/^(https?:\/\/)?[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(v);
function resolveIcon(a){if(a.icon)return a.icon;const cached=iconCache[a.url];if(cached)return cached;const fav=getFaviconUrl(a.url);if(fav){iconCache[a.url]=fav;saveIconCache();return fav}return gen(a)}
function createIconEl(a){
  const i=document.createElement('img');
  i.src=resolveIcon(a);
  i.alt='';
  i.draggable=false;
  i.loading='lazy';
  i.width=60;
  i.height=60;
  i.onerror=()=>{i.onerror=null;i.src=gen(a);i.classList.add('fallback')};
  return i;
}
function updateTileIcon(tileEl, app){
  const img=tileEl.querySelector('img');
  if(img){
    const newSrc=resolveIcon(app);
    if(img.src!==newSrc){
      img.src=newSrc;
      img.classList.remove('fallback');
      img.onerror=()=>{img.onerror=null;img.src=gen(app);img.classList.add('fallback')};
    }
  }
}
function notice(msg){const n=$('#notice');if(n)n.remove();const d=document.createElement('p');d.id='notice';d.className='notice';d.textContent=msg;$('#homeSearchResults').prepend(d)}

/* ---- reorder (press and hold, then drag) ---- */
const rects=()=>new Map([...$$('.page:not([hidden]) .app-tile')].map(c=>[c,c.getBoundingClientRect()]));
function flip(f){for(const [c,r] of f){const n=c.getBoundingClientRect(),dx=r.left-n.left,dy=r.top-n.top;if(dx||dy)c.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:200,easing:'ease'})}}
let wakeLock=null;
async function requestWakeLock(){
  if(!('wakeLock' in navigator))return;
  try{wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null})}catch{}
}
function releaseWakeLock(){if(wakeLock){wakeLock.release();wakeLock=null}}

function startDrag(el){
  el.classList.add('drag');
  const pageEl=el.closest('.page');
  let targetTile=null;
  const mv=e=>{
    const t=document.elementFromPoint(e.clientX,e.clientY)?.closest('.app-tile');
    if(t&&t!==el&&t.closest('.page')===pageEl){
      targetTile=t;
      t.classList.add('drag-over');
    }else if(targetTile){
      targetTile.classList.remove('drag-over');
      targetTile=null;
    }
    if(targetTile){const f=rects();const k=[...pageEl.children];if(k.indexOf(targetTile)>k.indexOf(el))pageEl.insertBefore(targetTile,el);else pageEl.insertBefore(targetTile,el.nextSibling);flip(f)}
  };
  const up=()=>{
    removeEventListener('pointermove',mv);
    removeEventListener('pointerup',up);
    removeEventListener('pointercancel',up);
    el.classList.remove('drag');
    if(targetTile){
      targetTile.classList.remove('drag-over');
      const url1=el.dataset.url;
      const url2=targetTile.dataset.url;
      if(url1!==url2 && !folders[url1] && !folders[url2] && !mine.find(m=>m.url===url1)?.folder && !mine.find(m=>m.url===url2)?.folder){
        createFolder(url1,url2);
      }
    }
    savePageOrder(pageEl)
  };
  addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);
}
function savePageOrder(pageEl){
  const urls=[...pageEl.children].map(c=>c.dataset.url).filter(Boolean);
  const pageIdx=[...$$('.page')].indexOf(pageEl);
  if(pageIdx<0)return;
  let start=pageIdx*iconsPerPage();
  mine=mine.filter((_,i)=>i<start||i>=start+urls.length);
  urls.forEach((url,i)=>{const app=mine.find(m=>m.url===url);if(app)mine.splice(start+i,0,app)});
  save();
  renderPages();
}

/* ---- Tile rendering ---- */
let iconsPerPage=()=>{const w=window.innerWidth;if(w<400)return 16;if(w<600)return 20;if(w<900)return 24;if(w<1200)return 28;return 32};
function tile(a,m,inTrash){
  const d=document.createElement('div');
  const isFolder=a.folder && folders[a.url];
  d.className='app-tile'+(isFolder?' folder':'');
  d.dataset.url=a.url;
  d.tabIndex=0;
  const iconEl=createIconEl(a);
  if(isFolder){
    const preview=document.createElement('div');
    preview.className='folder-preview';
    const apps=folders[a.url]||[];
    apps.slice(0,4).forEach(u=>{
      const app=mine.find(m=>m.url===u);
      if(app){
        const img=document.createElement('img');
        img.src=resolveIcon(app);
        img.alt='';
        preview.append(img);
      }
    });
    iconEl.append(preview);
  }
  d.append(iconEl);
  const s=document.createElement('span');
  s.textContent=a.name;
  d.append(s);
  if(!inTrash){
    const del=document.createElement('button');
    del.className='delete-btn';
    del.innerHTML='×';
    del.onclick=e=>{e.stopPropagation();e.preventDefault();moveToTrash(a.url)};
    d.append(del);
  }
  if(inTrash){
    d.onclick=()=>{};
  }else if(isFolder){
    d.onclick=()=>openFolder(a.url);
  }else{
    d.onclick=()=>{if(editing){openEditDialog(a.url);return}if(suppress){suppress=false;return}open(a)};
    d.oncontextmenu=e=>{e.preventDefault();openAppSettings(a.url)};
  }
  let t,sx,sy;
  d.onpointerdown=e=>{if(editing)return startDrag(d);sx=e.clientX;sy=e.clientY;t=setTimeout(()=>{suppress=true;edit(true)},500)};
  d.onpointermove=e=>{if(Math.hypot(e.clientX-sx,e.clientY-sy)>8)clearTimeout(t)};
  d.onpointerup=d.onpointercancel=()=>{clearTimeout(t);if(suppress)setTimeout(()=>suppress=false,50)};
  return d;
}
function moveToTrash(url){const i=mine.findIndex(m=>m.url===url);if(i===-1)return;const [a]=mine.splice(i,1);a.ts=Date.now();trash.unshift(a);save();saveTrash();renderPages();renderTrash();renderPinned();renderRecents();toast('Moved to Trash')}
function restoreFromTrash(url){const i=trash.findIndex(t=>t.url===url);if(i===-1)return;const [a]=trash.splice(i,1);delete a.ts;mine.push(a);save();saveTrash();renderPages();renderTrash();renderPinned();renderRecents();toast('Restored from Trash')}
function deleteForever(url){const i=trash.findIndex(t=>t.url===url);if(i===-1)return;trash.splice(i,1);saveTrash();renderTrash();toast('Deleted forever')}

/* ---- Pinned Apps ---- */
function togglePinned(url){
  const i=pinned.indexOf(url);
  if(i>=0){pinned.splice(i,1);toast('Unpinned')}else{pinned.unshift(url);if(pinned.length>8)pinned.pop();toast('Pinned')}
  savePinned();renderPinned();
}
function renderPinned(){
  const el=$('#pinnedGrid');
  if(!el)return;
  const pinnedApps=pinned.map(u=>mine.find(m=>m.url===u)).filter(Boolean);
  if(!pinnedApps.length){$('#pinnedSection')?.classList.add('hidden');return}
  $('#pinnedSection')?.classList.remove('hidden');
  fill(el,pinnedApps,true);
  el.querySelectorAll('.app-tile').forEach(tileEl=>{
    const url=tileEl.dataset.url;
    if(!tileEl.querySelector('.unpin-btn')){
      const btn=document.createElement('button');
      btn.className='unpin-btn';
      btn.innerHTML='×';
      btn.onclick=e=>{e.stopPropagation();e.preventDefault();togglePinned(url)};
      tileEl.style.position='relative';
      tileEl.append(btn);
    }
  });
}

/* ---- Recents Row ---- */
function renderRecents(){
  const el=$('#recentsGrid');
  if(!el)return;
  const recentApps=recents.slice(0,10).map(r=>mine.find(m=>m.url===r.url)).filter(Boolean);
  if(!recentApps.length){$('#recentsSection')?.classList.add('hidden');return}
  $('#recentsSection')?.classList.remove('hidden');
  fill(el,recentApps,true);
}

/* ---- Folders ---- */
function openFolder(url){
  const folder=folders[url];
  if(!folder||!folder.length)return;
  const dialog=document.createElement('dialog');
  dialog.className='folder-dialog';
  dialog.innerHTML=`
    <form method="dialog">
      <header class="dialog-header">
        <h3 class="folder-title">${mine.find(m=>m.url===url)?.name||'Folder'}</h3>
        <button value="cancel" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </header>
      <div class="dialog-body">
        <div class="folder-apps">${folder.map(u=>{
          const app=mine.find(m=>m.url===u);
          if(!app)return '';
          return `<div class="folder-app" data-url="${u}"><img src="${resolveIcon(app)}" alt="" onerror="this.onerror=null;this.src='${gen(app)}'"><span>${app.name}</span><button aria-label="Remove from folder">×</button></div>`;
        }).join('')}</div>
      </div>
    </form>
  `;
  dialog.querySelectorAll('.folder-app button').forEach(btn=>{
    btn.onclick=e=>{e.stopPropagation();e.preventDefault();removeFromFolder(url,btn.closest('.folder-app').dataset.url);dialog.close();openFolder(url)};
  });
  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener('close',()=>dialog.remove());
}
function createFolder(url1,url2){
  const name=mine.find(m=>m.url===url1)?.name||'Folder';
  const folderUrl='folder:'+Date.now();
  folders[folderUrl]=[url1,url2];
  saveFolders();
  const folderApp={url:folderUrl,name,name:folderUrl,name:name,icon:'',color:'#0f172a',folder:true};
  mine.push(folderApp);
  mine=mine.filter(m=>m.url!==url1 && m.url!==url2);
  save();
  renderPages();
  toast('Folder created');
}
function removeFromFolder(folderUrl,appUrl){
  if(!folders[folderUrl])return;
  folders[folderUrl]=folders[folderUrl].filter(u=>u!==appUrl);
  if(folders[folderUrl].length<=1){
    const remaining=folders[folderUrl][0];
    delete folders[folderUrl];
    mine=mine.filter(m=>m.url!==folderUrl);
    if(remaining){
      const app=mine.find(m=>m.url===remaining);
      if(app)app.folder=false;
    }
  }
  saveFolders();save();renderPages();toast('Removed from folder');
}

/* ---- Quick-add paste ---- */
function initQuickAddPaste(){
  document.addEventListener('paste',async e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)return;
    if(editing||!$('#home')?.hidden)return;
    const text=e.clipboardData.getData('text').trim();
    if(urlLike(text)){
      e.preventDefault();
      openAddDialog(text);
    }
  });
}

const fill=(el,list,m,inTrash)=>{
  const existing=new Map([...el.children].map(c=>[c.dataset.url,c]));
  const frag=document.createDocumentFragment();
  (list||[]).filter(Boolean).forEach(a=>{
    let tileEl=existing.get(a.url);
    if(tileEl){
      existing.delete(a.url);
      tileEl.querySelector('span').textContent=a.name;
      updateTileIcon(tileEl,a);
    }else{
      tileEl=tile(a,m,inTrash);
    }
    frag.append(tileEl);
  });
  existing.forEach(t=>t.remove());
  el.replaceChildren(frag);
};

function renderPages(){
  const pagesEl=$('#pages');
  const perPage=iconsPerPage();
  const pageCount=Math.max(1,Math.ceil(mine.length/perPage));
  if(currentPage>=pageCount)currentPage=pageCount-1;
  pagesEl.innerHTML='';
  for(let p=0;p<pageCount;p++){
    const page=document.createElement('div');
    page.className='page';
    page.hidden=p!==currentPage;
    page.setAttribute('role','listitem');
    page.setAttribute('aria-label',`Page ${p+1} of ${pageCount}`);
    const start=p*perPage;
    const pageApps=mine.slice(start,start+perPage);
    fill(page,pageApps,true);
    pagesEl.append(page);
  }
  renderPageDots(pageCount);
  updateDockCurrent();
}
function renderPageDots(count){
  const dots=$('#pageDots');
  if(count<=1){dots.innerHTML='';return}
  dots.innerHTML='';
  for(let i=0;i<count;i++){
    const d=document.createElement('span');
    d.className='page-dot'+(i===currentPage?' active':'');
    dots.append(d);
  }
}
function goToPage(idx){
  const perPage=iconsPerPage();
  const pageCount=Math.max(1,Math.ceil(mine.length/perPage));
  if(idx<0||idx>=pageCount)return;
  currentPage=idx;
  $$('.page').forEach((p,i)=>p.hidden=i!==currentPage);
  renderPageDots(pageCount);
}
function nextPage(){goToPage(currentPage+1)}
function prevPage(){goToPage(currentPage-1)}

/* ---- Pull-down search ---- */
let pullStartY=0,pullActive=false;
function initPullSearch(){
  const pullEl=$('#pullSearch');
  const hint=pullEl.querySelector('.pull-search-hint');
  const bar=pullEl.querySelector('.pull-search-bar');
  const results=$('#homeSearchResults');
  const input=$('#homeSearch');
  const clearBtn=pullEl.querySelector('.clear-search');
  
  document.addEventListener('touchstart',e=>{
    if(window.scrollY>0||pullActive)return;
    pullStartY=e.touches[0].clientY;
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(pullActive)return;
    const dy=e.touches[0].clientY-pullStartY;
    if(dy>20){
      pullActive=true;
      pullEl.classList.add('active');
      input.focus();
    }
  },{passive:true});
  document.addEventListener('touchend',()=>{
    if(pullActive&&window.scrollY===0){
      pullActive=false;
      pullEl.classList.remove('active');
    }
  });
  
  input.addEventListener('input',()=>{
    clearBtn.hidden=!input.value;
    debouncedHomeSearch(input.value);
  });
  clearBtn.onclick=()=>{input.value='';clearBtn.hidden=true;results.innerHTML=''};
  pullEl.querySelector('.pull-search-content').addEventListener('click',e=>{if(e.target===pullEl.querySelector('.pull-search-content'))closePullSearch()});
}
function closePullSearch(){
  $('#pullSearch').classList.remove('active');
  pullActive=false;
  $('#homeSearch').value='';
  $('#homeSearchResults').innerHTML='';
  $('#homeSearch').blur();
}
async function debouncedHomeSearch(v){
  clearTimeout(timer);
  timer=setTimeout(async()=>{
    v=v.trim();
    const r=$('#homeSearchResults');
    if(!v){r.innerHTML='';return}
    r.innerHTML='<p class="loading">Searching…</p>';
    const q=v.toLowerCase();
    const mineResults=mine.filter(a=>!q||a.name.toLowerCase().includes(q)||a.url.toLowerCase().includes(q));
    const recentResults=recents.filter(a=>!q||a.name.toLowerCase().includes(q)||a.url.toLowerCase().includes(q));
    try{
      const res=await api('/api/search?q='+enc(v));
      if(res&&res.apps){res.apps.forEach(a=>{if(!mineResults.some(m=>m.url===a.url))mineResults.push(a)})}
      if(res&&res.web){res.web.forEach(w=>{if(!mineResults.some(m=>m.url===w.url))mineResults.push({name:w.title,url:w.url,icon:'',color:'#0f172a'})})}
    }catch{}
    r.innerHTML='';
    if(mineResults.length){
      const h=document.createElement('h3');h.textContent='Apps';r.append(h);
      mineResults.forEach(a=>r.append(createSearchResult(a)));
    }
    if(recentResults.length){
      const h=document.createElement('h3');h.textContent='Recents';r.append(h);
      recentResults.forEach(a=>r.append(createSearchResult(a)));
    }
    if(!mineResults.length&&!recentResults.length&&urlLike(v)){
      r.append(createSearchResult({name:'Open '+v,url:v,icon:'',color:'#0f172a',isAction:true}));
    }
    if(r.children.length===0){r.innerHTML='<p class="empty">No results</p>'}
  },200);
}
function createSearchResult(a){
  const el=document.createElement('div');
  el.className='search-result-item';
  const img=document.createElement('img');
  img.src=a.icon||resolveIcon(a);
  img.alt='';
  img.onerror=()=>{img.onerror=null;img.src=gen(a)};
  const span=document.createElement('span');
  span.textContent=a.name;
  el.append(img,span);
  el.onclick=()=>{closePullSearch();if(a.isAction){addSite(a.url)}else{open(a)}};
  return el;
}

/* ---- Dock ---- */
function initDock(){
  $$('.dock-item[data-dock]').forEach(btn=>{
    btn.onclick=()=>{
      const action=btn.dataset.dock;
      if(action==='home'){closeAppLibrary();closeTabSwitcher();closePullSearch()}
      else if(action==='add'){closeAppLibrary();closeTabSwitcher();closePullSearch();openAddDialog()}
      else if(action==='current'){const c=cur();if(c)open(c);else if(tabs.length)activate(Math.max(ai,0))}
      else if(action==='search'){closeAppLibrary();closeTabSwitcher();$('#pullSearch').classList.add('active');pullActive=true;$('#homeSearch').focus()}
      else if(action==='settings'){closeAppLibrary();closeTabSwitcher();closePullSearch();openSettings()}
    };
  });
}
function updateDockCurrent(){
  const c=cur();
  const dockCurrent=$('#dockCurrent');
  const iconEl=dockCurrent.querySelector('.dock-current-icon');
  if(!c){
    iconEl.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>';
    iconEl.classList.add('empty');
    dockCurrent.title='No app open';
  }else{
    iconEl.innerHTML='';
    iconEl.append(createIconEl(c));
    iconEl.classList.remove('empty');
    dockCurrent.title=c.name;
  }
  $$('.dock-item[data-dock]').forEach(b=>b.classList.remove('active'));
  const activeTab=document.querySelector('nav button.on')?.dataset.tab;
  if(activeTab){
    const btn=$(`[data-dock="${activeTab}"]`);
    if(btn)btn.classList.add('active');
  }
  if(tabs.length){
    const btn=$('[data-dock="current"]');
    if(btn)btn.classList.add('active');
  }
}

/* ---- App Library ---- */
function openAppLibrary(){
  $('#appLibrary').hidden=false;
  $('#librarySearch').value='';
  $('#trashSection').hidden=true;
  renderLibrary();
}
function closeAppLibrary(){
  $('#appLibrary').hidden=true;
  $('#trashSection').hidden=true;
}
function renderLibrary(){
  const el=$('#libraryContent');
  const q=$('#librarySearch').value.toLowerCase();
  const filtered=mine.filter(a=>!q||a.name.toLowerCase().includes(q)||a.url.toLowerCase().includes(q));
  const cats={Social:[],Work:[],Tools:[],School:[],Other:[]};
  const catKeywords={Social:['twitter','facebook','instagram','discord','slack','reddit','linkedin','messenger','whatsapp','telegram'],Work:['github','gitlab','jira','notion','linear','figma','vercel','netlify','aws','azure','gcp','docker','kubernetes'],Tools:['calculator','calendar','weather','maps','translate','drive','docs','sheets','slides','photos'],School:['coursera','udemy','khan','edx','duolingo','quizlet','canvas','blackboard','moodle']};
  filtered.forEach(app=>{
    let assigned=false;
    for(const [cat,keywords] of Object.entries(catKeywords)){
      if(keywords.some(k=>app.url.includes(k)||app.name.toLowerCase().includes(k))){
        cats[cat].push(app);assigned=true;break;
      }
    }
    if(!assigned)cats.Other.push(app);
  });
  let html='';
  for(const [cat,apps] of Object.entries(cats)){
    if(!apps.length)continue;
    html+=`<div class="library-category"><h2>${cat}</h2><div class="library-grid">${apps.map(a=>tileHtml(a)).join('')}</div></div>`;
  }
  if(!html){
    const az={};
    filtered.forEach(a=>{const l=(a.name[0]||'#').toUpperCase();if(!az[l])az[l]=[];az[l].push(a)});
    for(const [letter,apps] of Object.entries(az).sort()){
      html+=`<div class="az-letter">${letter}</div><div class="az-list">${apps.map(a=>tileHtml(a)).join('')}</div>`;
    }
  }
  el.innerHTML=html||'<p class="empty">No apps yet. Tap + to add one.</p>';
  el.querySelectorAll('.app-tile').forEach(t=>{t.onclick=()=>{closeAppLibrary();open({url:t.dataset.url,name:t.querySelector('span').textContent,icon:t.querySelector('img').src,color:'#0f172a'})}});
  
  // Trash button handler
  $('#libraryTrashBtn').onclick=()=>{
    $('#libraryContent').hidden=true;
    $('#librarySearch').hidden=true;
    $('#trashSection').hidden=false;
    renderTrash();
  };
}

/* ---- Trash (in App Library) ---- */
function renderTrash(){
  const grid=$('#trashGrid');
  const empty=$('#trashEmpty');
  const purgeBtn=$('#purgeAll');
  fill(grid,trash,true,true);
  empty.hidden=trash.length>0;
  purgeBtn.hidden=trash.length===0;
  purgeBtn.onclick=()=>{if(confirm('Permanently delete all items in Trash?')){trash=[];saveTrash();renderTrash();toast('Trash emptied')}};
}
function tileHtml(a){
  return `<div class="app-tile" data-url="${a.url}" tabindex="0">${iconHtml(a)}<span>${esc(a.name)}</span></div>`;
}
function iconHtml(a){
  const src=resolveIcon(a);
  return `<img src="${esc(src)}" alt="" width="60" height="60" loading="lazy" onerror="this.onerror=null;this.src='${esc(gen(a))}';this.classList.add('fallback')">`;
}
function esc(s){return String(s??'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/\"/g,'"').replace(/'/g,''')}

/* ---- Fullscreen Viewer (Part 2) ---- */
const VIEWER_HANDLE_LS='fabhub.viewerHandle';
let viewerHandleDrag=false,viewerToolbarVisible=false,viewerFullscreen=false,viewerHideTimer=null,viewerIdleTimer=null,viewerSuspendTimers={};
const VIEWER_IDLE_MS=5*60*1000; // 5 minutes

function getViewerHandlePos(){
  try{return JSON.parse(localStorage.getItem(VIEWER_HANDLE_LS)||'{}')}catch{return {}}
}
function saveViewerHandlePos(pos){
  localStorage.setItem(VIEWER_HANDLE_LS,JSON.stringify(pos))
}
function applyViewerHandlePos(){
  const pos=getViewerHandlePos();
  const handle=$('#viewerHandle');
  if(!handle)return;
  handle.classList.remove('pos-left','pos-right','pos-top','pos-bottom');
  const position=pos.position||'right';
  handle.classList.add('pos-'+position);
  if(pos.x!==undefined&&pos.y!==undefined){
    handle.style.left=pos.x+'px';
    handle.style.top=pos.y+'px';
    handle.style.transform='none';
  }
}

function initViewer(){
  const handle=$('#viewerHandle');
  const toolbar=$('#viewerToolbar');
  const centerInfo=$('#viewerCenterInfo');
  
  applyViewerHandlePos();
  
  // Handle drag
  let dragStartX=0,dragStartY=0,handleStartX=0,handleStartY=0;
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    viewerHandleDrag=true;
    handle.setPointerCapture(e.pointerId);
    dragStartX=e.clientX;
    dragStartY=e.clientY;
    const rect=handle.getBoundingClientRect();
    handleStartX=rect.left;
    handleStartY=rect.top;
    handle.classList.add('dragging');
    e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{
    if(!viewerHandleDrag)return;
    const dx=e.clientX-dragStartX;
    const dy=e.clientY-dragStartY;
    const newX=handleStartX+dx;
    const newY=handleStartY+dy;
    handle.style.left=newX+'px';
    handle.style.top=newY+'px';
    handle.style.transform='none';
    handle.classList.remove('pos-left','pos-right','pos-top','pos-bottom');
  });
  handle.addEventListener('pointerup',e=>{
    if(!viewerHandleDrag)return;
    viewerHandleDrag=false;
    handle.releasePointerCapture(e.pointerId);
    handle.classList.remove('dragging');
    snapHandleToEdge(handle);
    showViewerToolbar();
  });
  handle.addEventListener('pointercancel',()=>{
    viewerHandleDrag=false;
    handle.classList.remove('dragging');
  });
  handle.addEventListener('click',e=>{
    if(Math.abs(e.clientX-dragStartX)>5||Math.abs(e.clientY-dragStartY)>5)return;
    toggleViewerToolbar();
  });
  handle.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleViewerToolbar()}
  });
  
  // Toolbar buttons
  $('#vHome').onclick=()=>{closeViewer();closeTabSwitcher();closePullSearch();closeAppLibrary()};
  $('#vBack').onclick=()=>{const f=tabs[ai]?.frame;if(f&&f.contentWindow){try{f.contentWindow.history.back()}catch{}}updateForwardButton()};
  $('#vForward').onclick=()=>{const f=tabs[ai]?.frame;if(f&&f.contentWindow){try{f.contentWindow.history.forward()}catch{}}updateForwardButton()};
  $('#vReload').onclick=()=>{const f=tabs[ai]?.frame;if(f)f.src=f.src};
  $('#vTabs').onclick=()=>{hideViewerToolbar();openTabSwitcher()};
  $('#vFullscreen').onclick=toggleFullscreen;
  $('#vNewTab').onclick=()=>{const c=cur();if(c)window.open(c.url,'_blank','noopener')};
  $('#vCopyLink').onclick=async()=>{const c=cur();if(c){try{await navigator.clipboard.writeText(c.url);toast('Link copied')}catch{toast('Failed to copy','error')}}};
  $('#vClose').onclick=closeViewer;
  
  $('#bOpen').onclick=()=>cur()&&window.open(cur().url,'_blank','noopener');
  $('#bInstall').onclick=()=>{const t=tabs[ai];if(t)window.open(installUrl(t.app),'_blank')};
  $('#bAddAnyway').onclick=()=>{const t=tabs[ai];if(t&&!has(t.app)){mine.push(t.app);save();renderPages()}closeBlocked();if(t){const f=document.createElement('iframe');f.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads';f.src=t.app.url;$('#frames').append(f);t.frame=f;applyDark(t);activate(tabs.indexOf(t))}};
  
  // Click outside to hide toolbar
  document.addEventListener('click',e=>{
    if(viewerToolbarVisible&&!toolbar.contains(e.target)&&!handle.contains(e.target)&&!centerInfo.contains(e.target)){
      hideViewerToolbar();
    }
  });
  
  // Fullscreen change event
  document.addEventListener('fullscreenchange',onFullscreenChange);
  
  // Keyboard shortcuts for viewer
  document.addEventListener('keydown',onViewerKeydown);
}

function snapHandleToEdge(handle){
  const rect=handle.getBoundingClientRect();
  const vw=window.innerWidth;
  const vh=window.innerHeight;
  const centerX=rect.left+rect.width/2;
  const centerY=rect.top+rect.height/2;
  const distLeft=centerX;
  const distRight=vw-centerX;
  const distTop=centerY;
  const distBottom=vh-centerY;
  const minDist=Math.min(distLeft,distRight,distTop,distBottom);
  let position='right';
  let x=rect.left,y=rect.top;
  if(minDist===distLeft){
    position='left';
    x=0;
    y=Math.max(envSafeTop(),Math.min(vh-rect.height,centerY-rect.height/2));
  }else if(minDist===distRight){
    position='right';
    x=vw-rect.width;
    y=Math.max(envSafeTop(),Math.min(vh-rect.height,centerY-rect.height/2));
  }else if(minDist===distTop){
    position='top';
    x=Math.max(envSafeLeft(),Math.min(vw-rect.width,centerX-rect.width/2));
    y=0;
  }else{
    position='bottom';
    x=Math.max(envSafeLeft(),Math.min(vw-rect.width,centerX-rect.width/2));
    y=vh-rect.height-80; // above dock
  }
  handle.style.left=x+'px';
  handle.style.top=y+'px';
  handle.style.transform='none';
  handle.classList.remove('pos-left','pos-right','pos-top','pos-bottom');
  handle.classList.add('pos-'+position);
  saveViewerHandlePos({position,x,y});
}

function envSafeTop(){return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat-top')||'0')||0}
function envSafeLeft(){return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat-left')||'0')||0}
function envSafeRight(){return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat-right')||'0')||0}
function envSafeBottom(){return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat-bottom')||'0')||0}

function showViewerToolbar(){
  const toolbar=$('#viewerToolbar');
  const handle=$('#viewerHandle');
  const centerInfo=$('#viewerCenterInfo');
  if(!toolbar)return;
  toolbar.hidden=false;
  toolbar.classList.add('visible');
  handle.classList.add('expanded');
  handle.classList.remove('collapsed');
  handle.setAttribute('aria-expanded','true');
  centerInfo.classList.add('hidden');
  viewerToolbarVisible=true;
  clearTimeout(viewerHideTimer);
  viewerHideTimer=setTimeout(hideViewerToolbar,3000);
  updateForwardButton();
}

function hideViewerToolbar(){
  const toolbar=$('#viewerToolbar');
  const handle=$('#viewerHandle');
  const centerInfo=$('#viewerCenterInfo');
  if(!toolbar)return;
  toolbar.classList.remove('visible');
  handle.classList.remove('expanded');
  handle.classList.add('collapsed');
  handle.setAttribute('aria-expanded','false');
  centerInfo.classList.remove('hidden');
  viewerToolbarVisible=false;
  clearTimeout(viewerHideTimer);
  setTimeout(()=>{if(!viewerToolbarVisible)toolbar.hidden=true},300);
}

function toggleViewerToolbar(){
  if(viewerToolbarVisible)hideViewerToolbar();else showViewerToolbar();
}

function updateForwardButton(){
  const btn=$('#vForward');
  const f=tabs[ai]?.frame;
  // Can't reliably detect forward availability in cross-origin iframes
  // Enable if we have a frame (best effort)
  if(btn&&f)btn.disabled=false;else if(btn)btn.disabled=true;
}

async function toggleFullscreen(){
  const viewer=$('#viewer');
  if(!viewer)return;
  if(!document.fullscreenElement){
    try{
      await viewer.requestFullscreen({navigationUI:'hide'});
      viewer.classList.add('fullscreen-api');
      viewerFullscreen=true;
      $('#vFullscreen').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/><line x1="4" y1="21" x2="20" y2="21"/><line x1="4" y1="3" x2="20" y2="3"/><line x1="3" y1="4" x2="3" y2="20"/><line x1="21" y1="4" x2="21" y2="20"/></svg>';
      $('#vFullscreen').title='Exit fullscreen';
      $('#vFullscreen').setAttribute('aria-label','Exit fullscreen');
      hideViewerToolbar();
    }catch(e){
      // Fallback to pseudo-fullscreen (already default)
      console.log('Fullscreen API not available:',e);
    }
  }else{
    try{
      await document.exitFullscreen();
    }catch(e){
      console.log('Exit fullscreen failed:',e);
    }
  }
}

function onFullscreenChange(){
  const viewer=$('#viewer');
  if(!viewer)return;
  if(document.fullscreenElement===viewer){
    viewer.classList.add('fullscreen-api');
    viewerFullscreen=true;
    $('#vFullscreen').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/><line x1="4" y1="21" x2="20" y2="21"/><line x1="4" y1="3" x2="20" y2="3"/><line x1="3" y1="4" x2="3" y2="20"/><line x1="21" y1="4" x2="21" y2="20"/></svg>';
    $('#vFullscreen').title='Exit fullscreen';
    $('#vFullscreen').setAttribute('aria-label','Exit fullscreen');
    hideViewerToolbar();
  }else{
    viewer.classList.remove('fullscreen-api');
    viewerFullscreen=false;
    $('#vFullscreen').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    $('#vFullscreen').title='Fullscreen';
    $('#vFullscreen').setAttribute('aria-label','Fullscreen');
  }
}

function onViewerKeydown(e){
  if($('#viewer').hidden)return;
  // Don't intercept if typing in input
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)return;
  
  if(e.key==='Escape'){
    e.preventDefault();
    if(viewerToolbarVisible){hideViewerToolbar();return}
    if(!$('#tabSwitcher').hidden){closeTabSwitcher();return}
    closeViewer();
  }else if(e.key==='w'&&(e.ctrlKey||e.metaKey)){
    e.preventDefault();
    if(tabs.length)closeTab(ai);
  }else if(e.key==='Tab'&&e.ctrlKey){
    e.preventDefault();
    if(tabs.length>1){
      const next=e.shiftKey?ai-1:ai+1;
      activate((next+tabs.length)%tabs.length);
    }
  }else if(e.key==='f'||e.key==='F'){
    e.preventDefault();
    toggleFullscreen();
  }else if(e.key==='?'){
    e.preventDefault();
    $('#shortcutsOverlay').hidden=false;
  }else if(e.key==='ArrowLeft'){
    e.preventDefault();
    $('#vBack').click();
  }else if(e.key==='ArrowRight'){
    e.preventDefault();
    $('#vForward').click();
  }else if(e.key==='r'||e.key==='R'){
    e.preventDefault();
    $('#vReload').click();
  }else if(e.key==='t'||e.key==='T'){
    e.preventDefault();
    openTabSwitcher();
  }
}

function openViewer(){
  const viewer=$('#viewer');
  viewer.hidden=false;
  document.body.classList.add('viewer-open');
  document.body.style.top=-window.scrollY+'px';
  showViewerToolbar();
  applyViewerHandlePos();
  // Enter pseudo-fullscreen on mobile (iOS Safari)
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.MSStream){
    viewer.style.width='100vw';
    viewer.style.height='100dvh';
    viewer.style.maxWidth='100vw';
    viewer.style.maxHeight='100dvh';
  }
  startIdleTimer();
}

function closeViewer(){
  const viewer=$('#viewer');
  viewer.hidden=true;
  document.body.classList.remove('viewer-open');
  const scrollY=-parseInt(document.body.style.top||'0');
  document.body.style.top='';
  window.scrollTo(0,scrollY);
  hideViewerToolbar();
  setThemeColor(DEFAULT_THEME);
  clearIdleTimer();
  clearSuspendTimers();
}

function startIdleTimer(){
  clearIdleTimer();
  viewerIdleTimer=setTimeout(suspendAllTabs,VIEWER_IDLE_MS);
}

function clearIdleTimer(){
  if(viewerIdleTimer){clearTimeout(viewerIdleTimer);viewerIdleTimer=null}
}

function resetIdleTimer(){
  if(!$('#viewer').hidden){
    clearIdleTimer();
    startIdleTimer();
    resumeAllTabs();
  }
}

function suspendAllTabs(){
  tabs.forEach((t,i)=>{
    if(i!==ai&&t.frame&&!viewerSuspendTimers[i]){
      viewerSuspendTimers[i]=setTimeout(()=>{
        suspendTab(i);
      },1000);
    }
  });
}

function suspendTab(index){
  const t=tabs[index];
  if(t&&t.frame){
    t.suspended=true;
    t.frame.hidden=true;
    // Save memory by removing iframe src (but keep reference for restore)
    t.suspendedSrc=t.frame.src;
    t.frame.removeAttribute('src');
    renderTabSwitcher();
  }
}

function resumeAllTabs(){
  tabs.forEach((t,i)=>{
    if(t.suspended){
      resumeTab(i);
    }
  });
}

function resumeTab(index){
  const t=tabs[index];
  if(t&&t.suspended){
    t.suspended=false;
    if(t.frame){
      t.frame.hidden=false;
      if(t.suspendedSrc){
        t.frame.src=t.suspendedSrc;
        t.suspendedSrc=null;
      }
    }
    clearTimeout(viewerSuspendTimers[index]);
    delete viewerSuspendTimers[index];
    renderTabSwitcher();
  }
}

function clearSuspendTimers(){
  Object.values(viewerSuspendTimers).forEach(clearTimeout);
  viewerSuspendTimers={};
}

/* ---- Tab Switcher ---- */
function openTabSwitcher(){
  $('#tabSwitcher').hidden=false;
  renderTabSwitcher();
  hideViewerToolbar();
}
function closeTabSwitcher(){$('#tabSwitcher').hidden=true}
function renderTabSwitcher(){
  const grid=$('#tabSwitcherGrid');
  grid.innerHTML='';
  tabs.forEach((t,i)=>{
    const card=document.createElement('div');
    card.className='tab-card'+(i===ai?' active':'')+(t.suspended?' suspended':'');
    card.dataset.index=i;
    const preview=document.createElement('div');
    preview.className='tab-card-preview';
    const img=document.createElement('img');
    img.src=t.app.icon||resolveIcon(t.app);
    img.alt='';
    img.loading='lazy';
    preview.append(img);
    const info=document.createElement('div');
    info.className='tab-card-info';
    const title=document.createElement('span');
    title.className='tab-card-title';
    title.textContent=t.app.name;
    const close=document.createElement('button');
    close.className='tab-card-close';
    close.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    close.setAttribute('aria-label','Close tab');
    close.onclick=e=>{e.stopPropagation();closeTab(i);renderTabSwitcher()};
    info.append(title,close);
    card.append(preview,info);
    card.onclick=()=>{closeTabSwitcher();activate(i)};
    card.setAttribute('tabindex','0');
    card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();closeTabSwitcher();activate(i)}};
    grid.append(card);
  });
}

/* ---- Tabs ---- */
function renderTabs(){
  // New design uses dock current button and tab switcher instead of tab bar
  // updateDockCurrent() is called from activate() to update the dock
}
function activate(i){
  ai=i;
  const t=tabs[i];
  $('#viewer').hidden=false;
  tabs.forEach((z,zi)=>{
    if(z.frame){
      z.frame.hidden=zi!==i;
      if(zi===i)resumeTab(zi);
    }
  });
  $('#blocked').hidden=!t.blocked;
  t.dark=getDark(t.app.url);
  applyDark(t);
  $('#vName').textContent=t.app.name;
  $('#vUrl').textContent=new URL(t.app.url).hostname;
  saveSession();
  setThemeColor(t.app.color||DEFAULT_THEME);
  updateDockCurrent();
  openViewer();
  // Push state for back button handling
  history.pushState({viewer:true,tabIndex:i},'',location.href);
}
function closeTab(i){
  const [t]=tabs.splice(i,1);
  if(t.settings?.wakeLock)releaseWakeLock();
  t.frame&&t.frame.remove();
  hideOffline(t);
  clearTimeout(viewerSuspendTimers[i]);
  delete viewerSuspendTimers[i];
  if(!tabs.length){ai=-1;$('#viewer').hidden=true;document.body.classList.remove('viewer-open');setThemeColor(DEFAULT_THEME);saveSession();closeViewer();return}
  if(i<ai)ai--;else if(i===ai)ai=Math.min(ai,tabs.length-1);
  activate(ai);
}

/* ---- History / Back Button ---- */
window.addEventListener('popstate',e=>{
  if(e.state&&e.state.viewer){
    // Viewer was open, check if we should close it or switch tabs
    if(e.state.tabIndex!==undefined&&tabs[e.state.tabIndex]){
      activate(e.state.tabIndex);
    }else{
      closeViewer();
    }
  }else if(!e.state||!e.state.viewer){
    // Navigated away from viewer
    if(!$('#viewer').hidden){
      closeViewer();
    }
  }
});

/* ---- Interaction listeners to reset idle timer ---- */
document.addEventListener('pointerdown',resetIdleTimer,{passive:true});
document.addEventListener('keydown',resetIdleTimer,{passive:true});
document.addEventListener('scroll',resetIdleTimer,{passive:true});
async function open(a){
  if(!a||!a.url)return;
  addRecent(a);
  let i=tabs.findIndex(t=>t.app.url===a.url);
  if(i>=0)return activate(i);
  const s=appSettings[a.url]||{};
  const t={app:a,frame:null,blocked:false,offline:false,dark:getDark(a.url),settings:s};
  tabs.push(t);
  activate(tabs.length-1);
  const j=await api('/api/frameable?url='+enc(a.url)).catch(()=>({ok:false,reason:'fetch failed'}));
  if(!j||!tabs.includes(t))return;
  if(j.ok){
    const f=document.createElement('iframe');
    f.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads';
    f.src=a.url;
    f.hidden=tabs[ai]!==t;
    f.onerror=()=>{if(!t.offline){t.offline=true;showOffline(t,a.url)}};
    f.onload=()=>{t.offline=false;hideOffline(t);if(s.fullscreen&&document.fullscreenElement!==f){try{f.requestFullscreen()}catch{}}};
    t.frame=f;
    $('#frames').append(f);
    applyDark(t);
    if(s.wakeLock)requestWakeLock();
  }else{
    t.blocked=true;
    t.blockReason=j.reason||'This site does not allow embedding';
    if(!blockedSites.includes(a.url)){blockedSites.push(a.url);saveBlocked()}
    showBlocked(t);
  }
  saveSession();
}
function showBlocked(t){const b=$('#blocked');$('#blockedReason').textContent=t.blockReason;b.hidden=false}
function hideBlocked(){$('#blocked').hidden=true}
function closeBlocked(){hideBlocked();closeTab(ai)}
function showOffline(t,url){const o=document.createElement('div');o.id='offline-'+tabs.indexOf(t);o.innerHTML=`<div style="display:grid;place-content:center;height:100%;padding:24px;text-align:center"><h1>Unable to load</h1><p style="color:var(--mut);margin:12px 0">This site can't be shown here.</p><button class="primary" onclick="location.href='/offline.html?url=${encodeURIComponent(url)}'">Open offline page</button><button style="margin-top:12px" onclick="window.open('${url.replace(/'/g,"\\'")}','_blank','noopener')">Open in new tab</button></div>`;o.style.cssText='position:absolute;inset:0;background:var(--bg);z-index:5';$('#frames').append(o);t.offlineEl=o}
function hideOffline(t){if(t.offlineEl){t.offlineEl.remove();t.offlineEl=null}}

/* ---- Add App Dialog ---- */
let addDialogApp=null;
function openAddDialog(prefillUrl=''){
  $('#addDialog').showModal();
  $('#addStep1').hidden=false;
  $('#addStep2').hidden=true;
  $('#addUrl').value=prefillUrl;
  $('#addUrl').focus();
}
function closeAddDialog(){$('#addDialog').close();addDialogApp=null;$('#addUrl').value='';$('#addIconFile').value='';$('#addIconUrl').value='';$('#addColor').value='#0f172a'}
$('#addFetch').onclick=async()=>{
  const u=$('#addUrl').value.trim();
  if(!u||!urlLike(u)){alert('Enter a valid URL');return}
  const a=await api('/api/meta?url='+enc(u));
  if(!a||a.error){alert('Could not load that site.');return}
  addDialogApp=a;
  $('#addStep1').hidden=true;
  $('#addStep2').hidden=false;
  $('#addName').value=a.name;
  $('#addIconUrl').value=a.icon||'';
  $('#addColor').value=a.color||'#0f172a';
  renderPreviewTile('#previewTile',a);
};
$('#addBack').onclick=()=>{$('#addStep1').hidden=false;$('#addStep2').hidden=true};
$('#addIconFile').onchange=async e=>{const f=e.target.files[0];if(f){const data=await dataUrlFromFile(f);$('#addIconUrl').value=data;$('#addIconFile').value=''}};
$('#addDialog').addEventListener('close',()=>{if($('#addDialog').returnValue==='default'&&addDialogApp){const a=addDialogApp;a.name=$('#addName').value.trim()||a.name;const iconUrl=$('#addIconUrl').value.trim();a.icon=iconUrl||undefined;a.color=$('#addColor').value||'#0f172a';mine.push(a);save();renderPages();toast('App added')}});
function renderPreviewTile(sel,a){
  const el=$(sel);
  el.innerHTML='';
  const tile=document.createElement('div');
  tile.className='app-tile';
  tile.append(createIconEl(a));
  const s=document.createElement('span');
  s.textContent=a.name;
  tile.append(s);
  el.append(tile);
}

/* ---- Edit Dialog ---- */
let editDialogUrl=null;
function openEditDialog(url){
  const a=mine.find(m=>m.url===url);
  if(!a)return;
  editDialogUrl=url;
  $('#editDialog').showModal();
  $('#editAppUrl').value=url;
  $('#editName').value=a.name;
  $('#editIconUrl').value=a.icon||'';
  $('#editColor').value=a.color||'#0f172a';
  renderPreviewTile('#editPreviewTile',a);
}
function closeEditDialog(){$('#editDialog').close();editDialogUrl=null;$('#editIconFile').value='';$('#editIconUrl').value='';$('#editColor').value='#0f172a'}
$('#editIconFile').onchange=async e=>{const f=e.target.files[0];if(f){const data=await dataUrlFromFile(f);$('#editIconUrl').value=data;$('#editIconFile').value=''}};
$('#editReset').onclick=async()=>{if(!editDialogUrl)return;try{const a=await api('/api/meta?url='+enc(editDialogUrl));if(a.icon){$('#editIconUrl').value=a.icon;$('#editIconFile').value='';renderPreviewTile('#editPreviewTile',a)}}catch{}};
$('#editDelete').onclick=()=>{if(!editDialogUrl)return;moveToTrash(editDialogUrl);closeEditDialog()};
$('#editDialog').addEventListener('close',()=>{if($('#editDialog').returnValue==='default'&&editDialogUrl){const a=mine.find(m=>m.url===editDialogUrl);if(a){a.name=$('#editName').value.trim()||a.name;const iconUrl=$('#editIconUrl').value.trim();a.icon=iconUrl||undefined;a.color=$('#editColor').value||'#0f172a';save();renderPages();toast('App updated')}}editDialogUrl=null});

/* ---- App Settings Dialog ---- */
let appSettingsUrl=null;
function openAppSettings(url){
  const a=mine.find(m=>m.url===url);
  if(!a)return;
  appSettingsUrl=url;
  const s=appSettings[url]||{};
  $('#appSettingsDialog').showModal();
  $('#appSettingsTitle').textContent=a.name;
  $('#appSettingsUrl').value=url;
  $('#appSetFullscreen').checked=!!s.fullscreen;
  $('#appSetDark').checked=!!s.dark;
  $('#appSetWakeLock').checked=!!s.wakeLock;
  $('#appSetLock').checked=!!s.lock;
}
function closeAppSettingsDialog(){$('#appSettingsDialog').close();appSettingsUrl=null}
$('#appSettingsDialog').addEventListener('close',()=>{if($('#appSettingsDialog').returnValue==='default'&&appSettingsUrl){const s={fullscreen:$('#appSetFullscreen').checked,dark:$('#appSetDark').checked,wakeLock:$('#appSetWakeLock').checked,lock:$('#appSetLock').checked};appSettings[appSettingsUrl]=s;saveAppSettings();toast('Settings saved')}});
$('#appSetDelete').onclick=()=>{if(!appSettingsUrl)return;moveToTrash(appSettingsUrl);closeAppSettingsDialog()};

/* ---- Settings Dialog ---- */
function openSettings(){
  $('#settingsDialog').showModal();
  renderThemeOptions();
}
function closeSettingsDialog(){$('#settingsDialog').close()}
function renderThemeOptions(){
  const current=localStorage.getItem('fabhub-theme')||'system';
  $$('#themeOptions .theme-option').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.theme===current);
    btn.setAttribute('aria-pressed',btn.dataset.theme===current);
  });
}
$$('#themeOptions .theme-option').forEach(btn=>{
  btn.onclick=()=>{
    const next=btn.dataset.theme;
    localStorage.setItem('fabhub-theme',next);
    const root=document.documentElement;
    if(next==='system'){next=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}
    root.setAttribute('data-theme',next);
    themeMeta.content=next==='dark'?'#0b1020':'#f4f6fb';
    renderThemeOptions();
    toast(`Theme: ${btn.querySelector('span').textContent}`);
  };
});
$('#exportData').onclick=()=>{
  const data={apps:mine,trash,recents,settings:{theme:localStorage.getItem('fabhub-theme'),darkPrefs,appSettings}};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='fabhub-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Data exported');
};
$('#importData').onchange=async e=>{
  const f=e.target.files[0];
  if(!f)return;
  try{
    const text=await f.text();
    const data=JSON.parse(text);
    if(data.apps){mine=sanitize(data.apps);save()}
    if(data.trash){trash=sanitize(data.trash);saveTrash()}
    if(data.recents){recents=sanitize(data.recents);saveRecents()}
    if(data.settings){
      if(data.settings.theme){localStorage.setItem('fabhub-theme',data.settings.theme);const root=document.documentElement;let t=data.settings.theme;if(t==='system')t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';root.setAttribute('data-theme',t);themeMeta.content=t==='dark'?'#0b1020':'#f4f6fb'}
      if(data.settings.darkPrefs){darkPrefs=data.settings.darkPrefs;localStorage.setItem(LS_DARK,JSON.stringify(darkPrefs))}
      if(data.settings.appSettings){appSettings=data.settings.appSettings;saveAppSettings()}
    }
    renderPages();
    renderTrash();
    toast('Data imported');
  }catch{alert('Invalid file')}
  e.target.value='';
};
$('#clearData').onclick=()=>{
  if(confirm('Clear ALL data? This cannot be undone.')){
    localStorage.clear();
    mine=[];trash=[];recents=[];tabs=[];darkPrefs={};iconCache={};appSettings={};
    renderPages();renderTrash();closeSettingsDialog();
    toast('All data cleared');
  }
};

/* ---- Toast ---- */
function toast(msg,type='info'){
  const container=$('#toastContainer');
  const t=document.createElement('div');
  t.className='toast';
  const icons={success:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',error:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'};
  t.innerHTML=`<div class="toast-icon ${type}">${icons[type]}</div><span class="toast-message">${esc(msg)}</span><button class="toast-close" aria-label="Dismiss"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`;
  t.querySelector('.toast-close').onclick=()=>t.remove();
  container.append(t);
  setTimeout(()=>t.remove(),4000);
}

/* ---- Keyboard Shortcuts ---- */
function initShortcuts(){
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)return;
    if(e.key==='/'){e.preventDefault();$('#homeSearch')?.focus();$('#pullSearch')?.classList.add('active');pullActive=true}
    else if(e.key==='Escape'){closeAddDialog();closeEditDialog();closeAppSettingsDialog();closeSettingsDialog();closeTabSwitcher();closeViewer();closePullSearch();closeAppLibrary();edit(false)}
    else if(e.key==='?'){$('#shortcutsOverlay').hidden=false}
    else if(e.key==='n'||e.key==='N'){openAddDialog()}
    else if(e.key==='s'||e.key==='S'){$('#pullSearch')?.classList.add('active');pullActive=true;$('#homeSearch')?.focus()}
    else if(e.key===','){openSettings()}
    else if((e.key==='w'||e.key==='W')&&(e.ctrlKey||e.metaKey)){e.preventDefault();if(tabs.length)closeTab(ai)}
    else if(e.key==='Tab'&&(e.ctrlKey||e.metaKey)){e.preventDefault();if(tabs.length>1){const next=e.shiftKey?ai-1:ai+1;activate((next+tabs.length)%tabs.length)}}
    else if(e.key==='f'||e.key==='F'){e.preventDefault();toggleFullscreen()}
    else if(e.key==='ArrowLeft'&&!$('#viewer').hidden){e.preventDefault();$('#vBack').click()}
    else if(e.key==='ArrowRight'&&!$('#viewer').hidden){e.preventDefault();$('#vForward').click()}
    else if(e.key==='r'||e.key==='R'){e.preventDefault();$('#vReload').click()}
    else if(e.key==='t'||e.key==='T'){e.preventDefault();openTabSwitcher()}
    else if(e.key==='w'||e.key==='W'){if(tabs.length)closeTab(ai)}
  });
  $('#shortcutsClose').onclick=()=>$('#shortcutsOverlay').hidden=true;
  $('#shortcutsOverlay').onclick=e=>{if(e.target===e.currentTarget)$('#shortcutsOverlay').hidden=true};
}

/* ---- Data URL from file ---- */
function dataUrlFromFile(file,max=192){
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');let w=img.width,h=img.height;if(w>max||h>max){if(w>h){h=max*h/w;w=max}else{w=max*w/h;h=max}}c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);res(c.toDataURL('image/png'))};img.onerror=rej;img.src=r.result};r.onerror=rej;r.readAsDataURL(file)});
}

/* ---- Theme ---- */
const THEME_LS='fabhub-theme';
function applyTheme(t){
  const root=document.documentElement;
  const meta=document.getElementById('theme-color-meta');
  const activeTab=tabs[ai];
  const brandColor=activeTab?.app?.color;
  if(t==='system'){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}
  root.setAttribute('data-theme',t);
  if(meta){if(brandColor&&!$('#viewer').hidden){meta.content=brandColor}else{meta.content=t==='dark'?'#0b1020':'#f4f6fb'}}
}
function initTheme(){
  const saved=localStorage.getItem(THEME_LS)||'system';
  applyTheme(saved);
  const toggle=$('#themeToggle');
  if(toggle){toggle.onclick=()=>{const current=localStorage.getItem(THEME_LS)||'system';const next=current==='system'?'dark':current==='dark'?'light':'system';localStorage.setItem(THEME_LS,next);applyTheme(next)}}
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{if((localStorage.getItem(THEME_LS)||'system')==='system')applyTheme('system')});
}
initTheme();

/* ---- Share target ---- */
(function(){
  const u=new URL(location.href);
  const shared=u.searchParams.get('url')||u.searchParams.get('text');
  if(shared&&urlLike(shared)){
    history.replaceState(null,'','/app');
    setTimeout(()=>addSite(shared),500);
    return;
  }
  const tabParam=u.searchParams.get('tab');
  if(tabParam==='mine'){history.replaceState(null,'','/app');setTimeout(()=>openAppLibrary(),0)}
  else if(tabParam==='search'){history.replaceState(null,'','/app');$('#homeSearch')?.focus();$('#pullSearch').classList.add('active');pullActive=true}
  else if(tabParam==='library'){history.replaceState(null,'','/app');openAppLibrary()}
})();

/* ---- Init ---- */
renderPages();
renderPinned();
renderRecents();
restoreSession();
initDock();
initPullSearch();
initViewer();
initShortcuts();
initQuickAddPaste();
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js');
window.addEventListener('resize',()=>{renderPages()});