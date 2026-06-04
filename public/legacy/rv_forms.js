/* rv_forms.js */

async function rvForms(){
  // جلب الاستمارات المرشحة فقط
  ld(1);
  var asgn=await api('GET','assignments');
  ld(0);
  var myForms=Array.isArray(asgn)?asgn:[];
  // إضافة form_id للفلترة
  D._myAssignments=myForms;
  var h='<div class="ph"><div><div class="pt">📋 الاستمارات</div></div></div>';

  if(!myForms.length){
    h+='<div style="text-align:center;padding:48px 16px;color:var(--light)">';
    h+='<div style="font-size:48px;margin-bottom:12px">📋</div>';
    h+='<p>لم يتم ترشيحك في استمارة بعد</p></div>';
    $h('rv-pg',h);return;
  }

  myForms.forEach(function(f){
    var sub=(D.sub||[]).find(function(s){return +s.form_id===+f.form_id&&+s.reviewer_id===(U&&+U.id);});
    f.id=f.form_id;f.title=f.form_title;
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:13px;padding:14px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.05)">';
    h+='<div style="font-weight:800;font-size:15px;margin-bottom:3px">'+htmlEsc(f.title||'')+'</div>';
    h+='<div style="font-size:12px;color:var(--mid);margin-bottom:10px">'+(f.section_name||'—')+'</div>';
    if(sub){
      h+='<div style="display:flex;align-items:center;justify-content:space-between">';
      h+='<span style="background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">'+rvSubStatusLabel(sub.status)+'</span>';
      h+='<button class="btn bs bsm" data-viewsub="'+sub.id+'">عرض الإجابات</button>';
      h+='</div>';
    } else {
      h+='<button class="btn bp" style="width:100%" data-openform="'+f.id+'">📝 تعبئة الاستمارة</button>';
    }
    h+='</div>';
  });

  $h('rv-pg',h);
  setTimeout(function(){
    document.querySelectorAll('[data-openform]').forEach(function(btn){
      btn.addEventListener('click',function(){rvOpenForm(+btn.dataset.openform);});
    });
    document.querySelectorAll('[data-viewsub]').forEach(function(btn){
      btn.addEventListener('click',function(){rvViewSub(+btn.dataset.viewsub);});
    });
  },50);
}

async function rvOpenForm(fid){
  // فحص إذا كانت مُرسلة مسبقاً
  var existSub=(D.sub||[]).find(function(s){return s.form_id===fid&&s.reviewer_id===(U&&U.id);});
  if(existSub){rvViewSub(existSub.id);return;}
  ld(1);
  var r=await api('GET','forms/'+fid);
  ld(0);
  if(r.error){toast(r.error,'er');return;}
  var fields=r.fields||[];
  var cats=[...new Set(fields.map(function(f){return f.category||'عام';}))];

  var INP='width:100%;padding:11px 13px;border:1px solid #e2e8f0;border-radius:10px;font-family:Cairo,sans-serif;font-size:14px;outline:none;background:#fafbfc;color:#1e293b;transition:border .15s,background .15s;box-sizing:border-box';
  var INP_FOCUS=';onfocus="this.style.borderColor=\'#075e54\';this.style.background=\'#fff\'" onblur="this.style.borderColor=\'#e2e8f0\';this.style.background=\'#fafbfc\'"';

  var h='';

  // كرت العنوان الرئيسي
  h+='<div style="background:linear-gradient(135deg,#075e54 0%,#128c7e 100%);color:#fff;border-radius:16px;padding:18px 16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(7,94,84,.22)">';
  h+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">';
  h+='<div style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📋</div>';
  h+='<div style="flex:1;min-width:0">';
  h+='<div style="font-size:16px;font-weight:800;line-height:1.3">'+htmlEsc(r.title||'')+'</div>';
  if(r.subtitle) h+='<div style="font-size:12px;opacity:.85;margin-top:2px">'+htmlEsc(r.subtitle)+'</div>';
  h+='</div></div>';
  h+='<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;opacity:.9;margin-top:8px"><span>✨</span><span>تعبئة الاستمارة لا تأخذ وقتاً، خطوة بخطوة</span></div>';
  h+='</div>';

  cats.forEach(function(cat,catIdx){
    var catFields=fields.filter(function(f){return (f.category||'عام')===cat;});

    h+='<div style="background:#fff;border:1px solid #eef2f7;border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:0 1px 3px rgba(15,23,42,.04)">';
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed #e8eef5">';
    h+='<div style="width:24px;height:24px;border-radius:50%;background:#dcf8c6;color:#075e54;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">'+(catIdx+1)+'</div>';
    h+='<div style="font-weight:700;font-size:13.5px;color:#1e293b">'+htmlEsc(cat)+'</div>';
    h+='<div style="margin-right:auto;font-size:11px;color:#94a3b8">'+catFields.length+' حقل</div>';
    h+='</div>';

    catFields.forEach(function(f){
      var fid2='ans_'+f.id;
      var opts=Array.isArray(f.options)?f.options:(typeof f.options==='string'?(function(){try{var x=JSON.parse(f.options);return Array.isArray(x)?x:[];}catch(e){return[];}})():[]);
      function getLabel(o){return typeof o==='object'&&o?(o.label||''):String(o);}

      h+='<div style="margin-bottom:10px">';
      h+='<label style="display:block;font-size:12.5px;font-weight:600;margin-bottom:5px;color:#475569">'+htmlEsc(f.label||'')+(f.required?'<span style="color:#ef4444;margin-right:3px"> *</span>':'')+'</label>';

      if(f.field_type==='textarea'){
        h+='<textarea id="'+fid2+'" placeholder="'+(f.placeholder||'')+'" style="'+INP+';height:78px;resize:none"'+INP_FOCUS.slice(1)+'></textarea>';
      } else if(f.field_type==='select'){
        h+='<div style="position:relative">';
        h+='<select id="'+fid2+'" style="'+INP+';-webkit-appearance:none;padding-left:30px;cursor:pointer">';
        h+='<option value="">— اختر —</option>';
        opts.forEach(function(o){var ol=getLabel(o);h+='<option value="'+ol+'">'+ol+'</option>';});
        h+='</select>';
        h+='<span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none;color:#94a3b8;font-size:11px">▾</span></div>';
        h+='<div id="sub_'+fid2+'"></div>';
      } else if(f.field_type==='radio'){
        h+='<div style="display:flex;flex-direction:column;gap:5px">';
        opts.forEach(function(o,oi){
          var ol=getLabel(o);
          var hasSub=typeof o==='object'&&o.has_sub&&o.sub&&o.sub.label;
          var subId='sub_'+fid2+'_opt_'+oi;
          var wrapId='wrap_'+fid2+'_'+oi;
          h+='<div id="'+wrapId+'">';
          h+='<label style="display:flex;align-items:center;gap:9px;padding:9px 11px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:9px;cursor:pointer;transition:background .15s,border .15s;font-size:13.5px;color:#1e293b" onmouseover="this.style.background=\'#f0f9f4\'" onmouseout="this.style.background=\'#fafbfc\'">'
            +'<input type="radio" name="'+fid2+'" value="'+ol+'" style="accent-color:#075e54;width:16px;height:16px"'
            +' data-subid="'+(hasSub?subId:'')+'" data-hassub="'+(hasSub?'1':'0')+'"'
            +' data-wrapid="'+wrapId+'" onchange="rvRadioChange(this);rvShowOptSub(this)"> '+htmlEsc(ol)+'</label>';
          if(hasSub){
            var sub=o.sub;
            var t2=sub.type==='number'?'number':sub.type==='date'?'date':sub.type==='phone'?'tel':'text';
            h+='<div id="'+subId+'" style="display:none;margin:6px 22px 0 0;padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">';
            h+='<label style="display:block;font-size:11.5px;font-weight:600;color:#92400e;margin-bottom:4px">↳ '+htmlEsc(sub.label)+(sub.required?'<span style="color:#ef4444"> *</span>':'')+'</label>';
            if(sub.type==='textarea'){
              h+='<textarea id="subans_'+fid2+'_'+oi+'" placeholder="'+(sub.placeholder||'')+'" style="'+INP+';height:60px;resize:none;background:#fff"></textarea>';
            } else {
              h+='<input type="'+t2+'" id="subans_'+fid2+'_'+oi+'" placeholder="'+(sub.placeholder||'')+'" style="'+INP+';background:#fff">';
            }
            h+='</div>';
          }
          h+='</div>';
        });
        h+='</div>';
      } else if(f.field_type==='checkbox'){
        h+='<div style="display:flex;flex-direction:column;gap:5px">';
        opts.forEach(function(o,oi){
          var ol=getLabel(o);
          h+='<label style="display:flex;align-items:center;gap:9px;padding:9px 11px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:9px;cursor:pointer;transition:background .15s;font-size:13.5px;color:#1e293b" onmouseover="this.style.background=\'#f0f9f4\'" onmouseout="this.style.background=\'#fafbfc\'">'
            +'<input type="checkbox" id="'+fid2+'_cb_'+oi+'" value="'+ol+'" style="accent-color:#075e54;width:16px;height:16px"> '+htmlEsc(ol)+'</label>';
        });
        h+='</div>';
      } else if(f.field_type==='date'){
        h+='<input type="date" id="'+fid2+'" style="'+INP+'">';
      } else if(f.field_type==='number'){
        h+='<input type="number" id="'+fid2+'" placeholder="'+(f.placeholder||'')+'" style="'+INP+'">';
      } else if(f.field_type==='phone'){
        h+='<input type="tel" id="'+fid2+'" placeholder="'+(f.placeholder||'+966...')+'" style="'+INP+'">';
      } else {
        h+='<input type="text" id="'+fid2+'" placeholder="'+(f.placeholder||'')+'" style="'+INP+'">';
      }
      h+='</div>';
    });

    h+='</div>';
  });

  // زر الإرسال — كرت بارز
  h+='<div style="background:#fff;border:1px solid #eef2f7;border-radius:14px;padding:14px;margin-bottom:14px;text-align:center;box-shadow:0 1px 3px rgba(15,23,42,.04)">';
  h+='<div style="font-size:13px;color:#475569;margin-bottom:10px">جاهز؟ راجع إجاباتك ثم أرسل الاستمارة 👇</div>';
  h+='<button class="btn bp" style="width:100%;padding:14px;font-size:15px;font-weight:800;background:linear-gradient(135deg,#075e54,#128c7e);border:none;border-radius:11px;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(7,94,84,.25)" onclick="rvSubmitForm('+fid+')">✅ إرسال الاستمارة</button>';
  h+='</div>';

  $h('rv-pg',h);
  window._rv_current_fields=fields;
}

async function rvSubmitForm(fid){
  var fields=window._rv_current_fields||[];
  var answers=[];
  var errors=[];

  fields.forEach(function(f){
    var fid2='ans_'+f.id;
    var val='';
    if(f.field_type==='radio'){
      var sel=document.querySelector('[name="'+fid2+'"]:checked');
      val=sel?sel.value:'';
    } else if(f.field_type==='checkbox'){
      var checked=[];
      var opts=Array.isArray(f.options)?f.options:[];
      opts.forEach(function(o,oi){
        var cb=$g(fid2+'_cb_'+oi);
        if(cb&&cb.checked) checked.push(typeof o==='object'?(o.label||''):String(o));
      });
      val=checked.join('، ');
    } else {
      var el=$g(fid2);
      val=el?el.value:'';
    }
    if(f.required&&!String(val).trim()){
      errors.push(f.label);
    }
    if(val) answers.push({field_id:f.id,answer:String(val)});
  });

  if(errors.length){
    // تمييز الحقول الفارغة بالأحمر
    fields.forEach(function(f){
      if(errors.includes(f.label)){
        var el=$g('ans_'+f.id);
        if(el){
          el.style.borderColor='#ef4444';
          el.style.background='#fff5f5';
          setTimeout(function(){
            el.style.borderColor='';
            el.style.background='';
          },3000);
        }
        // تمييز radio/checkbox
        var wrap=$g('wrap_ans_'+f.id+'_0')||document.querySelector('[name="ans_'+f.id+'"]');
        if(wrap){
          var parent=wrap.closest('div');
          if(parent){
            parent.style.border='2px solid #ef4444';
            parent.style.borderRadius='8px';
            parent.style.padding='6px';
            setTimeout(function(){parent.style.border='';parent.style.padding='';},3000);
          }
        }
      }
    });
    toast('⚠️ يرجى تعبئة: '+errors.join('، '),'er');
    // التمرير للحقل الأول الفارغ
    var firstErr=errors[0];
    var firstField=fields.find(function(f){return f.label===firstErr;});
    if(firstField){
      var el2=$g('ans_'+firstField.id);
      if(el2) el2.scrollIntoView({behavior:'smooth',block:'center'});
    }
    return;
  }
  if(!answers.length){toast('لا توجد إجابات','er');return;}
  oConfirm('بعد الإرسال لا يمكن التعديل.',function(){_doRvSubmit(fid,answers);},{icon:'📋',yes:'إرسال',no:'مراجعة'});return;

  ld(1);
  var r=await api('POST','submissions',{form_id:fid,answers:answers});
  ld(0);
  if(r.error){toast(r.error,'er');return;}
  toast('✅ تم إرسال الاستمارة بنجاح');
  await lSub();
  rvHome();
}

async function rvViewSub(sid){
  ld(1);
  var r=await api('GET','submissions/'+sid);
  ld(0);
  if(r.error){toast(r.error,'er');return;}

  var h='';

  // الهيدر
  h+='<div style="margin-bottom:12px">';
  h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
  h+='<button class="btn bs bsm" onclick="rvForms()">← رجوع</button>';
  h+='<div style="font-weight:800;font-size:16px">'+htmlEsc(r.form_title||'')+'</div>';
  h+='</div>';
  h+='<div style="font-size:12px;color:var(--mid)">👤 '+(r.reviewer_name||'')+'  •  '+((r.created_at||'')).slice(0,16)+'</div>';
  h+='<div style="margin-top:6px"><span style="background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">'+rvSubStatusLabel(r.status)+'</span></div>';
  h+='</div>';

  // ملاحظات الإدارة - تظهر فقط إذا وجدت
  if(r.reviewer_notes){
    h+='<div style="background:#fffbeb;border:1px solid #fcd34d;border-right:4px solid #f59e0b;border-radius:10px;padding:12px;margin-bottom:12px">';
    h+='<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:5px">💬 ملاحظات الإدارة</div>';
    h+='<div style="font-size:14px;color:#1e293b">'+htmlEsc(r.reviewer_notes)+'</div>';
    h+='</div>';
  }

  // بطاقات الإجابات - للاطلاع فقط بدون تمييز
  (r.answers||[]).forEach(function(a){
    h+='<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.06)">';
    h+='<div style="font-size:12px;font-weight:700;color:var(--blue2);margin-bottom:6px">'+htmlEsc(a.label||'')+'</div>';
    h+='<div style="font-size:14px;color:#1e293b;line-height:1.6">'+htmlEsc(a.answer||'—')+'</div>';
    h+='</div>';
  });

  $h('rv-pg',h);
}

