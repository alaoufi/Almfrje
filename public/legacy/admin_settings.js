/* admin_settings.js */

function pSet(){
  var op   = D.cfg && D.cfg.site_closed === '1';
  var chatOp = !D.cfg || D.cfg.allow_reviewer_chat !== '0';
  var spOp= !D.cfg || D.cfg.allow_special_login !== '0';
  var regOp=D.cfg && D.cfg.allow_registration === '1';
  var txtKeys=[
    ['site_name','اسم المنصة'],
    ['login_app_title','عنوان صفحة الدخول'],
    ['site_closed_message','رسالة الإغلاق'],
    ['welcome_message','رسالة الترحيب'],
    ['thread_label','تسمية موضوع المحادثة']
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
    +togRow('stg4','محادثات المراجعين','السماح للمراجعين بفتح المحادثات مع الإدارة',chatOp,'allow_reviewer_chat')
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

