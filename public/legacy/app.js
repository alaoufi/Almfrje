const API='./api.php';
let TK=localStorage.getItem('tk'), U=null, NAV='home', RV_NAV='home';
let D={sec:[],frm:[],rev:[],sub:[],apt:[],slt:[],dts:[],pub:[],cvs:[],cms:[],cc:null,st:{},cfg:{}};
let BC=[],BID=null;
let secDrag=null,fldDrag=null;
window._pubType='text'; window._pdfFile=null; window._rvFields=[]; window._rvFid=null;

const ADM_MAIN=['home','sections','forms','publications'];
const ADM_NAVS=[
  {k:'home',l:'الرئيسية'},{k:'sections',l:'الأقسام'},{k:'forms',l:'الاستمارات'},
  {k:'publications',l:'النشرات'},
  {k:'followup',l:'المتابعة'},{k:'appointments',l:'المواعيد'},{k:'reviewers',l:'المراجعون'},
  {k:'chat',l:'المحادثة'},{k:'settings',l:'الإعدادات'}
];
const REV_NAVS=[
  {k:'home',l:'الرئيسية'},{k:'forms',l:'الاستمارات'},
  {k:'appointments',l:'المواعيد'},{k:'chat',l:'المحادثة'},{k:'publications',l:'النشرات'}
];

const FTYPES=[['text','نص'],['textarea','نص طويل'],['number','رقم'],['select','قائمة'],
  ['radio','اختيار واحد'],['checkbox','اختيارات متعددة'],['date','تاريخ'],['phone','جوال']];

const SVG={
  edit:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/></svg>',
  del:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>',
  view:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  more:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  down:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  drag:'⠿'
};

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
const $g=id=>document.getElementById(id);
const $h=(id,h)=>{const e=$g(id);if(e)e.innerHTML=h;};
let _tt;
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

function pSec(){
  $h('pg','<div class="ph"><div><div class="pt">الأقسام</div></div><button class="btn bp" onclick="oSec()">+ قسم</button></div><div id="sl"></div>');
  rSL();
}
function rSL(){
  const c=$g('sl');if(!c)return;
  if(!D.sec.length){c.innerHTML='<div class="empty-state"><div style="font-size:36px">🗂️</div><p>لا توجد أقسام</p><button class="btn bp" onclick="oSec()">+ إضافة</button></div>';return;}
  c.innerHTML=D.sec.map((s,i)=>`
    <div class="list-item" draggable="true"
      ondragstart="secDrag=${i};this.style.opacity='.4'"
      ondragend="this.style.opacity='1';secDrag=null"
      ondragover="event.preventDefault()"
      ondrop="event.preventDefault();dropSec(${i})">
      <span style="color:#94a3b8;cursor:grab;font-size:16px">⠿</span>
      <div style="flex:1">
        <div style="font-weight:700">${s.name}</div>
        <div class="ps">${s.description||'—'}</div>
        <div style="margin-top:4px">${bdg(+s.active?'active_user':'banned')}</div>
      </div>
      <div style="display:flex;gap:5px">
        <button class="ib ie" onclick="oSec(${s.id})">${SVG.edit}</button>
        <button class="ib id" onclick="if(confirmDel('حذف القسم؟'))dSec(${s.id})">${SVG.del}</button>
      </div>
    </div>`).join('');
}
async function dropSec(ti){
  if(secDrag===null||secDrag===ti)return;
  const mv=D.sec.splice(secDrag,1)[0];D.sec.splice(ti,0,mv);secDrag=null;
  D.sec.forEach((s,i)=>api('PUT','sections/'+s.id,{name:s.name,description:s.description||'',sort_order:i,active:+s.active}));
  rSL();toast('تم حفظ الترتيب ✅');
}
function oSec(id){
  const s=id?D.sec.find(x=>x.id==id):null;
  oM(s?'تعديل قسم':'قسم جديد',
    '<div class="f"><label>الاسم *</label><input id="sn" value="'+(s?.name||'')+'" placeholder="اسم القسم" autocomplete="off"></div>'
    +'<div class="f"><label>الوصف</label><textarea id="sd" placeholder="وصف اختياري...">'+(s?.description||'')+'</textarea></div>'
    +'<div class="f" style="flex-direction:row;align-items:center;gap:12px">'+tog('stg',+(s?.active??1)==1,'function(b){togFlip(b)}')+'<span style="font-size:13px;font-weight:600">نشط</span></div>'
    +'<div style="display:flex;gap:9px;margin-top:8px"><button class="btn bp" onclick="svSec('+(id||0)+')">💾 حفظ</button><button class="btn bs" onclick="cM()">إلغاء</button></div>');
}
async function svSec(id){
  const nm=($g('sn')?.value||'').trim();if(!nm){toast('اسم القسم مطلوب','er');return;}
  const b={name:nm,description:$g('sd')?.value||'',sort_order:id?(D.sec.find(x=>x.id==id)||{}).sort_order||0:D.sec.length,active:+($g('stg')?.dataset.v||'1')};
  ld(1);const r=id?await api('PUT','sections/'+id,b):await api('POST','sections',b);ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تم ✅');cM();await lSec();rSL();
}
async function dSec(id){ld(1);await api('DELETE','sections/'+id);ld(0);toast('تم الحذف');await lSec();rSL();}

function pFrm(){
  $h('pg','<div class="ph"><div><div class="pt">الاستمارات</div></div><button class="btn bp" onclick="cFrm()">+ استمارة</button></div><div id="fl"></div>');
  rFL();
}
function rFL(){
  const c=$g('fl');if(!c)return;
  if(!D.frm.length){c.innerHTML='<div class="empty-state"><div style="font-size:36px">📋</div><p>لا توجد استمارات</p><button class="btn bp" onclick="cFrm()">+ إنشاء</button></div>';return;}
  c.innerHTML=D.frm.map(f=>`
    <div class="card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1">
          <div style="font-weight:700;font-size:14px;margin-bottom:3px">${f.title}</div>
          <div class="ps">${f.section_name||'—'}</div>
          <div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap">
            ${bdg(f.status||'draft')}
            <button class="btn bsm" style="background:${f.status==='active'?'#fee2e2':'#dcfce7'};color:${f.status==='active'?'#dc2626':'#15803d'};border:none;font-size:11px" onclick="tFS(${f.id},'${f.status||'draft'}')">
              ${f.status==='active'?'🔒 إخفاء':'👁️ نشر'}
            </button>
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="ib" style="background:#f5f3ff;color:#7c3aed" onclick="previewForm(${f.id})" title="معاينة">${SVG.view}</button>
          <button class="ib ie" onclick="oBld(${f.id})" title="تعديل">${SVG.edit}</button>
          <button class="ib id" onclick="if(confirmDel('حذف الاستمارة؟'))dFrm(${f.id})" title="حذف">${SVG.del}</button>
        </div>
      </div>
    </div>`).join('');
}
async function cFrm(){
  const t=prompt('عنوان الاستمارة:');if(!t?.trim())return;
  ld(1);const r=await api('POST','forms',{title:t.trim(),subtitle:'',status:'draft',section_id:D.sec[0]?.id||null});ld(0);
  if(r.error){toast(r.error,'er');return;}toast('تم الإنشاء ✅');await lFrm();rFL();
}
async function dFrm(id){ld(1);await api('DELETE','forms/'+id);ld(0);toast('تم الحذف');await lFrm();rFL();}
async function tFS(id,cur){
  const ns=cur==='active'?'draft':'active';
  ld(1);await api('PUT','forms/'+id,{status:ns});ld(0);await lFrm();rFL();
}

async function oBld(fid){
  ld(1);const r=await api('GET','forms/'+fid);ld(0);
  BID=fid;
  const fields=r.fields||[];
  const cats=[...new Set(fields.map(f=>f.category||'عام'))];
  if(!cats.length)cats.push('البيانات الشخصية');
  BC=cats.map(nm=>({name:nm,open:true,fields:fields.filter(f=>(f.category||'عام')===nm)}));
  if(!BC.length)BC=[{name:'البيانات الشخصية',open:true,fields:[]}];
  const so=D.sec.map(s=>`<option value="${s.id}"${s.id==r.section_id?' selected':''}>${s.name}</option>`).join('');
  $h('pg',
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'
    +'<button class="btn bs bsm" onclick="gT(\'forms\')">← رجوع</button>'
    +'<div class="pt">'+r.title+'</div></div>'
    +'<div class="card" style="margin-bottom:12px">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +'<div class="f" style="margin:0"><label>العنوان *</label><input id="bt" value="'+(r.title||'')+'"></div>'
    +'<div class="f" style="margin:0"><label>القسم</label><select id="bsc">'+so+'</select></div>'
    +'</div>'
    +'<div class="f" style="margin:8px 0 0"><label>الحالة</label>'
    +'<select id="bst" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:Cairo,sans-serif;font-size:13px;outline:none">'
    +'<option value="draft"'+(r.status==='draft'?' selected':'')+'>مسودة</option>'
    +'<option value="active"'+(r.status==='active'?' selected':'')+'>منشور</option>'
    +'</select></div>'
    +'<button class="btn bp" style="width:100%;margin-top:10px" onclick="nomFormModal('+fid+')">👤 ترشيح لمراجع</button>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    +'<span style="font-weight:700;font-size:14px">التصنيفات والحقول</span>'
    +'<button class="btn bp bsm" onclick="addCat()">+ تصنيف</button></div>'
    +'<div id="cats-wrap"></div>'
    +'<div style="display:flex;gap:9px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">'
    +'<button class="btn bp" onclick="svBld()">💾 حفظ</button>'
    +'<button class="btn bs" onclick="gT(\'forms\')">إلغاء</button></div>');
  rCats();
}
function rCats(){
  const c=$g('cats-wrap');if(!c)return;
  c.innerHTML=BC.map((cat,ci)=>
    '<div class="cat-wrap" id="cw_'+ci+'">'
    +'<div class="cat-hdr" onclick="toggleCat('+ci+')">'
    +'<span>🗂️</span>'
    +'<input class="cat-name" value="'+cat.name+'" onclick="event.stopPropagation()" oninput="BC['+ci+'].name=this.value" placeholder="اسم التصنيف">'
    +'<div style="display:flex;gap:5px" onclick="event.stopPropagation()">'
    +'<button class="btn bp bsm" style="font-size:11px;padding:4px 10px" onclick="addField('+ci+')">+ حقل</button>'
    +'<button class="ib id" style="width:28px;height:28px" onclick="if(confirmDel(\'حذف التصنيف؟\'))delCat('+ci+')">'+SVG.del+'</button>'
    +'</div>'
    +'<span style="font-size:11px;color:var(--light);transition:transform .2s"'+(cat.open?' class="cat-arrow open"':' class="cat-arrow"')+'>▼</span>'
    +'</div>'
    +'<div class="cat-body'+(cat.open?' open':'')+'"><div id="flds_'+ci+'">'
    +(cat.fields.length?'':'<div style="text-align:center;color:var(--light);padding:14px;font-size:13px">لا توجد حقول</div>')
    +'</div></div></div>').join('');
  BC.forEach((cat,ci)=>{const c2=$g('flds_'+ci);if(c2)c2.innerHTML=cat.fields.length?rFields(cat.fields,ci):'<div style="text-align:center;color:var(--light);padding:14px;font-size:13px">لا توجد حقول — اضغط "+ حقل"</div>';});
  attachFldEvents();
}
function rFields(fields,ci){
  return fields.map(function(f,fi){
    var ft=f.field_type||'text';
    var ftypes=FTYPES.map(function(t){
      return '<option value="'+t[0]+'"'+(ft===t[0]?' selected':'')+'>'+t[1]+'</option>';
    }).join('');
    var hasOpts=['select','radio','checkbox'].includes(ft);
    var opts=Array.isArray(f.options)?f.options:[];

    var optsHtml='';
    if(hasOpts){
      optsHtml='<div class="opt-list-wrap">';
      optsHtml+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">';
      optsHtml+='<span style="font-size:11px;font-weight:700;color:var(--mid)">الخيارات</span>';
      optsHtml+='<button type="button" style="padding:3px 10px;border:1px solid var(--border);border-radius:6px;background:#fff;font-family:Cairo,sans-serif;font-size:11px;cursor:pointer" data-addopt="1" data-ci="'+ci+'" data-fi="'+fi+'">+ خيار</button>';
      optsHtml+='</div>';

      opts.forEach(function(opt,oi){
        var ol=typeof opt==='object'?(opt.label||''):String(opt);
        var hasSub=opt.has_sub===true||opt.has_sub===1;
        var sub=opt.sub||{type:'text',label:'',placeholder:'',required:false};
        var subTypes=[['text','نص'],['number','رقم'],['textarea','طويل'],['date','تاريخ'],['phone','جوال']].map(function(t){
          return '<option value="'+t[0]+'"'+(sub.type===t[0]?' selected':'')+'>'+t[1]+'</option>';
        }).join('');
        var tbg=hasSub?'var(--blue)':'#cbd5e1';
        var tleft=hasSub?'21px':'3px';

        optsHtml+='<div class="opt-row">';

        optsHtml+='<div class="opt-row-head">';
        optsHtml+='<span style="font-size:10px;color:var(--light);flex-shrink:0">'+String.fromCharCode(9679)+'</span>';
        optsHtml+='<input id="opt_'+ci+'_'+fi+'_'+oi+'" class="opt-inp" style="flex:1;padding:5px 9px;border:1.5px solid var(--border);border-radius:7px;font-family:Cairo,sans-serif;font-size:13px;outline:none" placeholder="نص الخيار" value="'+ol.replace(/"/g,'&quot;')+'">';
        optsHtml+='<button class="ib id" style="width:24px;height:24px;font-size:12px;flex-shrink:0" data-ci="'+ci+'" data-fi="'+fi+'" data-oi="'+oi+'" data-delopt="1">✕</button>';
        optsHtml+='</div>';

        optsHtml+='<div class="opt-row-toggle">';
        optsHtml+='<span>يفتح حقل توضيحي عند اختياره</span>';
        optsHtml+='<button id="subtog_'+ci+'_'+fi+'_'+oi+'" class="tog" data-ci="'+ci+'" data-fi="'+fi+'" data-oi="'+oi+'" data-subtog="1" style="background:'+tbg+'" data-v="'+(hasSub?'1':'0')+'">'
          +'<div class="tok" style="left:'+tleft+'"></div></button>';
        optsHtml+='</div>';

        optsHtml+='<div id="sub_'+ci+'_'+fi+'_'+oi+'" class="opt-row-sub" style="display:'+(hasSub?'block':'none')+'">';
        optsHtml+='<div class="opt-sub-grid">';
        optsHtml+='<div class="f-item"><label>نوع التوضيح</label><select id="subtype_'+ci+'_'+fi+'_'+oi+'">'+subTypes+'</select></div>';
        optsHtml+='<div class="f-item"><label style="padding-top:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" id="subrq_'+ci+'_'+fi+'_'+oi+'" style="width:14px;height:14px;accent-color:var(--blue)"'+(sub.required?' checked':'')+'> إجباري</label></div>';
        optsHtml+='</div>';
        optsHtml+='<div class="f-item" style="margin-top:6px"><label>عنوان الحقل</label>'
          +'<input id="sublbl_'+ci+'_'+fi+'_'+oi+'" class="opt-inp" style="width:100%;padding:5px 9px;border:1.5px solid var(--border);border-radius:7px;font-family:Cairo,sans-serif;font-size:12px;outline:none" placeholder="مثال: كم القراءة؟" value="'+(sub.label||'').replace(/"/g,'&quot;')+'"></div>';
        optsHtml+='<div class="f-item" style="margin-top:6px"><label>Placeholder</label>'
          +'<input id="subph_'+ci+'_'+fi+'_'+oi+'" class="opt-inp" style="width:100%;padding:5px 9px;border:1.5px solid var(--border);border-radius:7px;font-family:Cairo,sans-serif;font-size:12px;outline:none" placeholder="مثال: اكتب القيمة..." value="'+(sub.placeholder||'').replace(/"/g,'&quot;')+'"></div>';
        optsHtml+='</div>';
        optsHtml+='</div>';
      });
      optsHtml+='</div>';
    }

    return '<div class="fr" id="fr_'+ci+'_'+fi+'">'
      +'<div class="fr-row">'
      +'<span style="cursor:grab;color:#94a3b8;font-size:15px;flex-shrink:0">⠿</span>'
      +'<input id="lbl_'+ci+'_'+fi+'" class="fr-inp" style="flex:1;min-width:70px" placeholder="التسمية *" value="'+(f.label||'').replace(/"/g,'&quot;')+'">'
      +'<select id="tp_'+ci+'_'+fi+'" class="fr-sel" style="min-width:95px" onchange="onFldTypeChange('+ci+','+fi+',this.value)">'+ftypes+'</select>'
      +'<label style="display:flex;align-items:center;gap:3px;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0">'
      +'<input id="rq_'+ci+'_'+fi+'" type="checkbox"'+(f.required?' checked':'')+' style="width:13px;height:13px;accent-color:var(--blue)"> إلزامي</label>'
      +'<button class="ib id" style="width:25px;height:25px;flex-shrink:0" data-ci="'+ci+'" data-fi="'+fi+'" data-del="1">'+SVG.del+'</button>'
      +'</div>'
      +'<input id="ph_'+ci+'_'+fi+'" class="fr-inp" style="color:#64748b;font-size:12px" placeholder="Placeholder..." value="'+(f.placeholder||'').replace(/"/g,'&quot;')+'">'
      +'<div style="display:flex;align-items:center;gap:4px;padding:4px 6px;background:#f8fafd;border-radius:6px">'
      +'<span style="font-size:10px;color:var(--light);white-space:nowrap">يظهر عند:</span>'
      +'<input id="cf_'+ci+'_'+fi+'" class="fr-inp" style="flex:2;min-width:55px;font-size:11px;padding:4px 7px" placeholder="حقل آخر" value="'+(f.conditional_field||'')+'">'
      +'<span style="font-size:10px;color:var(--light)">=</span>'
      +'<input id="cv_'+ci+'_'+fi+'" class="fr-inp" style="flex:1;min-width:40px;font-size:11px;padding:4px 7px" placeholder="القيمة" value="'+(f.conditional_value||'')+'">'
      +'</div>'
      +optsHtml
      +'</div>';
  }).join('');
}

function onFldTypeChange(ci,fi,type){
  var f=BC[ci].fields[fi];
  f.field_type=type;
  var hasOpts=['select','radio','checkbox'].includes(type);
  if(hasOpts&&(!f.options||!f.options.length)){
    f.options=[
      {label:'نعم',has_sub:false,sub:{type:'text',label:'',placeholder:'',required:false}},
      {label:'لا', has_sub:false,sub:{type:'text',label:'',placeholder:'',required:false}}
    ];
  }
  rCats();
}

function addField(ci){
  if(!BC[ci])return;
  BC[ci].fields.push({
    id:null,label:'',field_type:'text',required:0,
    placeholder:'',conditional_field:'',conditional_value:'',options:[]
  });
  BC[ci].open=true;
  rCats();

  setTimeout(function(){
    var c=$g('cats-wrap');
    if(c)c.querySelector('#flds_'+ci+' .fr:last-child')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  },100);
}

function delField(ci,fi){
  if(BC[ci]&&BC[ci].fields)BC[ci].fields.splice(fi,1);
  rCats();
}

function addCat(){
  BC.push({name:'تصنيف جديد',open:true,fields:[]});
  rCats();
  setTimeout(function(){
    var c=$g('cats-wrap');
    if(c&&c.lastElementChild)c.lastElementChild.scrollIntoView({behavior:'smooth',block:'nearest'});
  },100);
}

function delCat(ci){
  BC.splice(ci,1);
  rCats();
}

function toggleCat(ci){
  if(BC[ci])BC[ci].open=!BC[ci].open;
  rCats();
}

function attachFldEvents(){

  document.querySelectorAll('[data-del="1"]').forEach(function(btn){
    btn.onclick=function(){if(confirmDel('حذف الحقل؟'))delField(+btn.dataset.ci,+btn.dataset.fi);};
  });

  document.querySelectorAll('[data-delopt="1"]').forEach(function(btn){
    btn.onclick=function(){
      var ci=+btn.dataset.ci,fi=+btn.dataset.fi,oi=+btn.dataset.oi;
      if(BC[ci]&&BC[ci].fields[fi]&&BC[ci].fields[fi].options){
        BC[ci].fields[fi].options.splice(oi,1);rCats();
      }
    };
  });

  document.querySelectorAll('[data-addopt="1"]').forEach(function(btn){
    btn.onclick=function(){
      var ci=+btn.dataset.ci,fi=+btn.dataset.fi;
      if(!BC[ci].fields[fi].options)BC[ci].fields[fi].options=[];
      BC[ci].fields[fi].options.push({label:'خيار جديد',has_sub:false,sub:{type:'text',label:'',placeholder:'',required:false}});
      rCats();
    };
  });

  document.querySelectorAll('[data-subtog="1"]').forEach(function(btn){
    btn.onclick=function(){
      var ci=+btn.dataset.ci,fi=+btn.dataset.fi,oi=+btn.dataset.oi;
      var nv=btn.dataset.v==='1'?false:true;
      btn.dataset.v=nv?'1':'0';
      btn.style.background=nv?'var(--blue)':'#cbd5e1';

      var tok=btn.querySelector('.tok');
      if(tok)tok.style.left=nv?'21px':'3px';
      var subBox=document.getElementById('sub_'+ci+'_'+fi+'_'+oi);
      if(subBox)subBox.style.display=nv?'block':'none';
      if(BC[ci]&&BC[ci].fields[fi]&&BC[ci].fields[fi].options[oi]){
        BC[ci].fields[fi].options[oi].has_sub=nv;
      }
    };
  });
}

function readOptsFromDOM(ci,fi,f){
  var ft=$g('tp_'+ci+'_'+fi)?.value||f.field_type;
  if(!['select','radio','checkbox'].includes(ft))return null;
  var opts=f.options||[];
  return opts.map(function(opt,oi){
    return {
      label:$g('opt_'+ci+'_'+fi+'_'+oi)?.value||opt.label||'',
      has_sub:$g('subtog_'+ci+'_'+fi+'_'+oi)?.dataset.v==='1'||false,
      sub:{
        type:$g('subtype_'+ci+'_'+fi+'_'+oi)?.value||opt.sub?.type||'text',
        label:$g('sublbl_'+ci+'_'+fi+'_'+oi)?.value||opt.sub?.label||'',
        placeholder:$g('subph_'+ci+'_'+fi+'_'+oi)?.value||opt.sub?.placeholder||'',
        required:$g('subrq_'+ci+'_'+fi+'_'+oi)?.checked||false
      }
    };
  });
}

async function svBld(){
  var t=($g('bt')?.value||'').trim();if(!t){toast('العنوان مطلوب','er');$g('bt')?.focus();return;}
  var allF=[];
  BC.forEach(function(cat,ci){
    cat.fields.forEach(function(f,fi){
      var opts=readOptsFromDOM(ci,fi,f);
      allF.push({
        id:f.id||null,
        label:$g('lbl_'+ci+'_'+fi)?.value||f.label,
        placeholder:$g('ph_'+ci+'_'+fi)?.value||(f.placeholder||''),
        field_type:$g('tp_'+ci+'_'+fi)?.value||f.field_type,
        required:$g('rq_'+ci+'_'+fi)?.checked?1:0,
        category:cat.name,sort_order:ci*100+fi,
        conditional_field:$g('cf_'+ci+'_'+fi)?.value||null,
        conditional_value:$g('cv_'+ci+'_'+fi)?.value||null,
        options:opts
      });
    });
  });
  ld(1);
  var r=await api('PUT','forms/'+BID,{title:t,section_id:+$g('bsc')?.value||null,status:$g('bst')?.value||'draft',subtitle:'',fields:allF});
  ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تم حفظ الاستمارة ✅');await lFrm();gT('forms');
}

function pvSubFromEl(el){
  var fldId=el.dataset.pvid;
  var opts=JSON.parse(decodeURIComponent(el.dataset.pvopts||'[]'));
  pvApplySub(fldId,opts,el.value);
}
function pvApplySub(fldId,opts,selectedVal){
  var subWrap=document.getElementById('pvsub_'+fldId);
  if(!subWrap)return;
  subWrap.innerHTML='';
  var selVals=selectedVal?[selectedVal]:[];
  if(!selVals.length){
    var ch=document.querySelector('[name="'+fldId+'"]:checked');
    if(ch)selVals=[ch.value];
    var sel=document.getElementById(fldId);
    if(sel&&sel.value)selVals=[sel.value];
  }
  opts.forEach(function(opt,oi){
    var ol=typeof opt==='object'?opt.label:opt;
    var sub=typeof opt==='object'?opt.sub:null;
    if(!selVals.includes(ol)||!sub||!opt.has_sub||!sub.label)return;
    var BASE='width:100%;padding:9px 12px;border:1.5px solid var(--blue);border-radius:9px;font-family:Cairo,sans-serif;font-size:14px;outline:none;margin-top:6px';
    var t2=sub.type==='number'?'number':sub.type==='date'?'date':sub.type==='phone'?'tel':'text';
    subWrap.innerHTML+='<div style="background:#f0f6ff;border-radius:9px;padding:10px;border:1px solid #bfdbfe;margin-top:6px">'
      +'<label style="font-size:12px;font-weight:700;color:var(--blue2)">↳ '+sub.label+'</label>'
      +(sub.type==='textarea'?'<textarea placeholder="'+(sub.placeholder||'')+'" style="'+BASE+';height:70px;resize:none"></textarea>'
        :'<input type="'+t2+'" placeholder="'+(sub.placeholder||'')+'" style="'+BASE+'">')
      +'</div>';
  });
}
async function previewForm(fid){
  ld(1);var r=await api('GET','forms/'+fid);ld(0);
  if(r.error){toast(r.error,'er');return;}
  var fields=r.fields||[];
  var cats=[...new Set(fields.map(function(f){return f.category||'عام';}))];
  var INP='width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:9px;font-family:Cairo,sans-serif;font-size:14px;outline:none;background:#fff;transition:border .18s';
  var body='<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 14px;font-size:12px;color:#0369a1;margin-bottom:14px">👁️ معاينة — يمكنك تجربة الحقول. لن تُحفظ البيانات.</div>';

  var INP2='width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:9px;font-family:Cairo,sans-serif;font-size:13px;outline:none;background:#fff;transition:border .15s';
  cats.forEach(function(cat){
    body+='<div class="pv-wrap">';
    body+='<div class="pv-cat-hdr">🗂️ '+cat+'</div>';
    fields.filter(function(f){return (f.category||'عام')===cat;}).forEach(function(f){
      var id='pv_'+f.id;
      var opts=Array.isArray(f.options)?f.options:[];
      function getLabel(o){return typeof o==='object'&&o!==null?(o.label||''):String(o);}

      body+='<div class="pv-field">';
      body+='<label>'+f.label+(f.required?'<span style="color:var(--red)"> *</span>':'')+'</label>';

      if(f.field_type==='textarea'){
        body+='<textarea id="'+id+'" placeholder="'+(f.placeholder||'')+'" class="pv-inp pv-ta"></textarea>';

      } else if(f.field_type==='select'){
        body+='<div style="position:relative">';
        body+='<select id="'+id+'" class="pv-inp pv-sel" data-pvfid="'+f.id+'" onchange="pvHandleSelect(this)">';
        body+='<option value="">اختر...</option>';
        opts.forEach(function(o){var ol=getLabel(o);body+='<option value="'+ol+'">'+ol+'</option>';});
        body+='</select>';
        body+='<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--mid);font-size:13px">▾</span>';
        body+='</div>';
        body+='<div id="pvsub_'+id+'"></div>';

      } else if(f.field_type==='radio'){
        body+='<div style="display:flex;flex-direction:column;gap:4px">';
        opts.forEach(function(o,oi){
          var ol=getLabel(o);
          var hasSub=typeof o==='object'&&o.has_sub&&o.sub&&o.sub.label;
          var subId='pvrsub_'+id+'_'+oi;
          var wrapId='pvwrap_'+id+'_'+oi;

          body+='<div class="opt-choice-wrap" id="'+wrapId+'">';

          body+='<label class="radio-lbl">';
          body+='<input type="radio" name="'+id+'" value="'+ol+'"'
            +' data-subid="'+(hasSub?subId:'')+'" data-hassub="'+(hasSub?'1':'0')+'"'
            +' data-wrapid="'+wrapId+'" onchange="pvRadioChange(this)">';
          body+=' '+ol+'</label>';

          if(hasSub){
            var sub=o.sub;
            var t2=sub.type==='number'?'number':sub.type==='date'?'date':sub.type==='phone'?'tel':'text';
            body+='<div id="'+subId+'" class="pv-inline-sub" style="display:none">';
            body+='<label>↳ '+sub.label+(sub.required?'<span style="color:var(--red)"> *</span>':'')+'</label>';
            if(sub.type==='textarea'){
              body+='<textarea placeholder="'+(sub.placeholder||'')+'"></textarea>';
            } else {
              body+='<input type="'+t2+'" placeholder="'+(sub.placeholder||'')+'"> ';
            }
            body+='</div>';
          }
          body+='</div>';
        });
        body+='</div>';

      } else if(f.field_type==='checkbox'){
        body+='<div style="display:flex;flex-direction:column;gap:4px">';
        opts.forEach(function(o,oi){
          var ol=getLabel(o);
          var hasSub=typeof o==='object'&&o.has_sub&&o.sub&&o.sub.label;
          var subId='pvcsub_'+id+'_'+oi;
          var wrapId='pvcwrap_'+id+'_'+oi;
          body+='<div class="opt-choice-wrap" id="'+wrapId+'">';
          body+='<label class="radio-lbl">';
          body+='<input type="checkbox" value="'+ol+'" id="'+id+'_cb_'+oi+'"'
            +' data-subid="'+(hasSub?subId:'')+'" data-hassub="'+(hasSub?'1':'0')+'"'
            +' data-wrapid="'+wrapId+'" onchange="pvCheckChange(this)">';
          body+=' '+ol+'</label>';
          if(hasSub){
            var sub=o.sub;
            var t2=sub.type==='number'?'number':sub.type==='date'?'date':sub.type==='phone'?'tel':'text';
            body+='<div id="'+subId+'" class="pv-inline-sub" style="display:none">';
            body+='<label>↳ '+sub.label+(sub.required?'<span style="color:var(--red)"> *</span>':'')+'</label>';
            if(sub.type==='textarea'){
              body+='<textarea placeholder="'+(sub.placeholder||'')+'"></textarea>';
            } else {
              body+='<input type="'+t2+'" placeholder="'+(sub.placeholder||'')+'"> ';
            }
            body+='</div>';
          }
          body+='</div>';
        });
        body+='</div>';

      } else if(f.field_type==='date'){
        body+='<input type="date" id="'+id+'" class="pv-inp">';
      } else if(f.field_type==='number'){
        body+='<input type="number" id="'+id+'" placeholder="'+(f.placeholder||'')+'" class="pv-inp">';
      } else if(f.field_type==='phone'){
        body+='<input type="tel" id="'+id+'" placeholder="'+(f.placeholder||'+966...')+'" class="pv-inp">';
      } else {
        body+='<input type="text" id="'+id+'" placeholder="'+(f.placeholder||'')+'" class="pv-inp">';
      }
      body+='</div>';
    });
    body+='</div>';
  });

  body+='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;font-size:12px;color:#15803d;margin-top:4px;margin-bottom:12px">✅ هذه معاينة فقط — جرب الحقول!</div>';
  body+='<button class="btn bs" onclick="cM()" style="width:100%">إغلاق المعاينة</button>';

  window._pvFields=fields;
  oM('معاينة: '+r.title, body);
}

function pvRadioChange(inp){
  var name=inp.name;

  document.querySelectorAll('[name="'+name+'"]').forEach(function(r){
    if(r.dataset.subid){
      var box=document.getElementById(r.dataset.subid);
      if(box)box.style.display='none';
    }
    if(r.dataset.wrapid){
      var w=document.getElementById(r.dataset.wrapid);
      if(w)w.classList.remove('has-sub-open');
    }
  });

  if(inp.checked&&inp.dataset.hassub==='1'&&inp.dataset.subid){
    var myBox=document.getElementById(inp.dataset.subid);
    if(myBox){
      myBox.style.display='block';
      var fi=myBox.querySelector('input,textarea');
      if(fi)setTimeout(function(){fi.focus();},80);
    }
    if(inp.dataset.wrapid){
      var w2=document.getElementById(inp.dataset.wrapid);
      if(w2)w2.classList.add('has-sub-open');
    }
  }
}

function pvCheckChange(chk){
  if(chk.dataset.subid){
    var box=document.getElementById(chk.dataset.subid);
    if(box)box.style.display=chk.checked?'block':'none';
  }
  if(chk.dataset.wrapid){
    var w=document.getElementById(chk.dataset.wrapid);
    if(w)w.classList.toggle('has-sub-open',chk.checked);
  }
}

function pvHandleRadio(inp){pvRadioChange(inp);}

function pvHandleSelect(sel){
  pvShowSub(sel.dataset.pvfid, sel.value, 'pvsub_'+sel.id);
}

function pvShowSub(fieldDbId, selectedVal, subWrapId){
  var subWrap=document.getElementById(subWrapId);
  if(!subWrap)return;
  subWrap.innerHTML='';
  if(!selectedVal)return;

  var fields=window._pvFields||[];
  var f=fields.find(function(x){return String(x.id)===String(fieldDbId);});
  if(!f||!f.options)return;

  var opts=f.options;
  opts.forEach(function(opt){
    if(typeof opt!=='object'||!opt.has_sub)return;
    var ol=opt.label||'';
    if(ol!==selectedVal)return;
    var sub=opt.sub||{};
    if(!sub.label)return;
    var INP2='width:100%;padding:10px 12px;border:1.5px solid var(--blue);border-radius:9px;font-family:Cairo,sans-serif;font-size:14px;outline:none;background:#fff;margin-top:6px';
    var t2=sub.type==='number'?'number':sub.type==='date'?'date':sub.type==='phone'?'tel':'text';
    subWrap.innerHTML='<div class="pv-opt-sub">'
      +'<label style="display:block;font-size:12px;font-weight:700;color:var(--blue2);margin-bottom:5px">↳ '+sub.label+(sub.required?'<span style="color:var(--red)"> *</span>':'')+'</label>'
      +(sub.type==='textarea'
        ?'<textarea placeholder="'+(sub.placeholder||'')+'" style="'+INP2+';height:70px;resize:none"></textarea>'
        :'<input type="'+t2+'" placeholder="'+(sub.placeholder||'')+'" style="'+INP2+'">')
      +'</div>';
  });
}

function nomFormModal(fid){
  const revs=D.rev.filter(r=>r.role==='reviewer');
  oM('ترشيح استمارة',
    '<div style="margin-bottom:10px;font-size:13px;color:var(--mid)">اختر المراجع لترشيح الاستمارة له</div>'
    +revs.map(r=>'<div class="list-item" style="margin-bottom:6px;padding:10px 14px">'
      +'<div style="flex:1"><div style="font-weight:700">'+r.name+'</div><div class="ps">@'+r.username+'</div></div>'
      +'<button class="btn bp bsm" onclick="assignForm('+fid+','+r.id+')">ترشيح</button>'
      +'</div>').join('')
    +(revs.length?'':'<div class="empty-state">لا يوجد مراجعون</div>')
    +'<button class="btn bs" onclick="cM()" style="width:100%;margin-top:10px">إغلاق</button>');
}
async function assignForm(fid,uid){
  await api('POST','assignments',{form_id:fid,user_id:uid});
  toast('تم الترشيح ✅');
}

function pFol(){
  $h('pg','<div class="ph"><div><div class="pt">المتابعة</div><div class="ps">استمارات المراجعين</div></div></div><div id="sl2"></div>');
  rSubs();
}
function rSubs(){
  const c=$g('sl2');if(!c)return;
  const STATUS_COLORS={pending:'#fef3c7',reviewing:'#dbeafe',done:'#dcfce7',rejected:'#fee2e2'};
  if(!D.sub.length){c.innerHTML='<div class="empty-state">لا توجد استمارات</div>';return;}
  c.innerHTML=D.sub.map(s=>`
    <div class="card" style="border-right:4px solid ${STATUS_COLORS[s.status]||'#e2e8f0'};margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
        <div>
          <div style="font-weight:700">${s.form_title||'—'}</div>
          <div class="ps">👤 ${s.reviewer_name||''} • ${(s.created_at||'').slice(0,16)}</div>
          <div style="margin-top:5px">${bdg(s.status)}</div>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <button class="btn bs bsm" onclick="viewSub(${s.id})">👁️ عرض</button>
          ${s.status==='pending'?'<button class="btn bp bsm" onclick="uSub('+s.id+',\'reviewing\')">▶ مراجعة</button>':''}
          ${s.status==='reviewing'?'<button class="btn bp bsm" onclick="uSub('+s.id+',\'done\')">✔ مكتمل</button><button class="btn bd bsm" onclick="uSub('+s.id+',\'rejected\')">✕ رفض</button>':''}
        </div>
      </div>
    </div>`).join('');
}
async function uSub(id,st){ld(1);await api('PUT','submissions/'+id,{status:st});ld(0);toast('تم');await lSub();rSubs();}
async function viewSub(id){
  ld(1);const r=await api('GET','submissions/'+id);ld(0);
  if(r.error){toast(r.error,'er');return;}
  const ans=r.answers||[];
  oM('تفاصيل الاستمارة',
    '<div style="margin-bottom:12px"><div style="font-weight:700;font-size:15px">'+(r.form_title||'—')+'</div>'
    +'<div class="ps">👤 '+(r.reviewer_name||'')+'</div><div style="margin-top:5px">'+bdg(r.status)+'</div></div>'
    +(ans.map(a=>'<div style="padding:8px 12px;background:var(--bg);border-radius:8px;margin-bottom:6px"><div style="font-size:11px;font-weight:700;color:var(--mid)">'+(a.label||'—')+'</div><div style="font-size:14px;margin-top:2px">'+(a.answer||'—')+'</div></div>').join('')||'<div class="empty-state">لا توجد إجابات</div>')
    +'<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px">'
    +'<div class="f"><label>📝 ملاحظات داخلية (للدكتور)</label><textarea id="sub-in" placeholder="لا تظهر للمراجع...">'+(r.internal_notes||'')+'</textarea></div>'
    +'<div class="f"><label>💬 ملاحظات للمراجع</label><textarea id="sub-rv" placeholder="يراها المراجع...">'+(r.reviewer_notes||'')+'</textarea></div>'
    +'<div style="display:flex;gap:8px"><button class="btn bp" onclick="svSubNotes('+id+')">💾 حفظ</button><button class="btn bs" onclick="cM()">إغلاق</button></div>'
    +'</div>');
}
async function svSubNotes(id){
  ld(1);await api('PUT','submissions/'+id,{internal_notes:$g('sub-in')?.value||'',reviewer_notes:$g('sub-rv')?.value||''});ld(0);
  toast('تم ✅');cM();
}

let AT='appointments';
function pApt(){
  window.APT_TAB = window.APT_TAB||'calendar';
  window.APT_FILTER = window.APT_FILTER||'all';
  $h('pg',
    '<div class="ph"><div><div class="pt">📅 المواعيد</div><div class="ps">إدارة الجدول والحجوزات</div></div>'
    +'<button class="btn bp" onclick="oSlt()">+ فترة جديدة</button></div>'

    +'<div style="display:flex;gap:6px;margin-bottom:14px;background:#fff;padding:5px;border-radius:12px;border:1.5px solid var(--border)">'
    +'<button class="btn'+(window.APT_TAB==='calendar'?' bp':' bs')+'" style="flex:1" onclick="aptTab(\'calendar\')">📅 التقويم</button>'
    +'<button class="btn'+(window.APT_TAB==='bookings'?' bp':' bs')+'" style="flex:1" onclick="aptTab(\'bookings\')">📋 الحجوزات</button>'
    +'<button class="btn'+(window.APT_TAB==='slots'?' bp':' bs')+'" style="flex:1" onclick="aptTab(\'slots\')">⚙️ الفترات</button>'
    +'</div>'
    +'<div id="ab"></div>');
  rAptContent();
}

function aptTab(t){
  window.APT_TAB=t;
  var pg=$g('pg');if(pg){pg.className='';void pg.offsetWidth;pg.className='pg-anim';}
  pApt();
}

function rAptContent(){
  var c=$g('ab');if(!c)return;
  if(window.APT_TAB==='calendar') rAptCalendar();
  else if(window.APT_TAB==='bookings') rAptBookings();
  else rAptSlots();
}

var APT_CAL_DATE = new Date();
function rAptCalendar(){
  var c=$g('ab');if(!c)return;
  var y=APT_CAL_DATE.getFullYear();
  var m=APT_CAL_DATE.getMonth();
  var today=new Date().toISOString().slice(0,10);
  var AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var AR_DAYS=['ح','ن','ث','ر','خ','ج','س'];
  var firstDay=new Date(y,m,1).getDay();
  var daysInMonth=new Date(y,m+1,0).getDate();
  var h='';

  h+='<div class="apt-cal-nav">';
  h+='<button class="apt-cal-nav-btn" onclick="aptCalMove(-1)">&#8250; السابق</button>';
  h+='<div style="font-weight:800;font-size:15px;color:var(--text)">'+AR_MONTHS[m]+' '+y+'</div>';
  h+='<button class="apt-cal-nav-btn" onclick="aptCalMove(1)">التالي &#8249;</button>';
  h+='</div>';

  h+='<div class="apt-cal-grid">';
  AR_DAYS.forEach(function(d){h+='<div class="apt-cal-day-hdr">'+d+'</div>';});

  for(var i=0;i<firstDay;i++) h+='<div class="apt-cal-cell empty"></div>';

  for(var d2=1;d2<=daysInMonth;d2++){
    var dateStr=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d2).padStart(2,'0');
    var isPast=dateStr<today;
    var isToday=dateStr===today;
    var daySlots=D.dts.filter(function(dt){return dt.date===dateStr;});
    var cls='apt-cal-cell'+(isToday?' today':'')+(isPast?' past':'');
    h+='<div class="'+cls+'" data-day="'+dateStr+'">';
    h+='<div class="apt-cal-num">'+d2+'</div>';
    daySlots.slice(0,3).forEach(function(s){
      var st=s.status==='booked'?'booked':s.status;
      h+='<span class="apt-pill '+st+'" title="'+s.slot_name+'">'+s.slot_name+'</span>';
    });
    if(daySlots.length>3) h+='<span class="apt-pill" style="background:#e2e8f0;color:var(--mid)">+'+(daySlots.length-3)+'</span>';
    h+='</div>';
  }
  h+='</div>';

  h+='<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
  h+='<button class="btn bp" onclick="oDt()">+ إضافة يوم</button>';
  h+='<button class="btn bs" onclick="oDtBatch()">📅 إضافة دفعة</button>';
  h+='<button class="btn" style="background:var(--apt-exceptional);color:var(--apt-exceptional-b);border:none" onclick="oExceptional()">⭐ حجز استثنائي</button>';
  h+='</div>';

  h+='<div id="apt-day-detail"></div>';
  c.innerHTML=h;

  c.querySelectorAll('[data-day]').forEach(function(el){
    el.addEventListener('click',function(){aptCalDayClick(this.dataset.day);});
  });
}

function aptCalMove(dir){
  APT_CAL_DATE.setMonth(APT_CAL_DATE.getMonth()+dir);
  rAptCalendar();
}

function aptCalDayClick(dateStr){

  var slots=D.dts.filter(function(d){return d.date===dateStr;});
  var apts=D.apt.filter(function(a){return a.date===dateStr;});
  var dd=$g('apt-day-detail');if(!dd)return;

  document.querySelectorAll('.apt-cal-cell').forEach(function(el){el.classList.remove('selected');});
  var h='<div style="background:#fff;border:1.5px solid var(--blue);border-radius:12px;padding:14px;margin-top:4px">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h+='<div style="font-weight:800;font-size:14px">📅 '+dateStr+'</div>';
  h+='<div style="display:flex;gap:6px">';
  h+='<button class="btn bp bsm" data-dtfor="'+dateStr+'">+ إضافة فترة</button>';
  h+='<button class="btn bs bsm" data-closedd="1">✕</button>';
  h+='</div></div>';
  if(!slots.length){
    h+='<div style="text-align:center;color:var(--light);padding:16px">لا توجد فترات لهذا اليوم</div>';
  } else {
    slots.forEach(function(s){
      var apt=apts.find(function(a){return a.date_id==s.id;});
      var stCls=s.status==='booked'?'booked':s.status;
      h+='<div class="rv-slot-row '+stCls+'" style="margin-bottom:7px">';
      h+='<div>';
      h+='<div style="font-weight:700;font-size:13px">'+s.slot_name+'</div>';
      if(apt){
        h+='<div class="ps">👤 '+(apt.reviewer_name||'—')+'</div>';
        h+='<div style="margin-top:3px"><span class="apt-badge '+apt.status+'">'+aptStatusLabel(apt.status)+'</span></div>';
      }
      h+='</div>';
      h+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">';
      if(s.status==='available') h+='<button class="btn bs bsm" data-tdt="'+s.id+'" data-tdtst="locked">🔒 إغلاق</button>';
      if(s.status==='locked') h+='<button class="btn bs bsm" data-tdt="'+s.id+'" data-tdtst="available">🔓 فتح</button>';
      if(apt&&apt.status==='pending') h+='<button class="btn bp bsm" data-uapt="'+apt.id+'" data-uaptst="confirmed">✔ تأكيد</button>';
      if(apt&&['pending','confirmed'].includes(apt.status)) h+='<button class="btn bd bsm" data-uapt="'+apt.id+'" data-uaptst="cancelled_admin">✕ إلغاء</button>';
      h+='<button class="ib id" style="width:26px;height:26px" data-deldt="'+s.id+'">'+SVG.del+'</button>';
      h+='</div></div>';
    });
  }
  h+='</div>';
  dd.innerHTML=h;
  dd.scrollIntoView({behavior:'smooth',block:'nearest'});

  dd.querySelectorAll('[data-dtfor]').forEach(function(btn){
    btn.addEventListener('click',function(){oDtFor(btn.dataset.dtfor);});
  });
  dd.querySelectorAll('[data-closedd]').forEach(function(btn){
    btn.addEventListener('click',function(){dd.innerHTML='';});
  });
  dd.querySelectorAll('[data-tdt]').forEach(function(btn){
    btn.addEventListener('click',function(){tDtStatus(+btn.dataset.tdt,btn.dataset.tdtst);});
  });
  dd.querySelectorAll('[data-deldt]').forEach(function(btn){
    btn.addEventListener('click',function(){if(confirmDel('حذف هذه الفترة؟'))delDt(+btn.dataset.deldt);});
  });
  dd.querySelectorAll('[data-uapt]').forEach(function(btn){
    btn.addEventListener('click',function(){
      uApt(+btn.dataset.uapt,btn.dataset.uaptst).then(function(){
        var d=btn.closest('[data-date]');
        if(d)aptCalDayClick(d.dataset.date);
      });
    });
  });
}

function aptStatusLabel(s){
  var m={available:'متاح',pending:'بانتظار التأكيد',confirmed:'مؤكد',
    booked:'محجوز',completed:'مكتمل',locked:'مغلق',
    exceptional:'استثنائي',cancelled_admin:'ألغته الإدارة',
    cancelled_reviewer:'ألغاه المراجع'};
  return m[s]||s;
}

function rAptBookings(){
  var c=$g('ab');if(!c)return;
  var f=window.APT_FILTER||'all';
  var allApts=D.apt;
  var filtered=f==='all'?allApts:allApts.filter(function(a){return a.status===f;});
  var counts={all:allApts.length,pending:0,confirmed:0,completed:0};
  allApts.forEach(function(a){if(counts[a.status]!==undefined)counts[a.status]++;});
  var h='';

  h+='<div class="apt-filter-wrap">';
  [['all','الكل',counts.all],['pending','بانتظار التأكيد',counts.pending],
   ['confirmed','مؤكد',counts.confirmed],['completed','مكتمل',counts.completed]].forEach(function(x){
    h+='<button class="apt-filter-btn'+(f===x[0]?' on':'')+'" data-aptfilter="'+x[0]+'">'+x[1]+(x[2]?' ('+x[2]+')':'')+'</button>';
  });
  h+='</div>';
  if(!filtered.length){
    h+='<div class="empty-state">لا توجد حجوزات</div>';
    c.innerHTML=h;return;
  }

  filtered.sort(function(a,b){
    if(a.status==='pending'&&b.status!=='pending')return -1;
    if(b.status==='pending'&&a.status!=='pending')return 1;
    return (b.created_at||'').localeCompare(a.created_at||'');
  });
  filtered.forEach(function(a){
    var isExc=a.is_exceptional;
    h+='<div class="apt-card '+a.status+(isExc?' exceptional':'')+'">';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:4px">';
    h+='<div style="font-weight:800;font-size:14px">'+(a.reviewer_name||'—')+'</div>';
    if(isExc) h+='<span class="apt-badge exceptional">⭐ استثنائي</span>';
    h+='<span class="apt-badge '+a.status+'">'+aptStatusLabel(a.status)+'</span>';
    h+='</div>';
    h+='<div class="ps" style="display:flex;gap:10px;flex-wrap:wrap">';
    h+='<span>📞 '+(a.phone||'—')+'</span>';
    h+='<span>📅 '+(a.date||'—')+'</span>';
    h+='<span>⏰ '+(a.slot_name||'—')+'</span>';
    h+='</div>';
    if(a.notes) h+='<div style="font-size:11px;color:var(--mid);margin-top:4px;background:#f8fafd;padding:4px 8px;border-radius:6px">📝 '+a.notes+'</div>';
    h+='</div>';
    h+='<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">';
    if(a.status==='pending') h+='<button class="btn bp bsm" data-uaptid="'+a.id+'" data-uaptst="confirmed">✔ تأكيد</button>';
    if(a.status==='confirmed') h+='<button class="btn bs bsm" data-uaptid="'+a.id+'" data-uaptst="completed">⏹ إنهاء</button>';
    if(['pending','confirmed'].includes(a.status)){
      h+='<button class="btn bs bsm" data-chgapt="'+a.id+'">📅 تغيير</button>';
      h+='<button class="btn bd bsm" data-uaptid="'+a.id+'" data-uaptst="cancelled_admin">✕ إلغاء</button>';
    }
    h+='</div></div>';
  });
  c.innerHTML=h;

  c.querySelectorAll('[data-aptfilter]').forEach(function(btn){
    btn.addEventListener('click',function(){aptFilter(btn.dataset.aptfilter);});
  });
  c.querySelectorAll('[data-uaptid]').forEach(function(btn){
    btn.addEventListener('click',function(){uApt(+btn.dataset.uaptid,btn.dataset.uaptst);});
  });
  c.querySelectorAll('[data-chgapt]').forEach(function(btn){
    btn.addEventListener('click',function(){changeApt(+btn.dataset.chgapt);});
  });
}

function aptFilter(f){window.APT_FILTER=f;rAptBookings();}

function rAptSlots(){
  var c=$g('ab');if(!c)return;
  var h='<div style="display:flex;justify-content:flex-end;margin-bottom:10px">';
  h+='<button class="btn bp" onclick="oSlt()">+ إضافة فترة</button></div>';
  if(!D.slt.length){h+='<div class="empty-state">لا توجد فترات</div>';c.innerHTML=h;return;}
  h+='<div class="fields-wrap">';
  D.slt.forEach(function(s,i){
    h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:'+(i%2===0?'#fff':'#f9fbff')+';'+(i>0?'border-top:1px solid var(--border)':'')+'";>';
    h+='<div style="font-size:20px">⏰</div>';
    h+='<div style="flex:1"><div style="font-weight:700;font-size:14px">'+s.name+'</div>';
    h+='<div class="ps">'+(s.time_from?s.time_from.slice(0,5)+' — '+s.time_to.slice(0,5):'نصية فقط')+'</div></div>';
    h+='<span class="apt-badge '+(s.status==='open'?'available':'locked')+'">'+(s.status==='open'?'نشط':'موقوف')+'</span>';
    h+='<div style="display:flex;gap:5px">';
    h+='<button class="ib ie" style="width:30px;height:30px" data-editslt="'+s.id+'">'+SVG.edit+'</button>';
    h+='<button class="ib id" style="width:30px;height:30px" data-delslt="'+s.id+'">'+SVG.del+'</button>';
    h+='</div></div>';
  });
  h+='</div>';
  c.innerHTML=h;
  c.querySelectorAll('[data-editslt]').forEach(function(btn){
    btn.addEventListener('click',function(){oSlt(+btn.dataset.editslt);});
  });
  c.querySelectorAll('[data-delslt]').forEach(function(btn){
    btn.addEventListener('click',function(){if(confirmDel('حذف الفترة؟'))dSlt(+btn.dataset.delslt);});
  });
}

async function uApt(id,st){
  if(st==='cancelled_admin'&&!confirmDel('إلغاء الموعد؟'))return;
  ld(1);const r=await api('PUT','appointments/'+id,{status:st});ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تم ✅');await lApt();await lDts();rAptContent();
}

function oSlt(id){
  const s=id?D.slt.find(x=>x.id==id):null;
  oM((s?'تعديل':'إضافة')+' فترة',
    '<div class="f"><label>اسم الفترة *</label>'
    +'<input id="slnm" class="fr-inp" value="'+(s?.name||'')+'" placeholder="مثال: بعد العصر"></div>'
    +'<div class="f"><label>وقت البداية (نص أو ساعة)</label>'
    +'<input id="slf" class="fr-inp" value="'+(s?.time_from||'')+'" placeholder="مثال: 16:00 أو بعد العصر"></div>'
    +'<div class="f"><label>وقت النهاية (اختياري)</label>'
    +'<input id="slt2" class="fr-inp" value="'+(s?.time_to||'')+'" placeholder="مثال: 18:00"></div>'
    +'<div style="display:flex;gap:9px;margin-top:6px">'
    +'<button class="btn bp" onclick="svSlt('+(id||0)+')">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

async function svSlt(id){
  const n=($g('slnm')?.value||'').trim();
  if(!n){toast('اسم الفترة مطلوب','er');return;}
  const b={name:n,time_from:$g('slf')?.value||'',time_to:$g('slt2')?.value||'',status:'open'};
  ld(1);const r=id?await api('PUT','slots/'+id,b):await api('POST','slots',b);ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تم ✅');cM();await lSlt();rAptContent();
}

async function dSlt(id){
  ld(1);await api('DELETE','slots/'+id);ld(0);
  toast('تم الحذف');await lSlt();rAptContent();
}

function oDt(){
  const so=D.slt.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  if(!D.slt.length){toast('أضف فترات أولاً','er');return;}
  oM('إضافة يوم متاح',
    '<div class="f"><label>الفترة *</label>'
    +'<select id="dtsl" class="fr-inp">'+so+'</select></div>'
    +'<div class="f"><label>التاريخ *</label>'
    +'<input id="dtd" class="fr-inp" type="date" min="'+new Date().toISOString().slice(0,10)+'"></div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svDt()">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

function oDtFor(dateStr){
  const so=D.slt.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  if(!D.slt.length){toast('أضف فترات أولاً','er');return;}
  oM('إضافة فترة ليوم '+dateStr,
    '<div class="f"><label>الفترة *</label>'
    +'<select id="dtsl" class="fr-inp">'+so+'</select></div>'
    +'<input type="hidden" id="dtd" value="'+dateStr+'">'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svDt()">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

function oDtBatch(){
  const so=D.slt.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  if(!D.slt.length){toast('أضف فترات أولاً','er');return;}
  const today=new Date().toISOString().slice(0,10);
  const d30=new Date();d30.setDate(d30.getDate()+30);
  oM('إضافة دفعة أيام',
    '<div class="f"><label>الفترة *</label>'
    +'<select id="dtsl" class="fr-inp">'+so+'</select></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +'<div class="f"><label>من</label><input id="dt-from" class="fr-inp" type="date" min="'+today+'" value="'+today+'"></div>'
    +'<div class="f"><label>إلى</label><input id="dt-to" class="fr-inp" type="date" min="'+today+'" value="'+d30.toISOString().slice(0,10)+'"></div></div>'
    +'<div class="f"><label>أيام الأسبوع</label>'
    +'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">'
    +['ح','ن','ث','ر','خ','ج','س'].map((d,i)=>'<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;background:#fff"><input type="checkbox" id="dw'+i+'" '+(i<5?'checked':'')+' style="accent-color:var(--blue)"> '+d+'</label>').join('')
    +'</div></div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svDtBatch()">✅ إضافة</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

async function svDt(){
  const sl=$g('dtsl')?.value,dt=$g('dtd')?.value;
  if(!sl||!dt){toast('أدخل الفترة والتاريخ','er');return;}
  ld(1);const r=await api('POST','dates',{slot_id:+sl,date:dt,status:'available'});ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تمت الإضافة ✅');cM();await lDts();rAptContent();
}

async function svDtBatch(){
  const sl=$g('dtsl')?.value,from=$g('dt-from')?.value,to=$g('dt-to')?.value;
  if(!sl||!from||!to){toast('أدخل جميع البيانات','er');return;}
  const days=[0,1,2,3,4,5,6].filter(i=>$g('dw'+i)?.checked);
  const dates=[];let cur=new Date(from);const end=new Date(to);
  while(cur<=end){if(days.includes(cur.getDay()))dates.push(cur.toISOString().slice(0,10));cur.setDate(cur.getDate()+1);}
  if(!dates.length){toast('لا توجد أيام مطابقة','er');return;}
  ld(1);const r=await api('POST','dates',{slot_id:+sl,dates,status:'available'});ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('تمت إضافة '+dates.length+' يوم ✅');cM();await lDts();rAptContent();
}

async function tDtStatus(id,newStatus){
  ld(1);await api('PUT','dates/'+id,{status:newStatus});ld(0);
  await lDts();rAptContent();
}

async function tDt(id,cur){await tDtStatus(id,cur==='available'?'locked':'available');}

async function toggleAllDay(date,allOpen){
  ld(1);
  await Promise.all(D.dts.filter(d=>d.date===date&&d.status!=='booked').map(s=>api('PUT','dates/'+s.id,{status:allOpen?'locked':'available'})));
  ld(0);await lDts();rAptContent();
}

async function delDt(id){
  ld(1);await api('DELETE','dates/'+id);ld(0);
  toast('تم الحذف');await lDts();rAptContent();
}

function changeApt(id){
  const av=D.dts.filter(d=>d.status==='available');
  oM('تغيير الموعد',
    (av.length
      ? av.map(d=>'<div class="rv-slot-row available" style="margin-bottom:6px">'
          +'<div><div style="font-weight:700">'+d.slot_name+'</div>'
          +'<div class="ps">'+d.date+'</div></div>'
          +'<button class="btn bp bsm" onclick="confirmChangeApt('+id+','+d.id+')">اختيار</button></div>').join('')
      : '<div class="empty-state">لا توجد مواعيد متاحة</div>')
    +'<button class="btn bs" onclick="cM()" style="width:100%;margin-top:10px">إلغاء</button>');
}

async function confirmChangeApt(aptId,newDateId){
  const apt=D.apt.find(a=>a.id==aptId);
  ld(1);
  if(apt?.date_id) await api('PUT','dates/'+apt.date_id,{status:'available'});
  await api('PUT','appointments/'+aptId,{status:'confirmed'});
  await api('PUT','dates/'+newDateId,{status:'booked'});
  ld(0);toast('تم تغيير الموعد ✅');cM();await lApt();await lDts();rAptContent();
}

function oExceptional(){
  const revs=D.rev.filter(r=>r.role==='reviewer');
  const so=D.slt.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  const ro=revs.map(r=>'<option value="'+r.id+'">'+r.name+'</option>').join('');
  const today=new Date().toISOString().slice(0,10);
  oM('⭐ حجز استثنائي',
    '<div class="apt-notice">الحجز الاستثنائي يظهر للمراجع مع إشعار مميز</div>'
    +'<div class="f"><label>المراجع *</label><select id="exc-rv" class="fr-inp">'+ro+'</select></div>'
    +'<div class="f"><label>الفترة *</label><select id="exc-sl" class="fr-inp">'+so+'</select></div>'
    +'<div class="f"><label>التاريخ *</label><input id="exc-dt" class="fr-inp" type="date" min="'+today+'"></div>'
    +'<div class="f"><label>ملاحظة</label><input id="exc-nt" class="fr-inp" placeholder="سبب الحجز الاستثنائي..."></div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svExceptional()">✅ تأكيد الحجز</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
}

async function svExceptional(){
  const rv=$g('exc-rv')?.value,sl=$g('exc-sl')?.value,dt=$g('exc-dt')?.value,nt=$g('exc-nt')?.value||'';
  if(!rv||!sl||!dt){toast('أدخل جميع البيانات','er');return;}
  ld(1);

  let dateId=null;
  const existing=D.dts.find(d=>d.slot_id==sl&&d.date===dt);
  if(existing){dateId=existing.id;}
  else{
    const dr=await api('POST','dates',{slot_id:+sl,date:dt,status:'booked'});
    if(dr.error){ld(0);toast(dr.error,'er');return;}
    dateId=dr.id;
  }

  const ar=await api('POST','appointments',{reviewer_id:+rv,date_id:dateId,status:'confirmed',notes:nt,is_exceptional:1});
  ld(0);
  if(ar.error){toast(ar.error,'er');return;}

  if(existing) await api('PUT','dates/'+dateId,{status:'booked'});
  toast('تم الحجز الاستثنائي ✅');cM();await lApt();await lDts();rAptContent();
}

async function lApt(){const r=await api('GET','appointments');D.apt=Array.isArray(r)?r:[];}
async function lSlt(){const r=await api('GET','slots');D.slt=Array.isArray(r)?r:[];}
async function lDts(){const r=await api('GET','dates');D.dts=Array.isArray(r)?r:[];}
async function lPub(){const r=await api('GET','publications');D.pub=Array.isArray(r)?r:[];}
async function lCvs(){const r=await api('GET','messages');D.cvs=Array.isArray(r)?r:[];}

function pSet(){
  var op  = D.cfg && D.cfg.site_closed === '1';
  var spOp= !D.cfg || D.cfg.allow_special_login !== '0';
  var regOp=D.cfg && D.cfg.allow_registration === '1';
  var txtKeys=[
    ['site_name','اسم المنصة'],
    ['login_app_title','عنوان صفحة الدخول'],
    ['site_closed_message','رسالة الإغلاق'],
    ['welcome_message','رسالة الترحيب']
  ];

  function togRow(id,lbl,desc,active,key){
    var bg=active?'var(--blue)':'#cbd5e1';
    var lft=active?'21px':'3px';
    var sbg=active?'#dcfce7':'#fee2e2';
    var sclr=active?'#15803d':'#dc2626';
    return '<div style="display:flex;align-items:center;justify-content:space-between;'
      +'padding:12px 14px;border-radius:10px;background:var(--bg);margin-bottom:7px">'
      +'<div style="display:flex;align-items:center;gap:11px">'
      +'<button id="'+id+'" class="tog" data-key="'+key+'" data-v="'+(active?'1':'0')+'" style="background:'+bg+'" type="button">'
      +'<div class="tok" style="left:'+lft+'"></div></button>'
      +'<div><div style="font-weight:700;font-size:13px">'+lbl+'</div>'
      +'<div style="font-size:11px;color:var(--mid)">'+desc+'</div></div></div>'
      +'<span id="'+id+'_lbl" style="background:'+sbg+';color:'+sclr+';padding:2px 10px;'
      +'border-radius:20px;font-size:11px;font-weight:700">'+(active?'مفعّل':'معطّل')+'</span>'
      +'</div>';
  }

  var txtHtml='';
  txtKeys.forEach(function(kl){
    var k=kl[0],l=kl[1];
    txtHtml+='<div class="f">'
      +'<label style="display:flex;justify-content:space-between">'
      +'<span>'+l+'</span><span style="font-size:10px;color:var(--light)">'+k+'</span></label>'
      +'<input data-cfg="'+k+'" class="fr-inp" value="'+((D.cfg&&D.cfg[k])||'').replace(/"/g,'&quot;')+'">'
      +'</div>';
  });

  $h('pg',
    '<div class="ph"><div><div class="pt">⚙️ الإعدادات</div></div>'
    +'<button class="btn bp" onclick="svCfg()">💾 حفظ النصوص</button></div>'

    +'<div class="card" style="margin-bottom:10px">'
    +'<div style="font-weight:800;font-size:13px;margin-bottom:12px;color:var(--text)">🔐 حالة الموقع</div>'
    +togRow('stg1','إغلاق الموقع','يمنع الدخول عن جميع الزوار',op,'site_closed')
    +togRow('stg2','الدخول الخاص','يسمح لمن لديه صلاحية بالدخول حتى لو الموقع مغلق',spOp,'allow_special_login')
    +togRow('stg3','فتح التسجيل','السماح بإنشاء حسابات جديدة',regOp,'allow_registration')
    +'<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:9px;padding:10px 12px;margin-top:10px">'
    +'<div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:4px">🔗 رابط الدخول المباشر للإدارة</div>'
    +'<code style="font-size:11px;color:#1d4ed8;word-break:break-all">'+
    (typeof location!=='undefined'?location.origin+location.pathname:'')+'?admin=1</code>'
    +'<div style="font-size:11px;color:var(--mid);margin-top:3px">يعمل حتى عند إغلاق الموقع</div>'
    +'</div></div>'

    +'<div class="card"><div style="font-weight:800;font-size:13px;margin-bottom:12px">📝 النصوص</div>'
    +txtHtml+'</div>');

  setTimeout(function(){
    ['stg1','stg2','stg3'].forEach(function(id){
      var btn=document.getElementById(id);
      if(!btn)return;
      btn.addEventListener('click',function(e){
        e.preventDefault();
        var nv = btn.dataset.v==='1' ? '0' : '1';

        btn.dataset.v=nv;
        btn.style.background=nv==='1'?'var(--blue)':'#cbd5e1';
        var tok=btn.querySelector('.tok');
        if(tok) tok.style.left=nv==='1'?'21px':'3px';
        var lbl=document.getElementById(id+'_lbl');
        if(lbl){
          lbl.textContent=nv==='1'?'مفعّل':'معطّل';
          lbl.style.background=nv==='1'?'#dcfce7':'#fee2e2';
          lbl.style.color=nv==='1'?'#15803d':'#dc2626';
        }

        var key=btn.dataset.key;
        var body={};body[key]=nv;
        api('POST','settings',body).then(function(r){
          if(r&&r.error){toast(r.error,'er');}
          else{
            if(!D.cfg)D.cfg={};
            D.cfg[key]=nv;
            toast('تم حفظ '+key+' ✅');
          }
        });
      });
    });
  },50);
}

async function svCfg(){
  var d={};
  document.querySelectorAll('[data-cfg]').forEach(function(inp){
    if(inp.dataset.cfg) d[inp.dataset.cfg]=inp.value.trim();
  });
  ld(1);var r=await api('POST','settings',d);ld(0);
  if(r&&r.error){toast(r.error,'er');return;}
  if(!D.cfg)D.cfg={};
  Object.assign(D.cfg,d);
  toast('تم حفظ النصوص ✅');
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

function shAuth(forceAdmin){
  $g('dash').className='';$g('rev-dash').className='';
  const cfg=D.cfg||{};
  const closed=cfg.site_closed==='1';
  if(closed&&!forceAdmin){
    $g('auth').innerHTML='<div class="ac" style="text-align:center"><div style="font-size:48px;margin-bottom:14px">🔒</div><div style="font-size:18px;font-weight:800;margin-bottom:8px">الموقع مغلق</div><p style="color:var(--mid);margin-bottom:20px">'+(cfg.site_closed_message||'الموقع مغلق مؤقتاً')+'</p></div>';
    $g('auth').className='on';return;
  }
  $g('auth').innerHTML=
    '<div class="ac"><div class="auth-icon">🛡️</div>'
    +'<div class="at">'+(cfg.login_app_title||'منصة الاستشارات الخاصة')+'</div>'
    +'<div id="le" class="err-box" style="display:none"></div>'
    +'<div class="f"><label>رقم الجوال أو اسم المستخدم</label>'
    +'<div class="inp-wrap"><input id="lp" placeholder="أدخل بياناتك" autocomplete="username" inputmode="text">'
    +'<span class="inp-ico">📞</span></div></div>'
    +'<div class="f"><label>كلمة المرور</label>'
    +'<div class="inp-wrap"><input id="lw" type="password" placeholder="••••••••" autocomplete="current-password">'
    +'<span class="inp-ico">🔒</span>'
    +'<span class="inp-ico-l" id="eye" onclick="const i=$g(\'lw\');i.type=i.type===\'password\'?\'text\':\'password\';this.textContent=i.type===\'password\'?\'👁️\':\'🙈\'">👁️</span>'
    +'</div></div>'
    +'<button class="auth-btn" id="lb" onclick="doL()">تسجيل الدخول</button></div>';
  $g('auth').className='on';
  $g('lp').onkeydown=e=>{if(e.key==='Enter')$g('lw').focus();};
  $g('lw').onkeydown=e=>{if(e.key==='Enter')doL();};
}
async function doL(){
  const p=($g('lp')?.value||'').trim(),w=$g('lw')?.value;
  const e=$g('le'),b=$g('lb');
  if(!p||!w){if(e){e.textContent='أدخل جميع البيانات';e.style.display='block';}return;}
  if(b){b.disabled=true;b.innerHTML='<span class="spin"></span>';}
  const r=await api('POST','login',{phone:p,password:w});
  if(b){b.disabled=false;b.textContent='تسجيل الدخول';}
  if(r.token){TK=r.token;U=r.user;localStorage.setItem('tk',TK);r.user.role==='admin'?shDash():shRev();}
  else{if(e){e.textContent=r.error||'بيانات خاطئة';e.style.display='block';}}
}
async function shDash(){
  $g('auth').className='';
  $g('rev-dash').className='';
  $g('dash').className='on';
  buildNav(ADM_NAVS,'bnav','gT',NAV);
  // عرض الصفحة الرئيسية فوراً بالبيانات الموجودة
  gT('home');
  // تحميل البيانات في الخلفية
  lAll().then(function(){ gT('home'); }).catch(function(){});
}
async function shRev(){
  $g('auth').className='';
  $g('dash').className='';
  $g('rev-dash').className='on';
  $h('rv-name','أهلاً '+(U&&U.name||''));
  buildNav(REV_NAVS,'rev-bnav','rvGo',RV_NAV);
  rvGo('home');
  Promise.all([lFrm(),lSec(),lDts(),lSlt(),lPub(),lCvs()])
    .then(function(){ rvGo('home'); })
    .catch(function(){});
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
    try{
      const parts=TK.split('.');
      if(parts.length===3){
        const pl=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
        if(pl.exp>Date.now()/1000){
          const me=await api('GET','me');
          if(me&&me.id&&!me.error){
            U=Object.assign({},me,{role:pl.role});
            if(pl.role==='admin'){
              await shDash();
              return;
            } else {
              await shRev();
              return;
            }
          }
        }
      }
    }catch(ex){console.log('init error',ex);}

    TK=null;localStorage.removeItem('tk');
  }
  shAuth(forceAdmin);
}
async function rvAppointments(){
  ld(1);
  const [myR,allDatesR]=await Promise.all([api('GET','appointments'),api('GET','dates')]);
  ld(0);
  const myApts=Array.isArray(myR)?myR:[];
  const allDates=Array.isArray(allDatesR)?allDatesR:[];
  const availDates=allDates.filter(d=>d.status==='available');
  const hasActive=myApts.some(a=>['pending','confirmed'].includes(a.status));
  const today=new Date().toISOString().slice(0,10);

  let h='<div class="pt" style="margin-bottom:14px">📅 المواعيد</div>';

  h+='<div class="apt-notice">💡 يتم تأكيد المواعيد في نفس اليوم بعد الظهر. يمكنك إلغاء حجزك قبل التأكيد.</div>';

  const activApts=myApts.filter(a=>['pending','confirmed'].includes(a.status));
  const pastApts=myApts.filter(a=>!['pending','confirmed'].includes(a.status));

  if(activApts.length){
    h+='<div style="font-weight:800;font-size:13px;margin-bottom:8px;color:var(--blue2)">مواعيدي النشطة</div>';
    activApts.forEach(a=>{
      const isExc=a.is_exceptional;
      h+='<div class="rv-apt-card active-apt'+(isExc?' exceptional':'')+'">';
      h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">';
      h+='<div>';
      if(isExc) h+='<div style="margin-bottom:5px"><span class="apt-badge exceptional">⭐ حجز استثنائي</span></div>';
      h+='<div style="font-weight:800;font-size:15px;margin-bottom:3px">'+(a.slot_name||'—')+'</div>';
      h+='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      h+='<span class="ps">📅 '+(a.date||'—')+'</span>';
      h+='<span class="apt-badge '+a.status+'">'+rvAptLabel(a.status)+'</span>';
      h+='</div>';
      if(a.notes) h+='<div style="font-size:12px;color:var(--mid);margin-top:6px;background:rgba(255,255,255,.7);padding:5px 8px;border-radius:7px">📝 '+a.notes+'</div>';
      h+='</div>';
      if(a.status==='pending'){
        h+='<button class="btn bd bsm" onclick="rvCancelApt('+a.id+')">إلغاء الحجز</button>';
      }
      h+='</div></div>';
    });
  }

  h+='<div style="font-weight:800;font-size:13px;margin:14px 0 8px;color:var(--blue2)">الجدول المتاح</div>';

  if(hasActive){
    h+='<div style="background:#fff3cd;border:1px solid #fcd34d;border-radius:10px;padding:12px 14px;font-size:13px;color:#92400e">';
    h+='⚠️ لديك موعد نشط. يمكنك حجز موعد آخر بعد إتمامه أو إلغائه.</div>';
  } else if(availDates.length){

    const grouped={};
    availDates.forEach(d=>{if(!grouped[d.date])grouped[d.date]=[];grouped[d.date].push(d);});
    const sorted=Object.entries(grouped).sort(([a],[b])=>a<b?-1:1);
    sorted.forEach(([date,slots])=>{
      const isToday=date===today;
      const dt=new Date(date);
      const dayNames=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      const dayName=dayNames[dt.getDay()];
      h+='<div style="margin-bottom:10px">';
      h+='<div style="font-weight:700;font-size:12px;color:var(--mid);margin-bottom:5px;display:flex;align-items:center;gap:7px">';
      h+='<span>📅 '+dayName+'  '+date+'</span>';
      if(isToday) h+='<span style="background:var(--blue);color:#fff;padding:1px 8px;border-radius:10px;font-size:10px">اليوم</span>';
      h+='</div>';
      slots.forEach(s=>{
        h+='<div class="rv-slot-row available" style="margin-bottom:5px">';
        h+='<div>';
        h+='<div style="font-weight:700;font-size:14px">'+s.slot_name+'</div>';
        if(s.time_from) h+='<div class="ps">'+s.time_from.slice(0,5)+' — '+(s.time_to||'').slice(0,5)+'</div>';
        h+='</div>';
        h+='<button class="btn bp" style="min-width:80px" onclick="rvBook('+s.id+')">📌 حجز</button>';
        h+='</div>';
      });
      h+='</div>';
    });
  } else {
    h+='<div class="empty-state"><div style="font-size:32px;margin-bottom:8px">📅</div><p>لا توجد مواعيد متاحة حالياً</p></div>';
  }

  if(pastApts.length){
    h+='<div style="font-weight:800;font-size:13px;margin:14px 0 8px;color:var(--mid)">السجل</div>';
    h+='<div class="fields-wrap">';
    pastApts.slice(0,5).forEach((a,i)=>{
      h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;'+(i>0?'border-top:1px solid var(--border)':'')+'background:'+(i%2===0?'#fff':'#f9fbff')+'">';
      h+='<div><div style="font-weight:600;font-size:13px">'+(a.slot_name||'—')+'  '+a.date+'</div></div>';
      h+='<span class="apt-badge '+a.status+'">'+rvAptLabel(a.status)+'</span>';
      h+='</div>';
    });
    h+='</div>';
  }

  $h('rv-pg',h);
}

function rvAptLabel(s){
  const m={pending:'⏳ بانتظار التأكيد',confirmed:'✅ مؤكد',completed:'🏁 مكتمل',
    booked:'📌 محجوز',locked:'🔒 مغلق',exceptional:'⭐ استثنائي',
    cancelled_admin:'❌ ألغته الإدارة',cancelled_reviewer:'↩️ ألغيته'};
  return m[s]||s;
}

async function rvBook(dateId){
  if(!confirm('تأكيد حجز هذا الموعد؟\n\nسيتم التأكيد من قبل الإدارة في نفس اليوم.'))return;
  ld(1);const r=await api('POST','appointments',{date_id:+dateId});ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('✅ تم الحجز — بانتظار التأكيد');

  await Promise.all([lApt(),lDts()]);
  rvAppointments();
}

async function rvCancelApt(id){
  if(!confirm('إلغاء هذا الموعد؟'))return;
  ld(1);await api('PUT','appointments/'+id,{status:'cancelled_reviewer'});ld(0);
  toast('تم الإلغاء');
  await Promise.all([lApt(),lDts()]);
  rvAppointments();
}

init();