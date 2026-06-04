/* ============================================================
   core.js — الدوال الأساسية - API، Toast، Navigation، Init
   ============================================================ */


function $h(id,h){var el=document.getElementById(id);if(el)el.innerHTML=h;}
async function api(m,p,b){
  const o={method:m,headers:{'Content-Type':'application/json'}};
  if(TK)o.headers['Authorization']='Bearer '+TK;
  if(b)o.body=JSON.stringify(b);
  try{
    const ctrl=new AbortController();
    const tid=setTimeout(()=>ctrl.abort(),8000);
    o.signal=ctrl.signal;
    const r=await fetch(API+'/'+p,o);
    clearTimeout(tid);
    return await r.json();
  }catch(e){
    if(e.name==='AbortError')return{error:'انتهت مهلة الاتصال'};
    return{error:'خطأ في الاتصال: '+e.message};
  }
}

function toast(msg,t='ok'){
  const e=$g('toast');if(!e)return;
  e.textContent=msg;e.className='toast on '+t;
  clearTimeout(_tt);_tt=setTimeout(()=>e.className='toast',3000);
}

function ld(on){const e=$g('ld');if(e)e.className=on?'ld on':'ld';}

function oM(title,body){$h('mt',title);$h('mb',body);$g('md').className='modal-bg on';}

function cM(){$g('md').className='modal-bg';}

function confirmDel(msg){return confirm((msg||'هل تريد الحذف؟')+'\n\nلا يمكن التراجع.');}

function bdg(s){
  const m={pending:'badge-y معلق',reviewing:'badge-b قيد المراجعة',done:'badge-g مكتمل',
    rejected:'badge-r مرفوض',confirmed:'badge-b مؤكد',completed:'badge-g مكتمل',
    cancelled_admin:'badge-r ألغته الإدارة',cancelled_reviewer:'badge-y ألغاه المراجع',
    available:'badge-g متاح',locked:'badge-r مغلق',booked:'badge-b محجوز',
    open:'badge-g مفتوح',closed:'badge-r مغلق',draft:'badge-y مسودة',active:'badge-b منشور',
    text:'badge-b مقال',pdf:'badge-g PDF',admin:'badge-b مدير',reviewer:'badge-y مراجع',
    active_user:'badge-g نشط',banned:'badge-r محظور',archived:'badge-y مؤرشف'};
  const v=m[s]||(s?'badge-y '+s:'badge-y —');
  const[c,...w]=v.split(' ');
  return '<span class="bdg '+c+'">'+w.join(' ')+'</span>';
}

function tog(id,active,onch){
  return '<button id="'+id+'" class="tog" style="background:'+(active?'var(--blue)':'#cbd5e1')+'" data-v="'+(active?'1':'0')+'" onclick="('+onch+')(this)"><div class="tok" style="left:'+(active?'21px':'3px')+'"></div></button>';
}

function togFlip(b){
  const nv=b.dataset.v==='1'?'0':'1';
  b.dataset.v=nv;b.style.background=nv==='1'?'var(--blue)':'#cbd5e1';
  b.querySelector('.tok').style.left=nv==='1'?'21px':'3px';
}

function buildNav(navs,cid,fn,cur){
  const c=$g(cid);if(!c)return;
  const main=navs.slice(0,4),more=navs.slice(4);
  const inMore=more.some(n=>n.k===cur);
  let h='';
  main.forEach(n=>{
    h+='<button class="bn-item'+(cur===n.k?' on':'')+'" data-page="'+n.k+'" data-fn="'+fn+'"><span class="bn-lbl">'+n.l+'</span></button>';
  });
  if(more.length){
    h+='<button class="bn-item'+(inMore?' on':'')+'" id="mbtn-'+cid+'"><span class="bn-lbl">☰ المزيد</span></button>';
  }
  c.innerHTML=h;
  c.querySelectorAll('[data-page]').forEach(btn=>{
    btn.addEventListener('click',function(){
      const f=window[this.dataset.fn];if(typeof f==='function')f(this.dataset.page,this);
    });
  });
  const mb=document.getElementById('mbtn-'+cid);
  if(mb)mb.addEventListener('click',e=>{e.stopPropagation();showMoreMenu(cid,fn);});
}

function showMoreMenu(cid,fn){
  [$g('more-menu'),$g('more-ov')].forEach(el=>el&&el.remove());
  const navs=cid==='bnav'?ADM_NAVS:REV_NAVS;
  const more=navs.slice(4);if(!more.length)return;
  const ov=document.createElement('div');ov.id='more-ov';
  ov.style.cssText='position:fixed;inset:0;z-index:498;background:rgba(0,0,0,.4)';
  const menu=document.createElement('div');menu.id='more-menu';
  menu.style.cssText='position:fixed;bottom:60px;right:0;left:0;background:#fff;border-radius:20px 20px 0 0;'
    +'padding:16px;z-index:499;box-shadow:0 -6px 28px rgba(0,0,0,.18);'
    +'display:grid;grid-template-columns:repeat(3,1fr);gap:10px';
  const hd=document.createElement('div');
  hd.style.cssText='grid-column:1/-1;text-align:center;font-weight:700;font-size:14px;color:#475569;padding-bottom:10px;border-bottom:1px solid #e2e8f0;margin-bottom:4px';
  hd.textContent='المزيد';menu.appendChild(hd);
  more.forEach(n=>{
    const btn=document.createElement('button');
    btn.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:14px 6px;border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;cursor:pointer;font-family:Cairo,sans-serif;font-size:12px;color:#1e293b;font-weight:700;width:100%;transition:all .15s';
    btn.innerHTML='<span>'+n.l+'</span>';
    btn.addEventListener('click',()=>{ov.remove();menu.remove();const f=window[fn];if(typeof f==='function')f(n.k,null);});
    menu.appendChild(btn);
  });
  ov.addEventListener('click',()=>{ov.remove();menu.remove();});
  document.body.appendChild(ov);document.body.appendChild(menu);
}

function gT(p){
  NAV=p;buildNav(ADM_NAVS,'bnav','gT',p);
  const pg=$g('pg');if(pg){pg.className='';void pg.offsetWidth;pg.className='pg-anim';}
  ({home:pH,sections:pSec,forms:pFrm,followup:pFol,appointments:pApt,
    reviewers:pRev,chat:pCht,publications:pPub,settings:pSet}[p]||pH)();
}

function pH(){
  var s=D.st;
  var pendingSubs=D.sub.filter(function(x){return x.status==='pending'||x.status==='reviewing';});
  var pendingApts=D.apt.filter(function(x){return x.status==='pending';});
  var unreadMsgs=D.cvs.filter(function(x){return +x.unread>0;});
  var alerts='';
  if(pendingSubs.length){
    var sub2=pendingSubs.slice(0,2).map(function(s2){return (s2.reviewer_name||'مراجع')+': '+(s2.form_title||'');}).join(' — ');
    alerts+='<div class="alert-card" data-nav="followup"><div class="alert-icon" style="background:#fef3c7;color:#d97706">📩</div><div class="alert-body"><div class="alert-title">'+pendingSubs.length+' استمارة تحتاج مراجعة</div><div class="alert-sub">'+sub2+'</div></div><span class="alert-arrow">›</span></div>';
  }
  if(pendingApts.length){
    var apt2=pendingApts.slice(0,2).map(function(a){return (a.reviewer_name||'')+(a.date?' — '+a.date:'');}).join(' | ');
    alerts+='<div class="alert-card" data-nav="appointments"><div class="alert-icon" style="background:#dbeafe;color:#2563b0">📅</div><div class="alert-body"><div class="alert-title">'+pendingApts.length+' موعد بانتظار التأكيد</div><div class="alert-sub">'+apt2+'</div></div><span class="alert-arrow">›</span></div>';
  }
  if(unreadMsgs.length){
    var ch2=unreadMsgs.slice(0,2).map(function(c){return c.name;}).join('، ');
    alerts+='<div class="alert-card" data-nav="chat"><div class="alert-icon" style="background:#dcfce7;color:#15803d">💬</div><div class="alert-body"><div class="alert-title">رسائل جديدة من '+unreadMsgs.length+' مراجع</div><div class="alert-sub">'+ch2+'</div></div><span class="alert-arrow">›</span></div>';
  }
  $h('pg',
    '<div class="ph"><div><div class="pt">مرحباً '+((U&&U.name)||'')+'</div>'
    +'<div class="ps">نظرة عامة على النظام</div></div>'
    +'<button class="btn bd bsm" onclick="logout()">خروج</button></div>'
    +(alerts?'<div id="home-alerts" style="margin-bottom:14px">'+alerts+'</div>':'')
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div class="stat-c" data-nav="followup"><div style="font-size:22px;font-weight:800;color:var(--blue)">'+(s.pending_subs||0)+'</div><div class="ps">بانتظار المراجعة</div></div>'
    +'<div class="stat-c" data-nav="appointments"><div style="font-size:22px;font-weight:800;color:var(--blue)">'+(s.appointments||0)+'</div><div class="ps">موعد مسجل</div></div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'
    +'<div class="stat-c" data-nav="sections"><div style="font-size:18px;font-weight:800;color:var(--blue)">'+(D.sec.length||0)+'</div><div class="ps">أقسام</div></div>'
    +'<div class="stat-c" data-nav="forms"><div style="font-size:18px;font-weight:800;color:var(--blue)">'+(D.frm.length||0)+'</div><div class="ps">استمارات</div></div>'
    +'<div class="stat-c" data-nav="reviewers"><div style="font-size:18px;font-weight:800;color:var(--blue)">'+(D.rev.length||0)+'</div><div class="ps">مراجعون</div></div>'
    +'</div>');

  setTimeout(function(){
    document.querySelectorAll('[data-nav]').forEach(function(el){
      el.style.cursor='pointer';
      el.onclick=function(){gT(this.dataset.nav,null);};
    });
  },50);
}

function htmlEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

async function lAll(){
  try{

    await Promise.all([
      api('GET','settings').then(function(r){if(r&&!r.error)D.cfg=r;}),
      api('GET','stats').then(function(r){if(r&&!r.error)D.st=r;}),
      lSec(), lFrm(), lRev()
    ]);

    Promise.all([lSub(),lApt(),lSlt(),lDts(),lPub(),lCvs()]).catch(function(){});
  }catch(e){console.error('lAll:',e);}
}

async function lSec(){const r=await api('GET','sections');D.sec=Array.isArray(r)?r:[];}

async function lFrm(){const r=await api('GET','forms');D.frm=Array.isArray(r)?r:[];}

async function lRev(){const r=await api('GET','users');D.rev=Array.isArray(r)?r:[];}

async function lSub(){const r=await api('GET','submissions');D.sub=Array.isArray(r)?r:[];}

async function lApt(){const r=await api('GET','appointments');D.apt=Array.isArray(r)?r:[];}

async function lSlt(){const r=await api('GET','slots');D.slt=Array.isArray(r)?r:[];}

async function lDts(){const r=await api('GET','dates');D.dts=Array.isArray(r)?r:[];}

async function lPub(){const r=await api('GET','publications');D.pub=Array.isArray(r)?r:[];}

async function lCvs(){const r=await api('GET','messages');D.cvs=Array.isArray(r)?r:[];}

async function shDash(){
  $g('auth').className='';
  $g('rev-dash').className='';
  $g('dash').className='on';
  buildNav(ADM_NAVS,'bnav','gT',NAV);
  gT('home'); // عرض فوري
  // تحميل موازي كامل
  Promise.all([
    lSec(),lFrm(),lRev(),lSub(),lApt(),lSlt(),lDts(),lPub(),lCvs(),
    api('GET','stats').then(function(r){if(r&&!r.error)D.st=r;})
  ]).then(function(){gT(NAV||'home');}).catch(function(){});
}

async function shRev(){
  $g('auth').className='';
  $g('dash').className='';
  $g('rev-dash').className='on';
  var rvN=(U&&U.name)||'مراجع';
  $h('rv-name','أهلاً '+rvN);
  var avatar=$g('rv-avatar');
  if(avatar) avatar.textContent=rvN.charAt(0);
  var roleEl=$g('rv-role');
  if(roleEl) roleEl.textContent=(U&&U.username?'@'+U.username:(U&&U.phone?U.phone:'مراجع'));
  buildNav(REV_NAVS,'rev-bnav','rvGo',RV_NAV);
  $h('rv-pg','<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 16px;gap:14px">'
    +'<div style="width:38px;height:38px;border:3px solid #e2e8f0;border-top-color:#2a6fdb;border-radius:50%;animation:spin .7s linear infinite"></div>'
    +'<div style="font-size:14px;color:#64748b;font-weight:600">جاري تحميل...</div>'
    +'</div>');
  await Promise.all([
    lFrm().catch(function(){}),
    lSec().catch(function(){}),
    lDts().catch(function(){}),
    lSlt().catch(function(){}),
  ]);
  rvGo('home');
  // تحميل إضافي في الخلفية
  Promise.all([lSub(),lApt(),lPub(),lCvs()]).then(function(){
    if(RV_NAV==='home') rvHome();
  }).catch(function(){});
}

async function logout(){
  TK=null;U=null;localStorage.removeItem('tk');
  D={sec:[],frm:[],rev:[],sub:[],apt:[],slt:[],dts:[],pub:[],cvs:[],cms:[],cc:null,st:{},cfg:{}};
  NAV='home';RV_NAV='home';
  if(window._chatPoll){clearInterval(window._chatPoll);window._chatPoll=null;}
  if(window._rvPoll){clearInterval(window._rvPoll);window._rvPoll=null;}
  $g('dash').className='';
  $g('rev-dash').className='';

  try{const cfg=await api('GET','settings');if(cfg&&!cfg.error)D.cfg=cfg;}catch(e){}
  shAuth(false);
}

async function init(){
  const forceAdmin=(typeof location!=='undefined')&&new URLSearchParams(location.search).get('admin')==='1';

  // تحميل الإعدادات - إذا فشل اعرض login فوراً
  const cfgPromise = api('GET','settings');
  // لا ننتظر settings لعرض login - نعرضه بعد 2 ثانية إذا لم يرد
  let settingsDone = false;
  const settingsFallback = setTimeout(function(){
    if(!settingsDone){
      console.warn('settings timeout - showing login');
      if(!TK) shAuth(forceAdmin);
    }
  }, 2000);
  
  try{
    const cfg = await cfgPromise;
    if(cfg&&!cfg.error) D.cfg=cfg;
  }catch(e){}
  settingsDone = true;
  clearTimeout(settingsFallback);

  if(TK){
    let validJwt=false, pl=null;
    try{
      const parts=TK.split('.');
      if(parts.length===3){
        pl=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
        if(pl.exp>Date.now()/1000) validJwt=true;
      }
    }catch(ex){ console.log('JWT parse error:',ex); }

    if(validJwt && pl){
      let me=null;
      for(let i=0;i<2;i++){
        me=await api('GET','me');
        if(me&&me.id&&!me.error) break;
        if(me&&me.error&&/غير مصرح|401|invalid|expired/i.test(me.error)) break;
        await new Promise(r=>setTimeout(r,500));
      }
      if(me&&me.id&&!me.error){
        if(me.role && pl.role && me.role!==pl.role){
          TK=null; localStorage.removeItem('tk');
          shAuth(forceAdmin);
          return;
        }
        U=Object.assign({},me,{role:pl.role});
        if(pl.role==='admin'){ await shDash(); return; }
        else { await shRev(); return; }
      }
      if(me&&me.error&&/غير مصرح|401|invalid|expired/i.test(me.error)){
        TK=null; localStorage.removeItem('tk');
      }
    } else {
      TK=null; localStorage.removeItem('tk');
    }
  }
  shAuth(forceAdmin);
}

/* ============================================================
   Markdown — تنسيق نصوص بسيط وآمن (bold/italic/headings/lists/links)
   ============================================================ */
function mdEsc(s){
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function mdInline(s){
  s=s.replace(/\*\*([^*\n]+?)\*\*/g,'<strong>$1</strong>');
  s=s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g,'$1<em>$2</em>');
  s=s.replace(/__([^_\n]+?)__/g,'<strong>$1</strong>');
  s=s.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g,function(_,t,u){
    if(/^(https?:|mailto:|tel:)/i.test(u)){
      return '<a href="'+u+'" target="_blank" rel="noopener" style="color:#0369a1;text-decoration:underline">'+t+'</a>';
    }
    return t;
  });
  return s;
}
// تحويل ترميز Claude للقيم الشاذة إلى spans ملوّنة (يُستدعى بعد mdRender)
//   {{HIGH:قيمة}}  → خلفية حمراء (مرتفع)
//   {{LOW:قيمة}}   → خلفية زرقاء (منخفض)
//   {{BORDER:قيمة}} → خلفية صفراء (على الحد)
window.styleAbnormalValues = function(html){
  if(!html) return '';
  return String(html)
    .replace(/\{\{HIGH:([^}]*?)\}\}/g,   '<span class="abn-high">🔴 $1</span>')
    .replace(/\{\{LOW:([^}]*?)\}\}/g,    '<span class="abn-low">🔵 $1</span>')
    .replace(/\{\{BORDER:([^}]*?)\}\}/g, '<span class="abn-border">🟡 $1</span>');
};

function mdRender(text){
  if(!text) return '';
  var lines=mdEsc(text).split('\n');
  var out=[],inUL=false,inOL=false,m;
  function closeLists(){ if(inUL){out.push('</ul>');inUL=false;} if(inOL){out.push('</ol>');inOL=false;} }
  for(var i=0;i<lines.length;i++){
    var line=lines[i];
    if((m=line.match(/^\s*[-*•]\s+(.+)$/))){
      if(inOL){out.push('</ol>');inOL=false;}
      if(!inUL){out.push('<ul style="margin:6px 0;padding-right:22px">');inUL=true;}
      out.push('<li>'+mdInline(m[1])+'</li>');continue;
    }
    if((m=line.match(/^\s*\d+\.\s+(.+)$/))){
      if(inUL){out.push('</ul>');inUL=false;}
      if(!inOL){out.push('<ol style="margin:6px 0;padding-right:22px">');inOL=true;}
      out.push('<li>'+mdInline(m[1])+'</li>');continue;
    }
    closeLists();
    if((m=line.match(/^###\s+(.+)$/))){ out.push('<h5 style="margin:8px 0 4px;font-weight:800;font-size:13px;color:#0f172a">'+mdInline(m[1])+'</h5>');continue; }
    if((m=line.match(/^##\s+(.+)$/))){ out.push('<h4 style="margin:10px 0 5px;font-weight:800;font-size:14px;color:#0f172a">'+mdInline(m[1])+'</h4>');continue; }
    if((m=line.match(/^#\s+(.+)$/))){ out.push('<h3 style="margin:12px 0 6px;font-weight:800;font-size:16px;color:#075e54">'+mdInline(m[1])+'</h3>');continue; }
    if(line.trim()===''){ out.push('<div style="height:6px"></div>');continue; }
    out.push('<div>'+mdInline(line)+'</div>');
  }
  closeLists();
  return out.join('');
}

function mdToolbar(taId){
  function btn(act,lbl,ttl,extra){
    return '<button type="button" onclick="mdAct(\''+taId+'\',\''+act+'\')" title="'+ttl+'" style="background:#fff;border:1px solid #cbd5e1;padding:5px 9px;border-radius:6px;font-family:Cairo,sans-serif;font-size:11px;font-weight:700;cursor:pointer;color:#334155;line-height:1;'+(extra||'')+'">'+lbl+'</button>';
  }
  function sep(){ return '<span style="width:1px;background:#e2e8f0;align-self:stretch;margin:2px 1px"></span>'; }
  return '<div class="md-tb" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;background:#f8fafc;border:1.5px solid var(--border);border-bottom:none;border-radius:8px 8px 0 0;padding:6px 7px;margin-top:4px">'
    +btn('bold','B','عريض','font-weight:900;font-size:13px')
    +btn('italic','I','مائل','font-style:italic;font-size:13px')
    +sep()
    +btn('h1','ع. كبير','عنوان كبير')
    +btn('h2','ع. صغير','عنوان صغير')
    +sep()
    +btn('ul','• قائمة','قائمة نقطية')
    +btn('ol','1. قائمة','قائمة مرقّمة')
    +sep()
    +btn('link','🔗 رابط','إضافة رابط')
    +btn('preview','👁 معاينة','معاينة النص بعد التنسيق','margin-right:auto;background:#075e54;color:#fff;border-color:#075e54')
    +'</div>';
}
function mdAct(taId,act){
  var ta=document.getElementById(taId); if(!ta) return;
  if(act==='bold')      mdWrap(ta,'**','**','نص عريض');
  else if(act==='italic') mdWrap(ta,'*','*','نص مائل');
  else if(act==='h1')   mdLinePrefix(ta,'# ');
  else if(act==='h2')   mdLinePrefix(ta,'## ');
  else if(act==='ul')   mdLinePrefix(ta,'- ');
  else if(act==='ol')   mdLinePrefix(ta,'1. ');
  else if(act==='link') mdInsertLink(ta);
  else if(act==='preview') mdPreview(ta);
}
function mdWrap(ta,before,after,placeholder){
  var s=ta.selectionStart,e=ta.selectionEnd,v=ta.value;
  var sel=v.slice(s,e)||(placeholder||'نص');
  ta.value=v.slice(0,s)+before+sel+after+v.slice(e);
  ta.focus();
  ta.setSelectionRange(s+before.length, s+before.length+sel.length);
}
function mdLinePrefix(ta,prefix){
  var s=ta.selectionStart,e=ta.selectionEnd,v=ta.value;
  var ls=v.lastIndexOf('\n',s-1)+1;
  var le=v.indexOf('\n',e); if(le<0) le=v.length;
  var block=v.slice(ls,le);
  var nb=block.split('\n').map(function(l){ return prefix+l; }).join('\n');
  ta.value=v.slice(0,ls)+nb+v.slice(le);
  ta.focus();
  ta.setSelectionRange(ls,ls+nb.length);
}
function mdInsertLink(ta){
  var s=ta.selectionStart,e=ta.selectionEnd,v=ta.value;
  var sel=v.slice(s,e)||'نص الرابط';
  var url=prompt('أدخل الرابط (يبدأ بـ https:// أو mailto: أو tel:)','https://');
  if(!url) return;
  var ins='['+sel+']('+url+')';
  ta.value=v.slice(0,s)+ins+v.slice(e);
  ta.focus();
  ta.setSelectionRange(s+1, s+1+sel.length);
}
function mdPreview(ta){
  var p=document.getElementById('md-prev-ov'); if(p) p.remove();
  var ov=document.createElement('div');
  ov.id='md-prev-ov';
  ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Cairo,sans-serif;direction:rtl';
  var box=document.createElement('div');
  box.style.cssText='background:#fff;border-radius:14px;padding:18px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,.25)';
  box.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #f1f5f9">'
    +'<div style="font-size:15px;font-weight:800;color:#075e54">👁 معاينة</div>'
    +'<button id="md-prev-x" type="button" style="background:#f1f5f9;border:none;width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;color:#475569">✕</button>'
    +'</div>'
    +'<div style="font-size:14px;line-height:1.85;color:#1e293b">'+mdRender(ta.value)+'</div>';
  ov.appendChild(box);
  document.body.appendChild(ov);
  function close(){ ov.remove(); }
  document.getElementById('md-prev-x').addEventListener('click',close);
  ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
}

