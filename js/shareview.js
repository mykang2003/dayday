/* ============================================================
   和你第N天 · shareview.js
   分享海报页：承载 Share.render 画布并支持下载
   ============================================================ */
(function (global) {
  'use strict';
  var UI = global.UI;
  global.Views = global.Views || {};

  var payload = null;
  // 海报缓存：dataUrl + Blob + blobUrl（供 Web Share / 下载 / 长按保存兜底使用）
  var poster = { dataUrl: '', blob: null, blobUrl: '', type: '', ready: false };

  /* type: day / anniv / memory */
  function open(type, data, back) {
    payload = { type: type, data: data || {}, back: back || '/home' };
    global.Nav.go('/share');
  }
  global.ShareOpen = open;

  /* 工具：canvas → Blob（优先 toBlob，旧内核回退 dataURL 转 Blob） */
  function canvasToBlob(canvas, cb) {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(function (b) { cb(b || null); }, 'image/png');
      return;
    }
    try {
      var raw = atob(poster.dataUrl.split(',')[1] || '');
      var arr = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      cb(new Blob([arr], { type: 'image/png' }));
    } catch (e) { cb(null); }
  }

  /* a[download] 在当前环境是否可靠（iOS 微信内点击常变为打开图片而非下载 → 需兜底） */
  function anchorDownloadUsable() {
    var a = document.createElement('a');
    if (!('download' in a)) return false;
    var ua = navigator.userAgent || '';
    if (/MicroMessenger/i.test(ua) && /iPhone|iPad|iPod/i.test(ua)) return false;
    return true;
  }

  /* 回退下载：a[download] + blob URL（优先于 dataUrl，移动端更可靠） */
  function doAnchorDownload(name) {
    var href = poster.blobUrl || poster.dataUrl;
    if (!href) { UI.toast('海报暂不可用，请重试'); return; }
    var a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); }, 300);
  }

  /* 最终兜底：新标签展示海报并提示长按保存；弹窗被拦则页面内遮罩展示 */
  function showImageFallback() {
    var src = poster.dataUrl || poster.blobUrl;
    if (!src) { UI.toast('海报暂不可用，请重试'); return; }
    var win = window.open('', '_blank');
    if (win) {
      win.document.write(
        '<!doctype html><html><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
        '<title>长按图片保存</title>' +
        '<style>body{margin:0;background:#141414;text-align:center;color:#fff;' +
        'font-family:-apple-system,BlinkMacSystemFont,system-ui,"PingFang SC","Microsoft YaHei",sans-serif;' +
        'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);}' +
        'img{display:block;max-width:100%;height:auto;margin:0 auto;}' +
        'p{padding:14px;font-size:14px;color:#bbb;}</style></head>' +
        '<body><img src="' + src + '" alt="分享海报"><p>长按图片可保存到相册 / 转发给TA</p></body></html>'
      );
      win.document.close();
      UI.toast('长按图片即可保存');
      return;
    }
    // 弹窗被拦截时：当前页动态遮罩展示，长按保存
    var mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);' +
      'display:flex;align-items:center;justify-content:center;flex-direction:column;' +
      'padding:calc(12px + env(safe-area-inset-top,0px)) calc(12px + env(safe-area-inset-right,0px)) ' +
      'calc(12px + env(safe-area-inset-bottom,0px)) calc(12px + env(safe-area-inset-left,0px));';
    var img = document.createElement('img');
    img.src = src;
    img.alt = '分享海报';
    img.style.cssText = 'max-width:88vw;max-height:82vh;max-height:82dvh;border-radius:12px;';
    var tip = document.createElement('p');
    tip.style.cssText = 'color:#eee;font-size:14px;margin:14px 0 0;';
    tip.textContent = '长按图片可保存到相册，点空白处关闭';
    mask.appendChild(img);
    mask.appendChild(tip);
    mask.addEventListener('click', function () { document.body.removeChild(mask); });
    document.body.appendChild(mask);
    UI.toast('长按图片即可保存');
  }

  /* 分享模板（L）：读 LS → 无则默认 sunny；渲染时同步高亮按钮 */
  var OD = global.OurDays || {};
  var TMPL_KEY = 'shareTemplate';
  var TMPL_DEFAULT = 'sunny';
  function getTemplate() {
    var t = (OD.LS || {}).get ? OD.LS.get(TMPL_KEY, TMPL_DEFAULT) : TMPL_DEFAULT;
    return (t === 'sunny' || t === 'night' || t === 'sakura') ? t : TMPL_DEFAULT;
  }
  function setTemplateActive(t) {
    var btns = document.querySelectorAll('#share-templates .st-item');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-st') === t);
    }
  }

  function render() {
    var canvas = document.getElementById('share-canvas');
    var loading = document.getElementById('share-loading');
    var download = document.getElementById('share-download');
    if (!payload) { global.Nav.go('/home'); return; }
    poster.ready = false;
    poster.type = payload.type;
    canvas.hidden = true;
    loading.hidden = false;
    download.removeAttribute('href');
    setTemplateActive(getTemplate());
    global.Share.render(payload.type, payload.data, getTemplate()).then(function (dataUrl) {
      var img = new Image();
      img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        loading.hidden = true;
        canvas.hidden = false;
        poster.dataUrl = dataUrl;
        poster.ready = true;
        // 复用已绘好的 #share-canvas 生成 Blob，供 Web Share / 下载使用
        canvasToBlob(canvas, function (blob) {
          poster.blob = blob;
          if (poster.blobUrl) URL.revokeObjectURL(poster.blobUrl);
          poster.blobUrl = blob ? URL.createObjectURL(blob) : '';
        });
      };
      img.onerror = function () {
        loading.hidden = true;
        UI.toast('海报生成失败，请重试');
      };
      img.src = dataUrl;
    }).catch(function () {
      loading.hidden = true;
      UI.toast('海报生成失败，请重试');
    });
  }

  function bind() {
    /* 模板切换：持久化选择并重新生成海报 */
    var tmplBar = document.getElementById('share-templates');
    if (tmplBar) {
      tmplBar.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.st-item') : null;
        if (!btn || !tmplBar.contains(btn)) return;
        var t = btn.getAttribute('data-st');
        if (!t || t === getTemplate()) return;
        (OD.LS || {}).set && OD.LS.set(TMPL_KEY, t);
        setTemplateActive(t);
        render();
      });
    }

    document.getElementById('share-close').addEventListener('click', function () {
      var back = payload ? payload.back : '/home';
      payload = null;
      global.Nav.go(back);
    });

    document.getElementById('share-download').addEventListener('click', function (e) {
      e.preventDefault();
      if (!poster.ready || !poster.dataUrl) { UI.toast('海报还在生成中，请稍候'); return; }
      var name = 'ourdays-' + (poster.type || 'card') + '.png';
      // 1) Web Share API Level 2：调起系统分享面板（可存图 / 分享到微信）
      if (poster.blob && navigator.canShare && navigator.share) {
        try {
          var file = new File([poster.blob], name, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: '和你第N天', text: '我们的分享海报' })
              .catch(function (err) {
                if (err && err.name === 'AbortError') return; // 用户主动取消
                UI.toast('系统分享未完成，已尝试直接下载');
                doAnchorDownload(name);
              });
            UI.toast('请在系统面板中选择「存储图像 / 保存图片」');
            return;
          }
        } catch (err) { /* 不支持 files 分享 → 继续走下载 */ }
      }
      // 2) a[download] + blob URL
      if (anchorDownloadUsable()) { doAnchorDownload(name); return; }
      // 3) 兜底：新标签展示海报，长按保存（如 iOS 微信 WebView）
      showImageFallback();
    });
  }

  global.Views.share = { render: render };
  bind();
})(window);
