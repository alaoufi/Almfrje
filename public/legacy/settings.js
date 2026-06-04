/* settings.js — صفحة الإعدادات بتبويبات: الإعدادات / النصوص / الصفحات */

// ─── احتياطي: إن لم تُحمَّل core.js (mdToolbar) لأي سبب، نوفّر النسخ
// المحلية هنا حتى يظهر شريط التنسيق دائماً في تبويب «الصفحات».
if(typeof window.mdToolbar!=='function'){
  window.mdEsc=window.mdEsc||function(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
  window.mdInline=window.mdInline||function(s){
    s=s.replace(/\*\*([^*\n]+?)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g,'$1<em>$2</em>');
    s=s.replace(/__([^_\n]+?)__/g,'<strong>$1</strong>');
    s=s.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g,function(_,t,u){
      if(/^(https?:|mailto:|tel:)/i.test(u)) return '<a href="'+u+'" target="_blank" rel="noopener" style="color:#0369a1;text-decoration:underline">'+t+'</a>';
      return t;
    });
    return s;
  };
  window.mdRender=window.mdRender||function(text){
    if(!text) return '';
    var lines=mdEsc(text).split('\n'),out=[],inUL=false,inOL=false,m;
    function close(){ if(inUL){out.push('</ul>');inUL=false;} if(inOL){out.push('</ol>');inOL=false;} }
    for(var i=0;i<lines.length;i++){
      var line=lines[i];
      if((m=line.match(/^\s*[-*•]\s+(.+)$/))){ if(inOL){out.push('</ol>');inOL=false;} if(!inUL){out.push('<ul style="margin:6px 0;padding-right:22px">');inUL=true;} out.push('<li>'+mdInline(m[1])+'</li>'); continue; }
      if((m=line.match(/^\s*\d+\.\s+(.+)$/))){ if(inUL){out.push('</ul>');inUL=false;} if(!inOL){out.push('<ol style="margin:6px 0;padding-right:22px">');inOL=true;} out.push('<li>'+mdInline(m[1])+'</li>'); continue; }
      close();
      if((m=line.match(/^###\s+(.+)$/))){ out.push('<h5 style="margin:8px 0 4px;font-weight:800;font-size:13px">'+mdInline(m[1])+'</h5>'); continue; }
      if((m=line.match(/^##\s+(.+)$/))){ out.push('<h4 style="margin:10px 0 5px;font-weight:800;font-size:14px">'+mdInline(m[1])+'</h4>'); continue; }
      if((m=line.match(/^#\s+(.+)$/))){ out.push('<h3 style="margin:12px 0 6px;font-weight:800;font-size:16px;color:#075e54">'+mdInline(m[1])+'</h3>'); continue; }
      if(line.trim()===''){ out.push('<div style="height:6px"></div>'); continue; }
      out.push('<div>'+mdInline(line)+'</div>');
    }
    close();
    return out.join('');
  };
  window.mdToolbar=function(taId){
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
      +btn('preview','👁 معاينة','معاينة','margin-right:auto;background:#075e54;color:#fff;border-color:#075e54')
      +'</div>';
  };
  window.mdAct=window.mdAct||function(taId,act){
    var ta=document.getElementById(taId); if(!ta) return;
    function wrap(b,a,p){var s=ta.selectionStart,e=ta.selectionEnd,v=ta.value;var sel=v.slice(s,e)||p||'نص';ta.value=v.slice(0,s)+b+sel+a+v.slice(e);ta.focus();ta.setSelectionRange(s+b.length,s+b.length+sel.length);}
    function pre(p){var s=ta.selectionStart,e=ta.selectionEnd,v=ta.value;var ls=v.lastIndexOf('\n',s-1)+1;var le=v.indexOf('\n',e);if(le<0)le=v.length;var blk=v.slice(ls,le);var nb=blk.split('\n').map(function(l){return p+l;}).join('\n');ta.value=v.slice(0,ls)+nb+v.slice(le);ta.focus();}
    if(act==='bold')wrap('**','**','نص عريض');
    else if(act==='italic')wrap('*','*','نص مائل');
    else if(act==='h1')pre('# ');
    else if(act==='h2')pre('## ');
    else if(act==='ul')pre('- ');
    else if(act==='ol')pre('1. ');
    else if(act==='link'){var s=ta.selectionStart,e=ta.selectionEnd,v=ta.value;var sel=v.slice(s,e)||'نص';var u=prompt('أدخل الرابط (https://...)','https://');if(!u)return;var ins='['+sel+']('+u+')';ta.value=v.slice(0,s)+ins+v.slice(e);ta.focus();}
    else if(act==='preview'){
      var p=document.getElementById('md-prev-ov');if(p)p.remove();
      var ov=document.createElement('div');ov.id='md-prev-ov';
      ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Cairo,sans-serif;direction:rtl';
      var box=document.createElement('div');
      box.style.cssText='background:#fff;border-radius:14px;padding:18px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,.25)';
      box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #f1f5f9"><div style="font-size:15px;font-weight:800;color:#075e54">👁 معاينة</div><button id="md-prev-x" type="button" style="background:#f1f5f9;border:none;width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer">✕</button></div><div style="font-size:14px;line-height:1.85;color:#1e293b">'+mdRender(ta.value)+'</div>';
      ov.appendChild(box);document.body.appendChild(ov);
      function close(){ov.remove();}
      document.getElementById('md-prev-x').addEventListener('click',close);
      ov.addEventListener('click',function(e){if(e.target===ov)close();});
    }
  };
}

var SET_TAB='settings';

function pSet(){ pSetTab(SET_TAB||'settings'); }

function pSetTab(tab){
  SET_TAB=tab;
  var chatOp= !D.cfg || D.cfg.allow_reviewer_chat !== '0';
  var spOp  = D.cfg && D.cfg.allow_special_login === '1';
  var regOp = D.cfg && D.cfg.allow_registration === '1';

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

  // شريط التبويبات
  var tabs=[
    {k:'settings', l:'⚙️ الإعدادات'},
    {k:'texts',    l:'📝 النصوص'},
    {k:'pages',    l:'📄 الصفحات'}
  ];
  var tabBar='<div style="display:flex;gap:4px;margin-bottom:14px;background:#f1f5f9;padding:5px;border-radius:12px">';
  tabs.forEach(function(t){
    var a=(t.k===tab);
    tabBar+='<button type="button" onclick="pSetTab(\''+t.k+'\')" '
      +'style="flex:1;padding:10px 4px;border:none;'
      +'background:'+(a?'#fff':'transparent')+';'
      +'color:'+(a?'var(--blue)':'var(--mid)')+';'
      +'font-family:Cairo,sans-serif;font-size:12.5px;font-weight:'+(a?'800':'700')+';'
      +'cursor:pointer;border-radius:9px;transition:all .15s;'
      +'box-shadow:'+(a?'0 2px 6px rgba(42,111,219,.12)':'none')+'">'
      +t.l+'</button>';
  });
  tabBar+='</div>';

  var content='';

  if(tab==='settings'){
    var maxMb = (D.cfg&&D.cfg.max_upload_mb) || '10';
    content+='<div class="card" style="margin-bottom:10px">'
      +'<div style="font-weight:800;font-size:13px;margin-bottom:12px;color:var(--text)">🔐 حالة الموقع</div>'
      +togRow('stg2','الدخول الخاص فقط','عند التفعيل، لا يدخل إلا من لديه صلاحية خاصة (يقوم مقام إغلاق الموقع)',spOp,'allow_special_login')
      +togRow('stg3','فتح التسجيل','السماح بإنشاء حسابات جديدة',regOp,'allow_registration')
      +togRow('stg4','محادثات المراجعين','السماح للمراجعين بفتح المحادثات مع الإدارة',chatOp,'allow_reviewer_chat')
      +'<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:9px;padding:10px 12px;margin-top:10px">'
      +'<div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:4px">🔗 رابط الدخول المباشر للإدارة</div>'
      +'<code style="font-size:11px;color:#1d4ed8;word-break:break-all">'
      +(typeof location!=='undefined'?location.origin+location.pathname:'')+'?admin=1</code>'
      +'<div style="font-size:11px;color:var(--mid);margin-top:3px">يعمل حتى عند تفعيل الدخول الخاص — احفظه في المفضّلة</div>'
      +'</div></div>'

      +'<div class="card" style="margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      +'<div style="font-weight:800;font-size:13px">📁 حد رفع الملف</div>'
      +'<button class="btn bp bsm" onclick="svMaxUpload()">💾 حفظ</button>'
      +'</div>'
      +'<div style="font-size:11.5px;color:var(--mid);margin-bottom:8px;line-height:1.6">الحد الأقصى لحجم الملف الواحد (صورة أو PDF) الذي يرفعه المراجع. الحد الأعلى المسموح به: 100 MB.</div>'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<input id="cfg-max-mb" type="number" min="1" max="100" class="fr-inp" style="flex:1;box-sizing:border-box" value="'+maxMb+'">'
      +'<span style="font-weight:700;color:var(--mid)">MB</span>'
      +'</div>'
      +'</div>'

      +'<div class="card" style="margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      +'<div style="font-weight:800;font-size:13px">📍 موقع المكان</div>'
      +'<button class="btn bp bsm" onclick="svLocation()">💾 حفظ</button>'
      +'</div>'
      +'<div style="font-size:11.5px;color:var(--mid);margin-bottom:10px;line-height:1.6">احفظ موقع العيادة/المكتب. سيستخدمه المدير لإرسال الموقع للمراجع ليصل بدقة.</div>'
      +'<div class="f"><label>اسم المكان</label><input id="cfg-loc-label" class="fr-inp" placeholder="مثال: العيادة الرئيسية" value="'+(((D.cfg&&D.cfg.location_label)||'').replace(/"/g,'&quot;'))+'"></div>'
      +'<div class="f"><label>رابط Google Maps</label><input id="cfg-loc-url" class="fr-inp" placeholder="https://maps.google.com/?q=..." value="'+(((D.cfg&&D.cfg.location_url)||'').replace(/"/g,'&quot;'))+'"></div>'
      +'<div style="font-size:11px;color:var(--mid);background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:8px 10px;line-height:1.7">'
      +'<b>كيف تحصل على الرابط:</b><br>'
      +'• افتح Google Maps على المكان المطلوب<br>'
      +'• اضغط «مشاركة» ثم «نسخ الرابط»<br>'
      +'• الصق الرابط هنا'
      +'</div>'
      +'</div>'

      +'<div class="card" style="margin-bottom:10px">'
      +'<div style="font-weight:800;font-size:13px;margin-bottom:8px">🤖 الذكاء الاصطناعي للترجمة الطبية</div>'
      +'<div style="font-size:11.5px;color:var(--mid);margin-bottom:10px;line-height:1.6">يُستخدم لترجمة الصور و PDF إلى العربية مع إبراز القيم الشاذة.</div>'
      +'<div id="ai-provider-panel" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;min-height:60px">'
      +  '<div style="text-align:center;color:var(--light);font-size:12px;padding:14px">جارٍ تحميل حالة المُقدّمين...</div>'
      +'</div>'
      +'</div>'

      +'<div class="card" style="margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
      +'<div style="font-weight:800;font-size:13px">📝 معايير تقييم الجلسة</div>'
      +'<button class="btn bp bsm" onclick="oSEvalField(0)">+ معيار</button>'
      +'</div>'
      +'<div style="font-size:11.5px;color:var(--mid);margin-bottom:10px;line-height:1.6">المعايير التي يستخدمها المراجع لتقييم الجلسة ويرد عليها المشرف. التعديل لا يمسّ البيانات السابقة.</div>'
      +'<div id="sev-list" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px;min-height:40px">'
      +  '<div style="text-align:center;color:var(--light);font-size:12px;padding:14px">جارٍ التحميل...</div>'
      +'</div>'
      +'</div>'

      +'<div class="card" style="margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
      +'<div style="font-weight:800;font-size:13px">ⓘ تعليمات المراجع</div>'
      +'<button class="btn bp bsm" onclick="oTip(0)">+ تعليمة</button>'
      +'</div>'
      +'<div style="font-size:11.5px;color:var(--mid);margin-bottom:10px;line-height:1.6">نصوص توضيحية تظهر للمراجع عند الضغط على أيقونة ⓘ بجانب الأقسام والحقول. اضبط مفتاحاً مطابقاً للموضع.</div>'
      +'<div id="tips-list" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px;min-height:40px">'
      +  '<div style="text-align:center;color:var(--light);font-size:12px;padding:14px">جارٍ التحميل...</div>'
      +'</div>'
      +'</div>'

      +'<div class="card">'
      +'<div style="font-weight:800;font-size:13px;margin-bottom:8px">🛠 ترقيات قاعدة البيانات</div>'
      +'<div style="font-size:12px;color:var(--mid);margin-bottom:10px;line-height:1.6">تطبيق التحديثات الجديدة على بنية قاعدة البيانات (آمن — لا يحذف بيانات).</div>'
      +'<button class="btn bp" style="width:100%" onclick="runMigrations()">⚡ تطبيق الترقيات الآن</button>'
      +'</div>';
  }
  else if(tab==='texts'){
    var txtKeys=[
      ['site_name','اسم المنصة'],
      ['login_app_title','عنوان صفحة الدخول'],
      ['special_login_message','رسالة شاشة الدخول الخاص'],
      ['welcome_message','رسالة الترحيب'],
      ['thread_label','تسمية موضوع المحادثة']
    ];
    var txtHtml='';
    txtKeys.forEach(function(kl){
      var k=kl[0],l=kl[1];
      var val=(D.cfg&&D.cfg[k])||'';
      txtHtml+='<div class="f">'
        +'<label style="display:flex;justify-content:space-between">'
        +'<span>'+l+'</span><span style="font-size:10px;color:var(--light)">'+k+'</span></label>'
        +'<input data-cfg="'+k+'" class="fr-inp" value="'+val.replace(/"/g,'&quot;')+'">'
        +'</div>';
    });
    content+='<div class="card">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
      +'<div style="font-weight:800;font-size:13px">📝 النصوص العامة</div>'
      +'<button class="btn bp bsm" onclick="svCfg()">💾 حفظ</button>'
      +'</div>'
      +txtHtml
      +'</div>';
  }
  else if(tab==='pages'){
    var pageKeys=[
      ['privacy_text','🔒 نصّ سياسة الخصوصية'],
      ['instructions_text','📘 نصّ التعليمات']
    ];
    var pgHtml='';
    pageKeys.forEach(function(kl){
      var k=kl[0],l=kl[1];
      var val=(D.cfg&&D.cfg[k])||'';
      var taId='cfg-ta-'+k;
      pgHtml+='<div class="f" style="margin-bottom:18px">'
        +'<label style="display:flex;justify-content:space-between;margin-bottom:6px">'
        +'<span style="font-size:13px;font-weight:700">'+l+'</span>'
        +'<span style="font-size:10px;color:var(--light)">'+k+'</span></label>'
        +mdToolbar(taId)
        +'<textarea id="'+taId+'" data-cfg="'+k+'" class="fr-inp" style="height:180px;resize:vertical;line-height:1.7;font-size:13px;border-radius:0 0 8px 8px;border-top:none;margin-top:0">'+val.replace(/</g,'&lt;')+'</textarea>'
        +'</div>';
    });
    content+='<div class="card">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      +'<div style="font-weight:800;font-size:13px">📄 صفحات المراجع</div>'
      +'<button class="btn bp bsm" onclick="svCfg()">💾 حفظ</button>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--mid);margin-bottom:14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:9px 11px;line-height:1.6">'
      +'هذه النصوص يفتحها المراجع بالضغط على «🔒 الخصوصية» و«📘 التعليمات» في الصفحة الرئيسية. استخدم شريط التنسيق فوق كل حقل.'
      +'</div>'
      +pgHtml
      +'</div>';
  }

  $h('pg',
    '<div class="ph"><div><div class="pt">⚙️ الإعدادات</div></div></div>'
    +tabBar
    +'<div id="set-content">'+content+'</div>'
  );

  setTimeout(function(){
    if(tab!=='settings') return;
    // حمّل حالة مُقدّمي الذكاء الاصطناعي وارسم لوحة التحكّم
    _loadAiProviderPanel();
    // حمّل قائمة معايير التقييم
    _loadSEvalFields();
    // حمّل قائمة التعليمات
    _loadTips();
    var keyNames={'allow_special_login':'الدخول الخاص','allow_registration':'فتح التسجيل','allow_reviewer_chat':'محادثات المراجعين'};
    ['stg2','stg3','stg4'].forEach(function(id){
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
            var nm=keyNames[key]||key;
            toast((nv==='1'?'✅ تم تفعيل ':'🔴 تم تعطيل ')+nm);
          }
        });
      });
    });
  },50);
}

async function svCfg(){
  var d={};
  document.querySelectorAll('[data-cfg]').forEach(function(inp){
    if(!inp.dataset.cfg) return;
    d[inp.dataset.cfg] = (inp.tagName==='TEXTAREA') ? inp.value : inp.value.trim();
  });
  ld(1);var r=await api('POST','settings',d);ld(0);
  if(r&&r.error){toast(r.error,'er');return;}
  if(!D.cfg)D.cfg={};
  Object.assign(D.cfg,d);
  toast('تم الحفظ ✅');
}

window.svMaxUpload=async function(){
  var inp=document.getElementById('cfg-max-mb');
  if(!inp)return;
  var v=parseInt(inp.value,10);
  if(!Number.isFinite(v)||v<1){toast('أدخل رقماً صحيحاً','er');return;}
  if(v>100){toast('الحد الأعلى 100 MB','er');inp.value=100;return;}
  ld(1);var r=await api('POST','settings',{max_upload_mb:String(v)});ld(0);
  if(r&&r.error){toast(r.error,'er');return;}
  if(!D.cfg)D.cfg={};
  D.cfg.max_upload_mb=String(v);
  toast('✅ تم حفظ الحد ('+v+' MB)');
};

window.svLocation=async function(){
  var labelEl=document.getElementById('cfg-loc-label');
  var urlEl=document.getElementById('cfg-loc-url');
  var label=(labelEl?labelEl.value:'').trim();
  var url=(urlEl?urlEl.value:'').trim();
  // تحقّق بسيط من الرابط
  if(url && !/^https?:\/\//i.test(url)){
    toast('الرابط يجب أن يبدأ بـ http:// أو https://','er');return;
  }
  ld(1);
  var r=await api('POST','settings',{location_label:label, location_url:url});
  ld(0);
  if(r&&r.error){toast(r.error,'er');return;}
  if(!D.cfg)D.cfg={};
  D.cfg.location_label=label;
  D.cfg.location_url=url;
  toast(url ? '✅ تم حفظ الموقع' : '✅ تم مسح الموقع');
};

window.runMigrations=async function(){
  oConfirm('تطبيق ترقيات قاعدة البيانات؟\nسيُضاف الأعمدة الجديدة بأمان (بدون حذف بيانات).',async function(){
    ld(1);
    try{
      var res=await fetch('/api/migrate',{headers:{'Authorization':'Bearer '+(localStorage.getItem('tk')||'')}});
      var data=await res.json();
      ld(0);
      if(data&&data.ok){
        var n=(data.results||[]).length;
        oAlert('✅ تم تطبيق '+n+' ترقية بنجاح. يمكنك الآن استخدام الميزات الجديدة.',{icon:'✓'});
      } else {
        oAlert('⚠️ فشل بعض الترقيات: '+(data&&data.error?data.error:JSON.stringify((data&&data.results)||data).slice(0,200)),{icon:'⚠️',danger:true});
      }
    }catch(e){
      ld(0);
      oAlert('فشل الاتصال: '+(e&&e.message||e),{icon:'⚠️',danger:true});
    }
  },{icon:'⚡',yes:'تطبيق',no:'إلغاء'});
};


// ─── لوحة التحكّم بمُقدّم الذكاء الاصطناعي ────────────────────────
async function _loadAiProviderPanel(){
  var panel = document.getElementById('ai-provider-panel');
  if(!panel) return;
  var r;
  try{
    var res = await fetch('/api/ai/status', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('tk')||'') }
    });
    r = await res.json();
  }catch(e){ r = {error: 'خطأ شبكة'}; }
  if(!r || r.error){
    panel.innerHTML = '<div style="color:#dc2626;font-size:12px;text-align:center;padding:10px">تعذّر تحميل الحالة: ' + (r && r.error ? r.error : 'خطأ') + '</div>';
    return;
  }
  var gOK = !!r.gemini_ready;
  var cOK = !!r.claude_ready;
  var cur = r.provider || 'auto';
  function row(val, name, icon, ready, helper){
    var disabled = !ready && val !== 'auto';
    var checked = cur === val;
    var bg = checked ? '#eff6ff' : '#fff';
    var border = checked ? '#3b82f6' : '#e2e8f0';
    var statusIcon = ready ? '<span style="color:#16a34a;font-weight:800">✓ مفعّل</span>' : '<span style="color:#dc2626;font-weight:700">✗ غير مفعّل</span>';
    return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:'+bg+';border:1.5px solid '+border+';border-radius:9px;cursor:'+(disabled?'not-allowed':'pointer')+';margin-bottom:6px;opacity:'+(disabled?'.55':'1')+'">'
      + '<input type="radio" name="ai-prov" value="'+val+'" '+(checked?'checked':'')+' '+(disabled?'disabled':'')+' style="width:18px;height:18px;accent-color:#3b82f6;flex-shrink:0" onchange="_saveAiProvider(this.value)">'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-weight:800;font-size:13px;color:#1e293b">'+icon+' '+name+'</div>'
      +   '<div style="font-size:11px;color:var(--mid);margin-top:1px">'+helper+'</div>'
      + '</div>'
      + '<div style="font-size:11px;flex-shrink:0">'+statusIcon+'</div>'
      + '</label>';
  }
  var h = ''
    + row('auto', 'تلقائي', '⚡', (gOK||cOK), 'يستخدم Gemini إذا توفّر، وإلا Claude')
    + row('gemini', 'Gemini (Google) — مجاني', '🟢', gOK, gOK ? 'المفتاح موجود ومفعّل' : 'أضف GEMINI_API_KEY في Vercel')
    + row('claude', 'Claude (Anthropic) — مدفوع', '🟣', cOK, cOK ? 'المفتاح موجود ومفعّل' : 'أضف ANTHROPIC_API_KEY في Vercel')
    + '<div style="font-size:11px;color:var(--mid);background:#fff;border:1px dashed #cbd5e1;border-radius:8px;padding:8px 10px;margin-top:8px;line-height:1.7">'
    + '💡 المفاتيح تُضاف في Vercel → Settings → Environment Variables ثم Redeploy.<br>'
    + '🆓 Gemini: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:#3b82f6">aistudio.google.com/apikey</a> (لا يحتاج بطاقة بنكية)<br>'
    + '💳 Claude: <a href="https://console.anthropic.com" target="_blank" rel="noopener" style="color:#3b82f6">console.anthropic.com</a> (يحتاج رصيد بسيط)'
    + '</div>';
  panel.innerHTML = h;
}

window._saveAiProvider = async function(val){
  ld(1);
  var r = await api('POST','settings', { ai_provider: val });
  ld(0);
  if(r && r.error){ toast(r.error,'er'); return; }
  if(!D.cfg) D.cfg = {};
  D.cfg.ai_provider = val;
  var label = val === 'gemini' ? 'Gemini (Google)' : val === 'claude' ? 'Claude (Anthropic)' : 'التلقائي';
  toast('✅ المُقدّم الآن: ' + label);
  _loadAiProviderPanel(); // أعد التحميل لتحديث العلامات
};

// ─── إدارة معايير تقييم الجلسة ─────────────────────────────────────
async function _loadSEvalFields(){
  var box = document.getElementById('sev-list'); if(!box) return;
  var r = await api('GET','session_eval_fields');
  if(r && r.error){ box.innerHTML = '<div style="color:#dc2626;font-size:12px;padding:10px;text-align:center">'+r.error+'</div>'; return; }
  var rows = Array.isArray(r) ? r : [];
  if(!rows.length){
    box.innerHTML = '<div style="text-align:center;color:var(--light);font-size:12.5px;padding:14px">لا توجد معايير. اضغط + معيار لإضافة أول معيار.</div>';
    return;
  }
  var h='';
  rows.forEach(function(f,i){
    var bg = i%2===0 ? '#fff' : '#f9fbff';
    h+='<div style="display:flex;align-items:center;gap:8px;padding:9px 10px;background:'+bg+(i>0?';border-top:1px solid #eef2f7':'')+';border-radius:7px">';
    h+='<div style="font-size:20px;width:30px;text-align:center">'+(f.icon||'·')+'</div>';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-weight:700;font-size:13px;color:#0f172a">'+(f.label||'').replace(/</g,'&lt;')+'</div>';
    h+='<div style="font-size:10.5px;color:var(--mid)">ترتيب: '+(f.sort_order||0)+'</div>';
    h+='</div>';
    h+='<button class="ib ie" style="width:28px;height:28px" onclick="oSEvalField('+f.id+')" title="تعديل">'+SVG.edit+'</button>';
    h+='<button class="ib id" style="width:28px;height:28px" onclick="dSEvalField('+f.id+')" title="حذف">'+SVG.del+'</button>';
    h+='</div>';
  });
  box.innerHTML = h;
}

window.oSEvalField = async function(id){
  var f = { label:'', icon:'', sort_order:100 };
  if(id){
    var r = await api('GET','session_eval_fields');
    var list = Array.isArray(r)?r:[];
    var found = list.find(function(x){return +x.id===+id;});
    if(found) f = found;
  }
  oM((id?'تعديل':'إضافة')+' معيار تقييم',
    '<div class="f"><label>العنوان *</label>'
    +'<input id="sev-lbl" class="fr-inp" placeholder="مثال: أعراض المرض" value="'+String(f.label||'').replace(/"/g,'&quot;')+'"></div>'
    +'<div class="f"><label>الأيقونة (Emoji)</label>'
    +'<input id="sev-ico" class="fr-inp" placeholder="🩺" value="'+String(f.icon||'').replace(/"/g,'&quot;')+'"></div>'
    +'<div class="f"><label>الترتيب</label>'
    +'<input id="sev-ord" class="fr-inp" type="number" value="'+(f.sort_order||100)+'"></div>'
    +'<div style="font-size:11px;color:var(--mid);background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;padding:7px 10px;margin-bottom:10px;line-height:1.6">الأقل ترتيباً يظهر أولاً. التعديل لا يغيّر التقييمات السابقة.</div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svSEvalField('+(id||0)+')">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
};

window.svSEvalField = async function(id){
  var lbl = ($g('sev-lbl')?.value||'').trim();
  if(!lbl){ toast('العنوان مطلوب','er'); return; }
  var body = {
    label: lbl,
    icon: ($g('sev-ico')?.value||'').trim(),
    sort_order: +($g('sev-ord')?.value||100),
  };
  ld(1);
  var r = id ? await api('PUT','session_eval_fields/'+id, body) : await api('POST','session_eval_fields', body);
  ld(0);
  if(r && r.error){ toast(r.error,'er'); return; }
  toast('تم الحفظ ✅'); cM(); _loadSEvalFields();
};

window.dSEvalField = async function(id){
  if(!confirmDel('حذف المعيار؟ التقييمات السابقة تبقى محفوظة.')) return;
  ld(1);
  var r = await api('DELETE','session_eval_fields/'+id);
  ld(0);
  if(r && r.error){ toast(r.error,'er'); return; }
  toast('تم الحذف ✅'); _loadSEvalFields();
};

// ─── إدارة تعليمات المراجع (ⓘ) ─────────────────────────────────────
// المفاتيح المعروفة المُستخدمة في الواجهة — تظهر للمدير كاقتراحات
window.TIP_KEYS = [
  ['home_welcome',         'الصفحة الرئيسية (الترحيب)'],
  ['forms_section',        'قسم الاستمارات'],
  ['form_fill',            'صفحة تعبئة الاستمارة'],
  ['chat_section',         'قسم المحادثات'],
  ['chat_topic',           'بدء محادثة جديدة'],
  ['apt_section',          'قسم المواعيد'],
  ['apt_calendar',         'قراءة التقويم'],
  ['apt_book',             'كيفية الحجز'],
  ['apt_eval',             'تقييم بعد الجلسة'],
  ['pub_section',          'النشرات'],
  ['report_upload',        'رفع التقارير (الزر)'],
  ['report_upload_modal',  'نافذة رفع التقارير'],
  ['profile_edit',         'الملف الشخصي'],
];

async function _loadTips(){
  var box = document.getElementById('tips-list'); if(!box) return;
  var r = await api('GET','tips');
  if(r && r.error){ box.innerHTML = '<div style="color:#dc2626;font-size:12px;padding:10px;text-align:center">'+r.error+'</div>'; return; }
  var rows = Array.isArray(r) ? r : [];
  // حدّث D.tips ليرى المراجع التغييرات بعد إعادة الفتح
  var map = {}; rows.forEach(function(t){ map[t.tip_key]=t; });
  D.tips = map;
  if(!rows.length){
    box.innerHTML = '<div style="text-align:center;color:var(--light);font-size:12.5px;padding:14px">لا توجد تعليمات. اضغط + تعليمة لإضافة أوّل واحدة.</div>';
    return;
  }
  var labels = {};
  TIP_KEYS.forEach(function(k){ labels[k[0]]=k[1]; });
  var h='';
  rows.forEach(function(t,i){
    var bg = i%2===0 ? '#fff' : '#f9fbff';
    var hint = labels[t.tip_key] || 'مفتاح مخصّص';
    h+='<div style="display:flex;align-items:center;gap:8px;padding:10px;background:'+bg+(i>0?';border-top:1px solid #eef2f7':'')+';border-radius:7px">';
    h+='<div style="font-size:18px;width:30px;text-align:center;color:#1d4ed8">ⓘ</div>';
    h+='<div style="flex:1;min-width:0">';
    h+='<div style="font-weight:700;font-size:13px;color:#0f172a">'+String(t.title||'').replace(/</g,'&lt;')+'</div>';
    h+='<div style="font-size:10.5px;color:var(--mid);margin-top:2px">'+String(t.tip_key||'').replace(/</g,'&lt;')+' · '+hint+'</div>';
    h+='</div>';
    h+='<button class="ib ie" style="width:28px;height:28px" onclick="oTip('+t.id+')" title="تعديل">'+SVG.edit+'</button>';
    h+='<button class="ib id" style="width:28px;height:28px" onclick="dTip('+t.id+')" title="حذف">'+SVG.del+'</button>';
    h+='</div>';
  });
  box.innerHTML = h;
}

window.oTip = async function(id){
  var t = { tip_key:'', title:'', body:'', sort_order:100 };
  if(id){
    var r = await api('GET','tips');
    var list = Array.isArray(r)?r:[];
    var found = list.find(function(x){return +x.id===+id;});
    if(found) t = found;
  }
  var keyOpts = '<option value="">— مخصّص —</option>';
  TIP_KEYS.forEach(function(k){
    var sel = (t.tip_key===k[0]) ? ' selected' : '';
    keyOpts += '<option value="'+k[0]+'"'+sel+'>'+k[0]+' · '+k[1]+'</option>';
  });
  var taId='tip-body-ta';
  oM((id?'تعديل':'إضافة')+' تعليمة',
    '<div class="f"><label>الموضع (المفتاح) *</label>'
    +'<select id="tip-key-sel" class="fr-inp" onchange="(function(s){var i=document.getElementById(\'tip-key\');if(s.value)i.value=s.value;})(this)">'+keyOpts+'</select></div>'
    +'<div class="f"><label>أو اكتب مفتاحاً مخصّصاً</label>'
    +'<input id="tip-key" class="fr-inp" placeholder="مثال: report_upload" value="'+String(t.tip_key||'').replace(/"/g,'&quot;')+'"></div>'
    +'<div class="f"><label>العنوان *</label>'
    +'<input id="tip-title" class="fr-inp" placeholder="مثال: كيفية رفع التقارير" value="'+String(t.title||'').replace(/"/g,'&quot;')+'"></div>'
    +'<div class="f"><label>النصّ *</label>'
    +(typeof mdToolbar==='function'? mdToolbar(taId) : '')
    +'<textarea id="'+taId+'" class="fr-inp" style="height:140px;resize:vertical;line-height:1.7;font-size:13px;border-radius:'+(typeof mdToolbar==='function'?'0 0 8px 8px;border-top:none':'8px')+'">'+String(t.body||'').replace(/</g,'&lt;')+'</textarea></div>'
    +'<div class="f"><label>الترتيب</label>'
    +'<input id="tip-ord" class="fr-inp" type="number" value="'+(t.sort_order||100)+'"></div>'
    +'<div style="font-size:11px;color:var(--mid);background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;padding:7px 10px;margin-bottom:10px;line-height:1.6">يمكنك استخدام التنسيق (عناوين، قوائم، روابط). المفتاح يجب أن يطابق موضعاً موجوداً في الواجهة لتظهر الأيقونة.</div>'
    +'<div style="display:flex;gap:9px">'
    +'<button class="btn bp" onclick="svTip('+(id||0)+')">💾 حفظ</button>'
    +'<button class="btn bs" onclick="cM()">إلغاء</button></div>');
};

window.svTip = async function(id){
  var key = ($g('tip-key')?.value||'').trim();
  var title = ($g('tip-title')?.value||'').trim();
  var body = ($g('tip-body-ta')?.value||'').trim();
  if(!key){ toast('المفتاح مطلوب','er'); return; }
  if(!title){ toast('العنوان مطلوب','er'); return; }
  if(!body){ toast('النص مطلوب','er'); return; }
  var data = { tip_key:key, title:title, body:body, sort_order:+($g('tip-ord')?.value||100) };
  ld(1);
  var r = id ? await api('PUT','tips/'+id, data) : await api('POST','tips', data);
  ld(0);
  if(r && r.error){ toast(r.error,'er'); return; }
  toast('تم الحفظ ✅'); cM(); _loadTips();
};

window.dTip = async function(id){
  if(!confirmDel('حذف التعليمة؟')) return;
  ld(1);
  var r = await api('DELETE','tips/'+id);
  ld(0);
  if(r && r.error){ toast(r.error,'er'); return; }
  toast('تم الحذف ✅'); _loadTips();
};

