/* admin_dashboard.js - لوحة تحكم الأدمن - إحصائيات وتهيئة */

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

function gT(p){
  NAV=p;buildNav(ADM_NAVS,'bnav','gT',p);
  const pg=$g('pg');if(pg){pg.className='';void pg.offsetWidth;pg.className='pg-anim';}
  ({home:pH,sections:pSec,forms:pFrm,followup:pFol,appointments:pApt,
    reviewers:pRev,chat:pCht,publications:pPub,settings:pSet}[p]||pH)();
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

async function lSec(){const r=await api('GET','sections');D.sec=Array.isArray(r)?r:[];}

async function lFrm(){const r=await api('GET','forms');D.frm=Array.isArray(r)?r:[];}

async function lRev(){const r=await api('GET','users');D.rev=Array.isArray(r)?r:[];}

async function lSub(){const r=await api('GET','submissions');D.sub=Array.isArray(r)?r:[];}

async function lApt(){const r=await api('GET','appointments');D.apt=Array.isArray(r)?r:[];}

async function lSlt(){const r=await api('GET','slots');D.slt=Array.isArray(r)?r:[];}

async function lDts(){const r=await api('GET','dates');D.dts=Array.isArray(r)?r:[];}

async function lPub(){const r=await api('GET','publications');D.pub=Array.isArray(r)?r:[];}

async function lCvs(){const r=await api('GET','messages');D.cvs=Array.isArray(r)?r:[];}

