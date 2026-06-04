/* submissions.js */
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
    +(ans.map(function(a,ai){
      var ABGS=['#eff6ff','#f0fdf4','#fffbeb','#fff1f2','#fdf4ff','#fff7ed'];
      var ACLS=['#2563b0','#16a34a','#d97706','#e11d48','#9333ea','#ea580c'];
      var ci=ai%6;
      return '<div style="background:'+ABGS[ci]+';border-right:4px solid '+ACLS[ci]+';border-radius:10px;padding:11px 13px;margin-bottom:7px">'
        +'<div style="font-size:11px;font-weight:700;color:'+ACLS[ci]+';margin-bottom:5px;display:flex;align-items:center;gap:5px">'
        +'<span style="background:'+ACLS[ci]+';color:#fff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">'+(ai+1)+'</span>'
        +htmlEsc(a.label||'')+'</div>'
        +'<div class="hl-content">'+htmlEsc(a.answer||'—')+'</div>'
        +'</div>';
    }).join('')||'<div class="empty-state">لا توجد إجابات</div>')
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

function hlInit(containerId){
  var box=document.getElementById(containerId);
  if(!box)return;
  box.addEventListener('mouseup',hlOnSelect);
  box.addEventListener('touchend',function(){setTimeout(hlOnSelect,100);});
}

function hlOnSelect(){
  var sel=window.getSelection?window.getSelection():null;
  if(!sel||sel.isCollapsed||!sel.rangeCount){
    hlHideBar();return;
  }
  var txt=sel.toString().trim();
  if(!txt){hlHideBar();return;}
  _hlSel=sel;
  hlShowBar();
}

function hlShowBar(){
  var bar=document.getElementById('hl-bar');
  if(bar) bar.classList.add('show');
}

function hlHideBar(){
  var bar=document.getElementById('hl-bar');
  if(bar) bar.classList.remove('show');
  _hlSel=null;
}

function hlApply(cls){
  var sel=window.getSelection?window.getSelection():_hlSel;
  if(!sel||sel.isCollapsed){hlHideBar();return;}
  try{
    var range=sel.getRangeAt(0);
    // إزالة تمييز سابق إذا وجد
    var span=document.createElement('span');
    span.className=cls;
    range.surroundContents(span);
    sel.removeAllRanges();
  }catch(e){
    // في حال اختيار عبر عناصر متعددة
    try{
      document.execCommand('bold',false,null);
    }catch(e2){}
  }
  hlHideBar();
}

function hlClear(){
  var sel=window.getSelection?window.getSelection():_hlSel;
  if(!sel||sel.isCollapsed){hlHideBar();return;}
  try{
    var range=sel.getRangeAt(0);
    var frag=range.extractContents();
    // إزالة كل spans التمييز
    var spans=frag.querySelectorAll('.hl-y,.hl-g,.hl-b,.hl-r,.hl-p,.hl-bold-txt');
    spans.forEach(function(sp){
      var parent=sp.parentNode;
      while(sp.firstChild)parent.insertBefore(sp.firstChild,sp);
      parent.removeChild(sp);
    });
    range.insertNode(frag);
    sel.removeAllRanges();
  }catch(e){}
  hlHideBar();
}

