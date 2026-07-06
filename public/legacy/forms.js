/* forms.js */
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

function saveCurrentInputs(){
  // حفظ قيم الحقول الحالية في BC قبل إعادة الرسم
  BC.forEach(function(cat,ci){
    cat.fields.forEach(function(f,fi){
      var lbl=$g('lbl_'+ci+'_'+fi);if(lbl)f.label=lbl.value;
      var ph=$g('ph_'+ci+'_'+fi);if(ph)f.placeholder=ph.value;
      var tp=$g('tp_'+ci+'_'+fi);if(tp)f.field_type=tp.value;
      var rq=$g('rq_'+ci+'_'+fi);if(rq)f.required=rq.checked?1:0;
      var cf=$g('cf_'+ci+'_'+fi);if(cf)f.conditional_field=cf.value;
      var cv=$g('cv_'+ci+'_'+fi);if(cv)f.conditional_value=cv.value;
      // حفظ الخيارات
      if(f.options){
        f.options.forEach(function(opt,oi){
          var ol=$g('opt_'+ci+'_'+fi+'_'+oi);if(ol)opt.label=ol.value;
          var sl=$g('sublbl_'+ci+'_'+fi+'_'+oi);if(sl)opt.sub.label=sl.value;
          var sp=$g('subph_'+ci+'_'+fi+'_'+oi);if(sp)opt.sub.placeholder=sp.value;
          var st=$g('subtype_'+ci+'_'+fi+'_'+oi);if(st)opt.sub.type=st.value;
          var sr=$g('subrq_'+ci+'_'+fi+'_'+oi);if(sr)opt.sub.required=sr.checked;
        });
      }
    });
  });
}

function attachFldEvents(){

  document.querySelectorAll('[data-del="1"]').forEach(function(btn){
    btn.onclick=function(){if(confirmDel('حذف الحقل؟'))delField(+btn.dataset.ci,+btn.dataset.fi);};
  });

  document.querySelectorAll('[data-delopt="1"]').forEach(function(btn){
    btn.onclick=function(){
      var ci=+btn.dataset.ci,fi=+btn.dataset.fi,oi=+btn.dataset.oi;
      if(BC[ci]&&BC[ci].fields[fi]&&BC[ci].fields[fi].options){
        saveCurrentInputs();
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

