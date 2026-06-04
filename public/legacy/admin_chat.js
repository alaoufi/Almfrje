/* admin_chat.js - محادثات الأدمن مع المراجعين */

function pCht(){
  var cvs=D.cvs||[];
  var h='<div class="ph"><div><div class="pt">💬 المحادثات</div></div></div>';
  if(!cvs.length){
    h+='<div style="text-align:center;padding:60px 16px;color:var(--light)">'
      +'<div style="font-size:48px;margin-bottom:12px">💬</div>'
      +'<p>لا توجد محادثات</p></div>';
    $h('pg',h);return;
  }
  h+='<div class="fields-wrap">';
  cvs.forEach(function(c,i){
    var unread=+c.unread||0;
    h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;'
      +(i>0?'border-top:1px solid var(--border)':'')+';background:'+(i%2===0?'#fff':'#fafbff')
      +'" data-cht="'+c.id+'">';
    h+='<div style="width:42px;height:42px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;flex-shrink:0">'+(c.name||'م').charAt(0)+'</div>';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center">';
    h+='<div style="font-weight:700;font-size:14px">'+htmlEsc(c.name||'')+'</div>';
    if(unread) h+='<span style="background:var(--blue);color:#fff;padding:1px 8px;border-radius:20px;font-size:11px;font-weight:700">'+unread+'</span>';
    h+='</div>';
    h+='<div style="font-size:12px;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(c.last_msg||'ابدأ المحادثة')+'</div>';
    h+='</div></div>';
  });
  h+='</div>';
  $h('pg',h);
  setTimeout(function(){
    document.querySelectorAll('[data-cht]').forEach(function(el){
      el.addEventListener('click',function(){oCht(+el.dataset.cht);});
    });
  },50);
}

function showTransferMenu(reviewerId){
  var otherAdmins=(D.rev||[]).filter(function(u){return u.role==='admin'&&u.id!==(U&&U.id);});
  var rv=(D.cvs||[]).find(function(x){return x.id==reviewerId;});
  var rvName=rv?rv.name:'المراجع';
  var h='<div style="font-size:13px;color:var(--mid);margin-bottom:12px">تحويل محادثة <b>'+htmlEsc(rvName)+'</b> إلى:</div>';
  otherAdmins.forEach(function(adm){
    h+='<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8faff;border:1.5px solid var(--border);border-radius:11px;margin-bottom:8px;cursor:pointer" data-transfer-to="'+adm.id+'" data-transfer-rv="'+reviewerId+'" data-adm-name="'+htmlEsc(adm.name||'')+'">';
    h+='<div style="width:36px;height:36px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;flex-shrink:0">'+(adm.name||'م').charAt(0)+'</div>';
    h+='<div><div style="font-weight:700;font-size:14px">'+htmlEsc(adm.name||'')+'</div>';
    if(adm.username) h+='<div style="font-size:12px;color:var(--mid)">@'+adm.username+'</div>';
    h+='</div>';
    h+='<span style="margin-right:auto;font-size:13px;color:var(--blue)">تحويل ←</span>';
    h+='</div>';
  });
  h+='<button class="btn bs" style="width:100%;margin-top:8px" onclick="cM()">إلغاء</button>';
  oM('↪ تحويل المحادثة', h);
  setTimeout(function(){
    document.querySelectorAll('[data-transfer-to]').forEach(function(el){
      el.addEventListener('click',function(){
        confirmTransfer(+el.dataset.transferRv, +el.dataset.transferTo, el.dataset.admName);
      });
    });
  },50);
}

async function confirmTransfer(reviewerId, newAdminId, admName){
  cM();
  var rv=(D.cvs||[]).find(function(x){return x.id==reviewerId;});
  var rvName=rv?rv.name:'المراجع';
  // أرسل رسالة نظام للمراجع تخبره بالتحويل
  var sysMsg='📢 تم تحويل محادثتك إلى '+admName+'. سيتابع معك قريباً.';
  await api('POST','messages/'+reviewerId,{to_id:+reviewerId,body:sysMsg});
  // أرسل رسالة للمدير الجديد تخبره بالمهمة
  var fwdMsg='📋 تم تحويل محادثة المراجع "'+rvName+'" إليك. يرجى المتابعة.';
  await api('POST','messages/'+reviewerId,{to_id:+newAdminId,body:fwdMsg,from_reviewer:+reviewerId});
  toast('✅ تم تحويل المحادثة إلى '+admName);
  await lCvs();
  pCht();
}

