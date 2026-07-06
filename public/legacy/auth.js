/* auth.js */
async function shAuth(forceAdmin){
  $g('dash').className='';$g('rev-dash').className='';

  // إذا الإعدادات لم تُحمَّل بعد، حاول تحميلها قبل اتخاذ قرار الشاشة
  if(!D.cfg){
    try{
      var r=await api('GET','settings');
      if(r&&!r.error) D.cfg=r;
    }catch(e){}
  }

  const cfg=D.cfg||{};
  const specialOn=cfg.allow_special_login==='1';

  // إذا الدخول الخاص مفعّل → اعرض شاشة الدخول الخاص (إلا للإدارة عبر ?admin=1)
  if(specialOn&&!forceAdmin){
    shSpecial(cfg);
    return;
  }

  // شاشة الدخول العادية
  shLogin(cfg);
}

function shLogin(cfg){
  cfg=cfg||(D.cfg||{});
  var regOn=cfg.allow_registration==='1';
  $g('auth').innerHTML=
    '<div class="ac"><div class="auth-icon">🛡️</div>'
    +'<div class="at">'+(cfg.login_app_title||'منصة الاستشارات الخاصة')+'</div>'
    +'<div id="le" class="err-box" style="display:none"></div>'
    +'<div class="f"><label>رقم الجوال أو اسم المستخدم</label>'
    +'<input id="lp" style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:Cairo,sans-serif;font-size:15px;outline:none;background:#fff;box-sizing:border-box" placeholder="أدخل رقم الجوال أو اسم المستخدم" autocomplete="username" inputmode="text">'
    +'</div>'
    +'<div class="f"><label>كلمة المرور</label>'
    +'<div style="position:relative"><input id="lw" type="password" style="width:100%;padding:12px 44px 12px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:Cairo,sans-serif;font-size:15px;outline:none;background:#fff;box-sizing:border-box" placeholder="••••••••" autocomplete="current-password">'
    +'<span id="eye" onclick="const i=$g(\'lw\');i.type=i.type===\'password\'?\'text\':\'password\';this.textContent=i.type===\'password\'?\'👁️\':\'🙈\'" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:16px">👁️</span>'
    +'</div></div>'
    +'<button class="auth-btn" id="lb" onclick="doL()">تسجيل الدخول</button>'
    +(regOn?'<div style="text-align:center;margin-top:14px;font-size:13px;color:var(--mid)">ليس لديك حساب؟ <a href="#" onclick="shRegister();return false" style="color:var(--blue);font-weight:700;text-decoration:none">إنشاء حساب جديد</a></div>':'')
    +'</div>';
  $g('auth').className='on';
  $g('lp').onkeydown=e=>{if(e.key==='Enter')$g('lw').focus();};
  $g('lw').onkeydown=e=>{if(e.key==='Enter')doL();};
}

function shRegister(){
  $g('auth').innerHTML=
    '<div class="ac"><div class="auth-icon">📝</div>'
    +'<div class="at">إنشاء حساب جديد</div>'
    +'<div id="re" class="err-box" style="display:none"></div>'
    +'<div class="f"><label>الاسم الكامل</label>'
    +'<input id="rg-nm" class="fr-inp" style="width:100%;box-sizing:border-box" placeholder="الاسم الكامل"></div>'
    +'<div class="f"><label>اسم المستخدم</label>'
    +'<input id="rg-un" class="fr-inp" style="width:100%;box-sizing:border-box" placeholder="username" autocomplete="username"></div>'
    +'<div class="f"><label>رقم الجوال</label>'
    +'<input id="rg-ph" class="fr-inp" type="tel" style="width:100%;box-sizing:border-box" placeholder="+9665XXXXXXXX" inputmode="tel"></div>'
    +'<div class="f"><label>كلمة المرور</label>'
    +'<input id="rg-pw" class="fr-inp" type="password" style="width:100%;box-sizing:border-box" placeholder="••••••••" autocomplete="new-password"></div>'
    +'<button class="auth-btn" id="rb" onclick="doRegister()">إنشاء الحساب</button>'
    +'<div style="text-align:center;margin-top:12px;font-size:13px;color:var(--mid)">لديك حساب؟ <a href="#" onclick="shLogin();return false" style="color:var(--blue);font-weight:700;text-decoration:none">تسجيل الدخول</a></div>'
    +'</div>';
  $g('auth').className='on';
}

async function doRegister(){
  var nm=($g('rg-nm')?.value||'').trim();
  var un=($g('rg-un')?.value||'').trim();
  var ph=($g('rg-ph')?.value||'').trim();
  var pw=$g('rg-pw')?.value||'';
  var err=$g('re');
  if(err){err.style.display='none';err.textContent='';}
  if(!nm||!un||!ph||!pw){
    if(err){err.textContent='جميع الحقول مطلوبة';err.style.display='block';}
    return;
  }
  if(pw.length<4){
    if(err){err.textContent='كلمة المرور قصيرة (4 أحرف على الأقل)';err.style.display='block';}
    return;
  }
  var btn=$g('rb');
  if(btn){btn.disabled=true;btn.textContent='جاري الإنشاء…';}
  var r=await api('POST','register',{name:nm,username:un,phone:ph,password:pw});
  if(btn){btn.disabled=false;btn.textContent='إنشاء الحساب';}
  if(r&&r.ok){
    toast('✅ تم إنشاء الحساب، سجّل الدخول الآن');
    shLogin();
    setTimeout(function(){var lp=$g('lp');if(lp){lp.value=un;$g('lw')?.focus();}},30);
    return;
  }
  if(err){
    err.textContent=(r&&r.error)||'تعذّر إنشاء الحساب';
    err.style.display='block';
  }
}

function shSpecial(cfg){
  cfg=cfg||(D.cfg||{});
  $g('auth').innerHTML=
    '<div class="ac" style="text-align:center">'
    +'<div style="font-size:48px;margin-bottom:10px">🔑</div>'
    +'<div class="at" style="margin-bottom:6px">الدخول الخاص</div>'
    +'<p style="color:var(--mid);font-size:13px;margin-bottom:18px">'
    +(cfg.special_login_message||'الموقع متاح للدخول الخاص فقط حالياً')
    +'<br>أدخل رقم جوالك:</p>'
    +'<div id="se" class="err-box" style="display:none"></div>'
    +'<div class="f" style="text-align:right"><label>رقم الجوال</label>'
    +'<input id="sp" type="tel" inputmode="tel" style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:Cairo,sans-serif;font-size:15px;outline:none;background:#fff;box-sizing:border-box" placeholder="+9665XXXXXXXX">'
    +'</div>'
    +'<button class="auth-btn" id="sb" onclick="doSpecialCheck()">تحقّق</button>'
    +'</div>';
  $g('auth').className='on';
  $g('sp').onkeydown=e=>{if(e.key==='Enter')doSpecialCheck();};
}

// لوحة مستخدم دور 'دعوات' — تستخدم نفس shell المراجع لكن بقائمة تنقّل مختلفة
async function shInviter(){
  $g('auth').className='';
  $g('dash').className='';
  $g('rev-dash').className='on';
  var nm=(U&&U.name)||'مدعي';
  $h('rv-name','أهلاً '+nm);
  var avatar=$g('rv-avatar');
  if(avatar) avatar.textContent=nm.charAt(0);
  var roleEl=$g('rv-role');
  if(roleEl) roleEl.textContent='📨 دعوات';
  buildNav(INV_NAVS,'rev-bnav','rvGo', RV_NAV==='home'?'invitees':RV_NAV);
  if(typeof _startUnreadPoll==='function') _startUnreadPoll();
  $h('rv-pg','<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 16px;gap:14px">'
    +'<div style="width:38px;height:38px;border:3px solid #e2e8f0;border-top-color:#2a6fdb;border-radius:50%;animation:spin .7s linear infinite"></div>'
    +'<div style="font-size:14px;color:#64748b;font-weight:600">جاري تحميل...</div>'
    +'</div>');
  // حمّل البيانات الضرورية لهذا الدور: التعليمات + النشرات + المواعيد (لمدعوّيه) + قائمة المدراء للمحادثة
  await Promise.all([
    api('GET','tips').then(function(r){
      if(Array.isArray(r)){ var m={}; r.forEach(function(t){ m[t.tip_key]=t; }); D.tips=m; }
    }).catch(function(){}),
    api('GET','publications').then(function(r){ if(Array.isArray(r)) D.pub=r; }).catch(function(){}),
    api('GET','appointments').then(function(r){ if(Array.isArray(r)) D.apt=r; }).catch(function(){}),
    api('GET','users?role=admin').then(function(r){ if(Array.isArray(r)) D.rev=r; }).catch(function(){}),
    api('GET','threads').then(function(r){ if(Array.isArray(r)) D.cvs=r; }).catch(function(){}),
  ]);
  rvGo(RV_NAV==='home'?'invitees':RV_NAV);
}

async function shInvite(token){
  $g('auth').className='on';
  $g('dash').className=''; $g('rev-dash').className='';
  $g('auth').innerHTML='<div class="ac"><div class="auth-icon">📨</div><div class="at">دعوة شخصية</div><div style="text-align:center;color:var(--mid);font-size:13px;padding:20px">جاري التحقّق من الدعوة…</div></div>';
  var r = await api('GET','invite_verify?token='+encodeURIComponent(token));
  if(r && r.error){
    $g('auth').innerHTML =
      '<div class="ac" style="text-align:center">'
      +'<div style="font-size:48px;margin-bottom:10px">⏰</div>'
      +'<div class="at" style="margin-bottom:6px;color:#b91c1c">رابط الدعوة غير صالح</div>'
      +'<p style="color:var(--mid);font-size:13px;margin-bottom:18px;line-height:1.8">'+(r.error||'تعذّر التحقّق من الدعوة')+'</p>'
      +'<button class="auth-btn" onclick="location.href=\'/\'">الذهاب للرئيسية</button>'
      +'</div>';
    return;
  }
  var nm = (r && r.name) || '';
  var ph = (r && r.phone) || '';
  var exp = r && r.expires_at ? new Date(r.expires_at) : null;
  var daysLeft = exp ? Math.max(0, Math.ceil((exp - new Date())/86400000)) : 5;
  $g('auth').innerHTML =
    '<div class="ac"><div class="auth-icon">🎉</div>'
    +'<div class="at" style="margin-bottom:4px">أهلاً '+nm.split(' ')[0]+'!</div>'
    +'<div style="text-align:center;color:#15803d;font-size:13px;margin-bottom:14px;background:#dcfce7;border:1px solid #bbf7d0;border-radius:9px;padding:9px;line-height:1.7">'
    +'✨ تمّت دعوتك للانضمام. أكمل التسجيل خلال <b>'+daysLeft+'</b> '+(daysLeft===1?'يوم':'أيام')+' المتبقّية.'
    +'</div>'
    +'<div id="ive" class="err-box" style="display:none"></div>'
    +'<div class="f"><label>الاسم</label><input id="iv-rg-nm" class="fr-inp" value="'+nm.replace(/"/g,'&quot;')+'" readonly style="background:#f8fafc"></div>'
    +'<div class="f"><label>رقم الجوال</label><input id="iv-rg-ph" class="fr-inp" type="tel" value="'+ph.replace(/"/g,'&quot;')+'" readonly style="background:#f8fafc"></div>'
    +'<div class="f"><label>اسم المستخدم *</label><input id="iv-rg-un" class="fr-inp" placeholder="username" autocomplete="username"></div>'
    +'<div class="f"><label>كلمة المرور *</label><input id="iv-rg-pw" class="fr-inp" type="password" placeholder="••••••••" autocomplete="new-password"></div>'
    +'<button class="auth-btn" id="iv-rb" onclick="doInviteRegister(\''+token.replace(/'/g,"\\'")+'\')">إنشاء الحساب ودخول</button>'
    +'</div>';
}

async function doInviteRegister(token){
  var un = ($g('iv-rg-un')?.value||'').trim();
  var pw = $g('iv-rg-pw')?.value||'';
  var e = $g('ive');
  if(e){ e.style.display='none'; e.textContent=''; }
  if(!un || !pw){
    if(e){ e.textContent='أدخل اسم المستخدم وكلمة المرور'; e.style.display='block'; }
    return;
  }
  if(pw.length<4){
    if(e){ e.textContent='كلمة المرور قصيرة (٤ أحرف على الأقل)'; e.style.display='block'; }
    return;
  }
  var btn = $g('iv-rb');
  if(btn){ btn.disabled=true; btn.textContent='جاري الإنشاء…'; }
  var r = await api('POST','invite_register',{ token: token, username: un, password: pw });
  if(btn){ btn.disabled=false; btn.textContent='إنشاء الحساب ودخول'; }
  if(r && r.token){
    TK = r.token;
    localStorage.setItem('tk', TK);
    U = r.user;
    // نظّف URL من ?invite= قبل التنقّل
    try { history.replaceState({}, '', '/'); } catch(_){ }
    if(typeof shRev==='function') await shRev();
    return;
  }
  if(e){ e.textContent=(r&&r.error)||'تعذّر إنشاء الحساب'; e.style.display='block'; }
}

async function doSpecialCheck(){
  var p=($g('sp')?.value||'').trim();
  var err=$g('se');
  if(err){err.style.display='none';err.textContent='';}
  if(!p){
    if(err){err.textContent='أدخل رقم الجوال';err.style.display='block';}
    return;
  }
  var btn=$g('sb');
  if(btn){btn.disabled=true;btn.textContent='جاري التحقّق…';}
  var r=await api('POST','check_special',{phone:p});
  if(btn){btn.disabled=false;btn.textContent='تحقّق';}
  if(r&&r.allowed){
    // مصرّح له — افتح شاشة الدخول العادية
    shLogin(D.cfg||{});
    setTimeout(function(){var lp=$g('lp');if(lp){lp.value=p;$g('lw')?.focus();}},30);
    return;
  }
  // غير مصرّح أو غير موجود — ابقَ على نفس الشاشة مع رسالة
  if(err){
    err.textContent=(r&&r.error)||'رقم الجوال غير مصرّح له بالدخول الخاص';
    err.style.display='block';
  }
}
