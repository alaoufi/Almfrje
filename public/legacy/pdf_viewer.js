/* pdf_viewer.js — عارض PDF داخلي بـ PDF.js (Mozilla)
   استخدم: openPdfViewer(url, title, { description, onDownload }) */

(function(){

var PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
var _loading = null;

function _loadPdfJs(){
  if (window.pdfjsLib) return Promise.resolve();
  if (_loading) return _loading;
  _loading = new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = PDFJS_CDN + '/pdf.min.js';
    s.onload = function(){
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + '/pdf.worker.min.js';
        resolve();
      } catch (e) { reject(e); }
    };
    s.onerror = function(){ reject(new Error('فشل تحميل المكتبة')); };
    document.head.appendChild(s);
  });
  return _loading;
}

// CSS مرة واحدة
function _injectCss(){
  if (document.getElementById('pdfv-css')) return;
  var st = document.createElement('style');
  st.id = 'pdfv-css';
  st.textContent =
    '#pdfv-ov{position:fixed;inset:0;background:#1f2937;z-index:10000;display:flex;flex-direction:column;font-family:Cairo,sans-serif;animation:wcfade .12s ease-out}'+
    '@keyframes wcfade{from{opacity:0}to{opacity:1}}'+
    '.pdfv-hd{background:linear-gradient(180deg,#111827,#1f2937);color:#fff;padding:10px 12px;display:flex;align-items:center;gap:8px;flex-shrink:0;box-shadow:0 2px 10px rgba(0,0,0,.4);flex-wrap:wrap}'+
    '.pdfv-btn{background:rgba(255,255,255,.1);border:none;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .15s}'+
    '.pdfv-btn:hover{background:rgba(255,255,255,.22)}'+
    '.pdfv-btn:active{background:rgba(255,255,255,.32)}'+
    '.pdfv-btn:disabled{opacity:.35;cursor:not-allowed}'+
    '.pdfv-title{flex:1;min-width:0}'+
    '.pdfv-t{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
    '.pdfv-sub{font-size:11px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}'+
    '.pdfv-zoom{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.08);border-radius:22px;padding:3px}'+
    '.pdfv-zb{background:none;border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center}'+
    '.pdfv-zb:hover{background:rgba(255,255,255,.18)}'+
    '.pdfv-zb:disabled{opacity:.3;cursor:not-allowed}'+
    '.pdfv-zlbl{font-size:12px;font-weight:700;min-width:46px;text-align:center;letter-spacing:.3px}'+
    '.pdfv-page-info{font-size:12px;font-weight:700;background:rgba(255,255,255,.08);border-radius:8px;padding:5px 10px;min-width:60px;text-align:center}'+
    '.pdfv-dl{background:#22c55e;color:#fff;border:none;padding:7px 12px;border-radius:8px;font-family:Cairo,sans-serif;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;box-shadow:0 2px 6px rgba(34,197,94,.3)}'+
    '.pdfv-dl:hover{background:#16a34a}'+
    // overflow:auto للتمرير الطبيعي بين الصفحات (عمودي) ولأفقي عند التكبير
    // touch-action: pan-x pan-y يسمح بالتمرير بإصبع واحد دون أن يتدخّل المتصفّح في pinch
    '.pdfv-body{flex:1;overflow:auto;background:#374151;padding:10px;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y}'+
    '.pdfv-pages{margin:0 auto;transition:width .14s ease-out;will-change:width;display:flex;flex-direction:column;align-items:center;gap:12px}'+
    '.pdfv-page{background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.45);display:block;width:100%;height:auto}'+
    '.pdfv-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#94a3b8;padding:60px 20px;text-align:center}'+
    '.pdfv-spin{width:38px;height:38px;border:3px solid #475569;border-top-color:#22c55e;border-radius:50%;animation:pdfv-spin .8s linear infinite}'+
    '@keyframes pdfv-spin{to{transform:rotate(360deg)}}'+
    '.pdfv-err{color:#fca5a5;text-align:center;padding:60px 20px}'+
    '.pdfv-err-icon{font-size:48px;margin-bottom:10px}'+
    '@media(max-width:560px){.pdfv-zoom{order:5;width:100%;justify-content:center;margin-top:4px}.pdfv-page-info{order:6}}';
  document.head.appendChild(st);
}

function _htmlEsc(s){
  return String(s||'').replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

// حدود التكبير
var MIN_ZOOM = 0.5;
var MAX_ZOOM = 4.0;

window.openPdfViewer = function(url, title, opts){
  opts = opts || {};
  if (!url){
    if (typeof toast==='function') toast('الملف غير متوفّر','er');
    return;
  }

  _injectCss();

  // إزالة عارض سابق إن وُجد
  var prev = document.getElementById('pdfv-ov');
  if (prev) prev.remove();

  var ov = document.createElement('div');
  ov.id = 'pdfv-ov';

  ov.innerHTML =
    '<div class="pdfv-hd">'
    + '<button class="pdfv-btn" id="pdfv-close" title="إغلاق" aria-label="إغلاق">'
    +   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    + '</button>'
    + '<div class="pdfv-title">'
    +   '<div class="pdfv-t">' + _htmlEsc(title || 'ملف PDF') + '</div>'
    +   (opts.description ? '<div class="pdfv-sub">' + _htmlEsc(opts.description) + '</div>' : '')
    + '</div>'
    + '<div class="pdfv-zoom">'
    +   '<button class="pdfv-zb" id="pdfv-zout" title="تصغير">−</button>'
    +   '<span class="pdfv-zlbl" id="pdfv-zlbl">100%</span>'
    +   '<button class="pdfv-zb" id="pdfv-zin" title="تكبير">+</button>'
    + '</div>'
    + '<div class="pdfv-page-info" id="pdfv-pinfo">— / —</div>'
    + '<button class="pdfv-dl" id="pdfv-dl" title="تنزيل">'
    +   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
    +   '<span>تنزيل</span>'
    + '</button>'
    + '</div>'
    + '<div class="pdfv-body" id="pdfv-body">'
    +   '<div class="pdfv-loader" id="pdfv-loader">'
    +     '<div class="pdfv-spin"></div>'
    +     '<div style="font-size:13px;font-weight:600">جاري تحميل العارض...</div>'
    +     '<div style="font-size:11px;color:#64748b">قد يستغرق بضع ثوانٍ للملفات الكبيرة</div>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(ov);

  var body = document.getElementById('pdfv-body');
  var zlbl = document.getElementById('pdfv-zlbl');
  var pinfo = document.getElementById('pdfv-pinfo');
  var btnZin = document.getElementById('pdfv-zin');
  var btnZout = document.getElementById('pdfv-zout');

  // pagesWrap هو الحاوية التي يتغيّر عرضها للتكبير الناعم
  var pagesWrap = document.createElement('div');
  pagesWrap.className = 'pdfv-pages';
  pagesWrap.style.width = '100%';

  // state بسيط — zoom كنسبة من العرض الكامل للحاوية
  var state = {
    pdf: null,
    zoom: 1.0,
    renderedZoom: 1.0, // الدقة التي رُسمت بها الـ canvases آخر مرة
    baseScale: 1.0,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    pinch: { active: false, startDist: 0, startZoom: 1, cx: 0, cy: 0 },
    rerenderTimer: null,
    rendering: false
  };

  function close(){
    document.removeEventListener('keydown', onKey);
    body.removeEventListener('touchstart', onTouchStart);
    body.removeEventListener('touchmove', onTouchMove);
    body.removeEventListener('touchend', onTouchEnd);
    body.removeEventListener('wheel', onWheel);
    ov.remove();
  }
  function onKey(e){
    if (e.key === 'Escape') close();
    else if (e.key === '+' || e.key === '=') applyZoom(state.zoom * 1.2);
    else if (e.key === '-') applyZoom(state.zoom / 1.2);
    else if (e.key === '0') applyZoom(1.0);
  }
  document.addEventListener('keydown', onKey);
  document.getElementById('pdfv-close').onclick = close;

  document.getElementById('pdfv-dl').onclick = function(){
    if (typeof opts.onDownload === 'function') opts.onDownload();
    else window.open(url, '_blank', 'noopener');
  };

  function applyZoom(newZoom){
    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    // حافظ على نقطة التمرير عند تغيير الحجم
    var oldZoom = state.zoom;
    var oldScrollX = body.scrollLeft;
    var oldScrollY = body.scrollTop;
    var anchorX = oldScrollX + body.clientWidth / 2;
    var anchorY = oldScrollY + body.clientHeight / 2;
    var ratio = newZoom / oldZoom;
    state.zoom = newZoom;
    pagesWrap.style.width = (newZoom * 100).toFixed(1) + '%';
    // اضبط التمرير ليبقى المحتوى مرئياً حول نقطة المنتصف
    requestAnimationFrame(function(){
      body.scrollLeft = anchorX * ratio - body.clientWidth / 2;
      body.scrollTop  = anchorY * ratio - body.clientHeight / 2;
      updatePageInfo();
    });
    zlbl.textContent = Math.round(newZoom * 100) + '%';
    btnZout.disabled = newZoom <= MIN_ZOOM + 0.01;
    btnZin.disabled  = newZoom >= MAX_ZOOM - 0.01;
    // جدول إعادة رسم بدقّة أعلى لو ابتعدت كثيراً عن المرسوم حالياً
    scheduleRerender();
  }

  // إعادة رسم بدقّة أعلى بعد استقرار التكبير — يحلّ ضباب الأحرف عند 200%+
  function scheduleRerender(){
    if (state.rerenderTimer) clearTimeout(state.rerenderTimer);
    state.rerenderTimer = setTimeout(function(){
      // أعد الرسم فقط لو ابتعدت >1.4x عن آخر دقة، ولست في وسط الـ pinch
      if (state.pinch.active) return;
      if (state.rendering) return;
      if (state.zoom > state.renderedZoom * 1.35 || state.zoom < state.renderedZoom * 0.6){
        rerenderAtCurrentZoom();
      }
    }, 350);
  }

  function rerenderAtCurrentZoom(){
    if (!state.pdf || state.rendering) return;
    state.rendering = true;
    var targetZoom = state.zoom;
    var newScale = state.baseScale * targetZoom;
    var existingCanvases = Array.from(pagesWrap.querySelectorAll('.pdfv-page'));
    if (!existingCanvases.length){ state.rendering = false; return; }

    // أولوية الرسم: الصفحات المرئية الآن ← القريبة ← البعيدة
    // هذا يعطي المستخدم نتيجة فورية (~2s) على ما يراه، والباقي في الخلفية
    var visibleTop = body.scrollTop;
    var visibleBot = visibleTop + body.clientHeight;
    function pagePriority(canvas){
      var t = canvas.offsetTop;
      var b = t + canvas.offsetHeight;
      // 0 = مرئية، 1 = قريبة (شاشة واحدة)، 2 = بعيدة
      if (b >= visibleTop && t <= visibleBot) return 0;
      if (b >= visibleTop - body.clientHeight && t <= visibleBot + body.clientHeight) return 1;
      return 2;
    }
    var pageOrder = existingCanvases.map(function(c, i){
      return { idx: i, prio: pagePriority(c) };
    }).sort(function(a, b){
      if (a.prio !== b.prio) return a.prio - b.prio;
      return a.idx - b.idx;
    });

    // ارسم وحدة تلو وحدة، استبدلها بمجرد ما تجهز — لا انتظار لكل الصفحات
    function renderOne(orderIdx){
      if (orderIdx >= pageOrder.length){
        state.rendering = false;
        state.renderedZoom = targetZoom;
        return;
      }
      // لو غيّر المستخدم zoom كثيراً، أوقف وأعد جدولة بالـ zoom الجديد
      if (Math.abs(state.zoom - targetZoom) > 0.1){
        state.rendering = false;
        scheduleRerender();
        return;
      }
      var pageIdx = pageOrder[orderIdx].idx;
      state.pdf.getPage(pageIdx + 1).then(function(page){
        var renderScale = newScale * state.dpr * 1.5;
        var viewport = page.getViewport({ scale: renderScale });
        var canvas = document.createElement('canvas');
        canvas.className = 'pdfv-page';
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise
          .then(function(){
            var old = existingCanvases[pageIdx];
            if (old && old.parentNode){
              old.parentNode.replaceChild(canvas, old);
              existingCanvases[pageIdx] = canvas;
            }
            // التالي — فاصل صغير يسمح للمتصفّح بالتنفّس
            setTimeout(function(){ renderOne(orderIdx + 1); }, 10);
          });
      }).catch(function(){
        setTimeout(function(){ renderOne(orderIdx + 1); }, 10);
      });
    }
    renderOne(0);
  }

  btnZin.onclick  = function(){ applyZoom(state.zoom * 1.25); };
  btnZout.onclick = function(){ applyZoom(state.zoom / 1.25); };

  // تتبّع الصفحة المرئية حالياً
  function updatePageInfo(){
    if (!state.pdf){ pinfo.textContent = '— / —'; return; }
    var pages = pagesWrap.querySelectorAll('.pdfv-page');
    if (!pages.length){ pinfo.textContent = '— / ' + state.pdf.numPages; return; }
    var mid = body.scrollTop + body.clientHeight / 2;
    for (var i = 0; i < pages.length; i++){
      var top = pages[i].offsetTop;
      var bot = top + pages[i].offsetHeight;
      if (mid >= top && mid <= bot){
        pinfo.textContent = (i + 1) + ' / ' + state.pdf.numPages;
        return;
      }
    }
    pinfo.textContent = '1 / ' + state.pdf.numPages;
  }
  body.addEventListener('scroll', updatePageInfo);

  // ─── Pinch zoom بإصبعين (مثل واتساب/جالـري) ────────────────────
  function dist(a, b){
    var dx = b.clientX - a.clientX;
    var dy = b.clientY - a.clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }
  function onTouchStart(e){
    if (e.touches.length === 2){
      state.pinch.active = true;
      state.pinch.startDist = dist(e.touches[0], e.touches[1]);
      state.pinch.startZoom = state.zoom;
      // أزل الـ transition حتى يتبع الحركة فوراً
      pagesWrap.style.transition = 'none';
      e.preventDefault();
    }
  }
  function onTouchMove(e){
    if (state.pinch.active && e.touches.length === 2){
      var d = dist(e.touches[0], e.touches[1]);
      if (state.pinch.startDist > 0){
        var newZoom = state.pinch.startZoom * d / state.pinch.startDist;
        newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        state.zoom = newZoom;
        pagesWrap.style.width = (newZoom * 100).toFixed(1) + '%';
        zlbl.textContent = Math.round(newZoom * 100) + '%';
      }
      e.preventDefault();
    }
  }
  function onTouchEnd(e){
    if (state.pinch.active && e.touches.length < 2){
      state.pinch.active = false;
      // أعد الـ transition للحركات الناعمة بالأزرار
      pagesWrap.style.transition = 'width .14s ease-out';
      btnZout.disabled = state.zoom <= MIN_ZOOM + 0.01;
      btnZin.disabled  = state.zoom >= MAX_ZOOM - 0.01;
      updatePageInfo();
      // أعد الرسم بدقّة الـ zoom النهائي (للوضوح بعد الـ pinch)
      scheduleRerender();
    }
  }
  body.addEventListener('touchstart', onTouchStart, { passive: false });
  body.addEventListener('touchmove',  onTouchMove,  { passive: false });
  body.addEventListener('touchend',   onTouchEnd);

  // Mouse wheel + Ctrl للتكبير على الحاسوب
  function onWheel(e){
    if (e.ctrlKey || e.metaKey){
      e.preventDefault();
      applyZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1/1.1));
    }
  }
  body.addEventListener('wheel', onWheel, { passive: false });

  // نقر مزدوج للتبديل بين 100% و 200%
  var lastTap = 0;
  body.addEventListener('click', function(){
    var now = Date.now();
    if (now - lastTap < 300){
      if (state.zoom > 1.1) applyZoom(1.0);
      else applyZoom(2.0);
    }
    lastTap = now;
  });

  // ─── الرسم: مرّة واحدة، resolution عالية ────────────────────────
  function renderPage(pageNum, baseScale){
    return state.pdf.getPage(pageNum).then(function(page){
      // ارسم بدقّة 2x DPR لضمان وضوح حتى عند 200% تكبير CSS
      var renderScale = baseScale * state.dpr * 2;
      var viewport = page.getViewport({ scale: renderScale });
      var canvas = document.createElement('canvas');
      canvas.className = 'pdfv-page';
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      // CSS width:100% (من stylesheet) — الـ canvas يملأ pagesWrap بنفسه
      pagesWrap.appendChild(canvas);
      return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
    });
  }

  function renderAll(){
    if (!state.pdf) return;
    body.appendChild(pagesWrap);
    pagesWrap.innerHTML = '';
    // base scale ليناسب عرض الجسم — pagesWrap 100% = هذا العرض
    state.pdf.getPage(1).then(function(p){
      var natural = p.getViewport({ scale: 1.0 });
      var available = body.clientWidth - 20;
      var baseScale = Math.min(2.0, available / natural.width);
      state.baseScale = baseScale;
      state.renderedZoom = 1.0;
      var chain = Promise.resolve();
      for (var i = 1; i <= state.pdf.numPages; i++){
        (function(n){
          chain = chain.then(function(){ return renderPage(n, baseScale); });
        })(i);
      }
      chain.then(updatePageInfo);
    });
  }

  // ابدأ التحميل
  _loadPdfJs().then(function(){
    return window.pdfjsLib.getDocument({ url: url, withCredentials: false }).promise;
  }).then(function(pdf){
    state.pdf = pdf;
    var loader = document.getElementById('pdfv-loader');
    if (loader) loader.remove();
    pinfo.textContent = '1 / ' + pdf.numPages;
    renderAll();
  }).catch(function(err){
    var loader = document.getElementById('pdfv-loader');
    if (loader){
      loader.innerHTML =
        '<div class="pdfv-err-icon">⚠️</div>'
        + '<div style="font-weight:700;color:#fff;margin-bottom:6px">تعذّر تحميل الملف</div>'
        + '<div style="font-size:12px;color:#94a3b8;margin-bottom:14px">' + _htmlEsc(err.message || 'خطأ غير معروف') + '</div>'
        + '<a href="' + url + '" target="_blank" rel="noopener" style="background:#22c55e;color:#fff;padding:9px 18px;border-radius:9px;text-decoration:none;font-weight:700;font-size:13px">فتح في تبويب جديد</a>';
    }
  });
};

// ─── عارض صور بتكبير + سحب (مشترك للتقارير) ────────────────────
function _injectImgCss(){
  if (document.getElementById('imgv-css')) return;
  var st = document.createElement('style');
  st.id = 'imgv-css';
  st.textContent =
    '#imgv-ov{position:fixed;inset:0;background:#0f172a;z-index:10001;display:flex;flex-direction:column;font-family:Cairo,sans-serif;animation:wcfade .12s ease-out}'+
    '.imgv-hd{background:linear-gradient(180deg,#0f172a,#1e293b);color:#fff;padding:8px 12px;display:flex;align-items:center;gap:8px;flex-shrink:0;box-shadow:0 2px 10px rgba(0,0,0,.4)}'+
    '.imgv-btn{background:rgba(255,255,255,.1);border:none;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .15s}'+
    '.imgv-btn:hover{background:rgba(255,255,255,.22)}'+
    '.imgv-zoom{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.08);border-radius:22px;padding:3px;margin-right:auto}'+
    '.imgv-zb{background:none;border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center}'+
    '.imgv-zb:hover{background:rgba(255,255,255,.18)}'+
    '.imgv-zb:disabled{opacity:.3;cursor:not-allowed}'+
    '.imgv-zlbl{font-size:12px;font-weight:700;min-width:46px;text-align:center}'+
    '.imgv-body{flex:1;overflow:hidden;background:#1e293b;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:grab;-webkit-overflow-scrolling:touch;user-select:none}'+
    '.imgv-body.dragging{cursor:grabbing}'+
    '.imgv-img{max-width:100%;max-height:100%;display:block;transform-origin:center;transition:transform .12s ease-out;will-change:transform;-webkit-user-drag:none;user-drag:none;pointer-events:none}';
  document.head.appendChild(st);
}

window.openImageViewer = function(url, title){
  if (!url) return;
  _injectImgCss();
  var prev = document.getElementById('imgv-ov'); if (prev) prev.remove();
  var ov = document.createElement('div');
  ov.id = 'imgv-ov';
  ov.innerHTML =
    '<div class="imgv-hd">'
    + '<button class="imgv-btn" id="imgv-close" title="إغلاق">'
    +   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    + '</button>'
    + '<div style="flex:1;font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _htmlEsc(title || 'صورة') + '</div>'
    + '<div class="imgv-zoom">'
    +   '<button class="imgv-zb" id="imgv-zout">−</button>'
    +   '<span class="imgv-zlbl" id="imgv-zlbl">100%</span>'
    +   '<button class="imgv-zb" id="imgv-zin">+</button>'
    + '</div>'
    + '<button class="imgv-btn" id="imgv-fit" title="ملاءمة">'
    +   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4"/></svg>'
    + '</button>'
    + '<a href="' + url + '" target="_blank" rel="noopener" class="imgv-btn" title="فتح في تبويب جديد" style="text-decoration:none">'
    +   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'
    + '</a>'
    + '</div>'
    + '<div class="imgv-body" id="imgv-body">'
    +   '<img class="imgv-img" id="imgv-img" src="' + url + '" alt="صورة">'
    + '</div>';
  document.body.appendChild(ov);

  var body = document.getElementById('imgv-body');
  var img = document.getElementById('imgv-img');
  var zlbl = document.getElementById('imgv-zlbl');
  var state = { scale: 1, tx: 0, ty: 0, dragging: false, startX: 0, startY: 0, pinchDist: 0, pinchStartScale: 1 };

  function apply(){
    img.style.transform = 'translate(' + state.tx + 'px,' + state.ty + 'px) scale(' + state.scale + ')';
    zlbl.textContent = Math.round(state.scale * 100) + '%';
  }
  function zoomTo(newScale, cx, cy){
    newScale = Math.max(0.5, Math.min(5, newScale));
    if (cx == null){
      var rect = body.getBoundingClientRect();
      cx = rect.width / 2; cy = rect.height / 2;
    }
    // pivot zoom: keep cx/cy stable
    var rect2 = body.getBoundingClientRect();
    var px = cx - rect2.left - rect2.width / 2;
    var py = cy - rect2.top - rect2.height / 2;
    var factor = newScale / state.scale;
    state.tx = px - (px - state.tx) * factor;
    state.ty = py - (py - state.ty) * factor;
    state.scale = newScale;
    if (newScale <= 1){ state.tx = 0; state.ty = 0; }
    apply();
  }

  document.getElementById('imgv-zin').onclick = function(){ zoomTo(state.scale * 1.4); };
  document.getElementById('imgv-zout').onclick = function(){ zoomTo(state.scale / 1.4); };
  document.getElementById('imgv-fit').onclick = function(){ state.scale=1;state.tx=0;state.ty=0;apply(); };

  function close(){
    document.removeEventListener('keydown', onKey);
    ov.remove();
  }
  function onKey(e){
    if (e.key === 'Escape') close();
    else if (e.key === '+' || e.key === '=') zoomTo(state.scale * 1.4);
    else if (e.key === '-') zoomTo(state.scale / 1.4);
    else if (e.key === '0') { state.scale=1;state.tx=0;state.ty=0;apply(); }
  }
  document.addEventListener('keydown', onKey);
  document.getElementById('imgv-close').onclick = close;

  // mouse drag
  body.addEventListener('mousedown', function(e){
    if (state.scale <= 1) return;
    state.dragging = true; state.startX = e.clientX - state.tx; state.startY = e.clientY - state.ty;
    body.classList.add('dragging');
  });
  document.addEventListener('mousemove', function(e){
    if (!state.dragging) return;
    state.tx = e.clientX - state.startX; state.ty = e.clientY - state.startY; apply();
  });
  document.addEventListener('mouseup', function(){
    state.dragging = false; body.classList.remove('dragging');
  });

  // mouse wheel zoom
  body.addEventListener('wheel', function(e){
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.15 : 1/1.15;
    zoomTo(state.scale * factor, e.clientX, e.clientY);
  }, { passive: false });

  // touch: drag + pinch
  body.addEventListener('touchstart', function(e){
    if (e.touches.length === 1 && state.scale > 1){
      state.dragging = true;
      state.startX = e.touches[0].clientX - state.tx;
      state.startY = e.touches[0].clientY - state.ty;
    } else if (e.touches.length === 2){
      var dx = e.touches[1].clientX - e.touches[0].clientX;
      var dy = e.touches[1].clientY - e.touches[0].clientY;
      state.pinchDist = Math.sqrt(dx*dx + dy*dy);
      state.pinchStartScale = state.scale;
      state.dragging = false;
    }
  }, { passive: true });
  body.addEventListener('touchmove', function(e){
    if (e.touches.length === 1 && state.dragging){
      state.tx = e.touches[0].clientX - state.startX;
      state.ty = e.touches[0].clientY - state.startY;
      apply();
      e.preventDefault();
    } else if (e.touches.length === 2){
      var dx = e.touches[1].clientX - e.touches[0].clientX;
      var dy = e.touches[1].clientY - e.touches[0].clientY;
      var dist = Math.sqrt(dx*dx + dy*dy);
      if (state.pinchDist > 0){
        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomTo(state.pinchStartScale * dist / state.pinchDist, cx, cy);
      }
      e.preventDefault();
    }
  }, { passive: false });
  body.addEventListener('touchend', function(){ state.dragging = false; state.pinchDist = 0; });

  // double-click/tap to toggle zoom
  var lastTap = 0;
  body.addEventListener('click', function(e){
    var now = Date.now();
    if (now - lastTap < 300){
      if (state.scale > 1.1) { state.scale=1;state.tx=0;state.ty=0;apply(); }
      else zoomTo(2.5, e.clientX, e.clientY);
    }
    lastTap = now;
  });
};

// نُحدِّث rptLightbox القديم ليستخدم العارض الجديد (التقارير الصور)
window.rptLightbox = function(url){ window.openImageViewer(url, 'صورة التقرير'); };

})();
