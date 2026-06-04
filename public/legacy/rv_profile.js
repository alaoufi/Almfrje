/* rv_profile.js — صفحة الملف الشخصي للمراجع
   - الحقول: gender, age, height, weight, occupation, residence
   - تظهر مرة واحدة عند أول دخول لو ناقصة (شاشة إجبارية)
   - يمكن إعادة فتحها من قائمة المراجع
*/

// التحقق من اكتمال الملف
window.rvNeedsProfile = function(){
  if(!U) return false;
  // مستخدم دور 'دعوات' حساب إشرافي ولا يحتاج تعبئة بيانات شخصية صحية
  if(U.role === 'inviter') return false;
  // ندرب الحقول الستة كلها — أي حقل ناقص يطلب التعبئة
  if(!U.gender) return true;
  if(!U.age || +U.age < 1) return true;
  if(!U.height || +U.height < 50) return true;
  if(!U.weight || +U.weight < 20) return true;
  if(!U.occupation || !String(U.occupation).trim()) return true;
  if(!U.residence || !String(U.residence).trim()) return true;
  return false;
};

// عرض الـ form — forceComplete = true يجعلها شاشة كاملة بلا مخرج
window.rvShowProfileForm = function(forceComplete){
  var u = U || {};
  var isForce = forceComplete === true;

  var h = '';
  if(isForce){
    h += '<div style="background:linear-gradient(135deg,#fef3c7,#fff);border:2px solid #f59e0b;border-right:5px solid #f59e0b;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(245,158,11,.15)">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
      + '<div style="font-size:30px;line-height:1">⚠️</div>'
      + '<div style="flex:1"><div style="font-weight:800;font-size:15px;color:#92400e;line-height:1.4">أكمل ملفك الشخصي للمتابعة</div></div>'
      + '</div>'
      + '<div style="font-size:13px;color:#78350f;line-height:1.8;padding-right:42px">'
      + '<div>لن تتمكّن من استخدام أي خدمة في الموقع (الاستمارات، المواعيد، المحادثات، التقارير...) قبل إكمال البيانات أدناه.</div>'
      + '<div style="margin-top:5px">تُضاف هذه البيانات تلقائياً لكل استمارة، وبدونها لا يمكن متابعة العمل.</div>'
      + '</div>'
      + '</div>';
  } else {
    var tipBtn = (typeof rvTipIcon==='function') ? rvTipIcon('profile_edit') : '';
    h += '<div class="ph"><div><div class="pt">👤 ملفي الشخصي '+tipBtn+'</div>'
      + '<div class="ps">ستظهر هذه البيانات تلقائياً في كل استمارة</div></div></div>';
  }

  h += '<div class="card" style="background:#fff">'
    // الجنس — أزرار راديو كبيرة
    + '<div class="f"><label style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;display:block">الجنس <span style="color:#dc2626">*</span></label>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    + _rvGenderBtn('male',  '🧔 رجل',  u.gender==='male')
    + _rvGenderBtn('female','👩 امرأة', u.gender==='female')
    + '</div></div>'

    // العمر / الطول / الوزن في صف واحد
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
    + '<div class="f" style="margin:0"><label>العمر <span style="color:#dc2626">*</span></label>'
    + '<input id="rvp-age" class="fr-inp" type="number" inputmode="numeric" min="1" max="120" value="'+(u.age||'')+'" placeholder="30"></div>'
    + '<div class="f" style="margin:0"><label>الطول (سم) <span style="color:#dc2626">*</span></label>'
    + '<input id="rvp-height" class="fr-inp" type="number" inputmode="numeric" min="50" max="250" value="'+(u.height||'')+'" placeholder="170"></div>'
    + '<div class="f" style="margin:0"><label>الوزن (كجم) <span style="color:#dc2626">*</span></label>'
    + '<input id="rvp-weight" class="fr-inp" type="number" inputmode="numeric" min="20" max="300" value="'+(u.weight||'')+'" placeholder="70"></div>'
    + '</div>'

    + '<div class="f"><label>طبيعة العمل <span style="color:#dc2626">*</span></label>'
    + '<input id="rvp-occ" class="fr-inp" value="'+htmlEsc(u.occupation||'')+'" placeholder="مثلاً: موظف، طالب، ربة منزل"></div>'

    + '<div class="f"><label>مكان الإقامة <span style="color:#dc2626">*</span></label>'
    + '<input id="rvp-res" class="fr-inp" value="'+htmlEsc(u.residence||'')+'" placeholder="مثلاً: الرياض"></div>'

    + '<div id="rvp-msg" style="font-size:12px;margin:8px 0;min-height:18px;text-align:center"></div>'

    + '<div style="display:flex;gap:8px;margin-top:10px">'
    + '<button class="btn bp" style="flex:1;padding:13px;font-size:14px;font-weight:800" id="rvp-save-btn" onclick="rvSaveProfile('+(isForce?'true':'false')+')">💾 حفظ ومتابعة</button>'
    + (isForce ? '' : '<button class="btn bs" onclick="rvGo(\'home\')">إلغاء</button>')
    + '</div>'
    + '</div>';

  $h('rv-pg', h);
  if(typeof rvBindTips==='function') setTimeout(rvBindTips,30);

  // ربط أزرار الجنس
  setTimeout(function(){
    document.querySelectorAll('[data-gender]').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('[data-gender]').forEach(function(b){ _rvGenderUnstyle(b); });
        _rvGenderStyle(btn);
        btn.dataset.selected='1';
        document.querySelectorAll('[data-gender]').forEach(function(b){
          if(b!==btn) b.dataset.selected='0';
        });
      });
    });
  }, 30);
};

function _rvGenderBtn(value, label, selected){
  var bg = selected ? '#dbeafe' : '#fff';
  var border = selected ? '#2563b0' : 'var(--border)';
  var color = selected ? '#1d4ed8' : '#475569';
  return '<button type="button" data-gender="'+value+'" data-selected="'+(selected?'1':'0')+'" '
    + 'style="background:'+bg+';border:1.5px solid '+border+';color:'+color+';padding:14px 8px;border-radius:11px;font-family:Cairo,sans-serif;font-size:14px;font-weight:800;cursor:pointer;transition:all .15s">'
    + label + '</button>';
}
function _rvGenderStyle(btn){
  btn.style.background='#dbeafe';
  btn.style.borderColor='#2563b0';
  btn.style.color='#1d4ed8';
}
function _rvGenderUnstyle(btn){
  btn.style.background='#fff';
  btn.style.borderColor='var(--border)';
  btn.style.color='#475569';
}

window.rvSaveProfile = async function(wasForced){
  var msg = $g('rvp-msg');
  function fail(t){ if(msg){ msg.style.color='#dc2626'; msg.textContent=t; } }
  function ok2(t){ if(msg){ msg.style.color='#15803d'; msg.textContent=t; } }
  if(msg){ msg.textContent=''; }

  var genderBtn = document.querySelector('[data-gender][data-selected="1"]');
  var gender = genderBtn ? genderBtn.dataset.gender : '';
  var age = +($g('rvp-age')?.value || 0);
  var height = +($g('rvp-height')?.value || 0);
  var weight = +($g('rvp-weight')?.value || 0);
  var occ = ($g('rvp-occ')?.value || '').trim();
  var res = ($g('rvp-res')?.value || '').trim();

  if(!gender) return fail('اختر الجنس');
  if(!age || age < 1 || age > 120) return fail('أدخل عمراً صحيحاً');
  if(!height || height < 50 || height > 250) return fail('أدخل طولاً صحيحاً');
  if(!weight || weight < 20 || weight > 300) return fail('أدخل وزناً صحيحاً');
  if(!occ) return fail('أدخل طبيعة العمل');
  if(!res) return fail('أدخل مكان الإقامة');

  var btn = $g('rvp-save-btn');
  if(btn){ btn.disabled=true; btn.textContent='جاري الحفظ…'; }
  var r = await api('POST', 'me_profile', { gender:gender, age:age, height:height, weight:weight, occupation:occ, residence:res });
  if(btn){ btn.disabled=false; btn.textContent='💾 حفظ ومتابعة'; }
  if(r && r.error){ return fail(r.error); }
  // تأكّد من أن السيرفر أرجع القيم المحفوظة فعلاً — لو لم يُرجعها، الحفظ لم يحدث
  if(!r || !r.profile){
    return fail('فشل الحفظ — لم يتم تأكيد البيانات من السيرفر. اضغط «تطبيق الترقيات» من الإعدادات.');
  }
  // استخدم القيم الراجعة من السيرفر (وليس قيم النموذج المحلية) كمصدر حقيقة
  U = U || {};
  U.gender    = r.profile.gender;
  U.age       = r.profile.age;
  U.height    = r.profile.height;
  U.weight    = r.profile.weight;
  U.occupation = r.profile.occupation;
  U.residence  = r.profile.residence;
  // تحقّق إضافي: لو رجعت قيمة null لأي حقل مطلوب، الحفظ نصف ناقص
  if(rvNeedsProfile()){
    return fail('لم تُحفظ بعض الحقول. تأكّد من تطبيق الترقيات في الإعدادات.');
  }

  ok2('✅ تم الحفظ');
  setTimeout(function(){
    if(wasForced){
      if(typeof shRev==='function') shRev();
    } else {
      if(typeof rvGo==='function') rvGo('home');
    }
  }, 400);
};

// nav: profile
window.rvProfile = function(){ rvShowProfileForm(false); };
