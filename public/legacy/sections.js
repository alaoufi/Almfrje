/* sections.js */
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

