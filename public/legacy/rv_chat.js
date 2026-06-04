/* rv_chat.js */

async function rvChat(){
  // إظهار nav دائماً عند العودة للقائمة


  if(D.cfg && D.cfg.allow_reviewer_chat === '0'){
    $h('rv-pg','<div style="text-align:center;padding:60px 16px">'
      +'<div style="font-size:48px;margin-bottom:12px">🔒</div>'
      +'<div style="font-weight:700;font-size:16px;margin-bottom:8px">المحادثات موقوفة</div>'
      +'<div style="color:var(--mid);font-size:13px">المحادثات مع الإدارة موقوفة مؤقتاً</div>'
      +'</div>');
    return;
  }

  if(!D.cvs||!D.cvs.length){
    ld(1);var r=await api('GET','messages');ld(0);
    D.cvs=Array.isArray(r)?r:[];
  }
  var admins=D.cvs.filter(function(x){return x.role==='admin';});
  if(!admins.length) admins=D.cvs;

  // مدير واحد → عرض زر فتح بدل فتح مباشر
  var h='<div class="ph"><div><div class="pt">💬 المحادثات</div></div></div>';
  h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;overflow:hidden">';
  admins.forEach(function(adm,i){
    var unread=+adm.unread||0;
    h+='<div style="display:flex;align-items:center;gap:11px;padding:13px;cursor:pointer;'+(i>0?'border-top:1px solid var(--border)':'')+'" data-admid="'+adm.id+'">';
    h+='<div style="width:40px;height:40px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;flex-shrink:0">'+(adm.name||'م').charAt(0)+'</div>';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-weight:700;font-size:14px">'+htmlEsc(adm.name||'')+'</div>';
    if(adm.last_msg) h+='<div style="font-size:12px;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+htmlEsc(adm.last_msg.slice(0,50))+'</div>';
    h+='</div>';
    if(unread) h+='<span style="background:var(--blue);color:#fff;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;flex-shrink:0">'+unread+'</span>';
    h+='<span style="color:var(--mid);font-size:18px;flex-shrink:0">←</span>';
    h+='</div>';
  });
  h+='</div>';
  $h('rv-pg',h);

  setTimeout(function(){
    document.querySelectorAll('[data-admid]').forEach(function(el){
      el.addEventListener('click',function(){
        var adm=admins.find(function(a){return a.id==el.dataset.admid;});
        if(adm) rvOpenChat(adm);
      });
    });
  },50);
}
