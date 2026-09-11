/* ============================================================
   和你第N天 · memory.js
   回忆：卡片 / 添加·编辑表单 / 详情 / 删除 / 分享（PRD 8/9/15）
   ============================================================ */
(function (global) {
  'use strict';
  var OD = global.OurDays;
  var Utils = OD.Utils;
  var State = OD.State;
  var UI = global.UI;

  global.Views = global.Views || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------- 图片压缩 ---------- */
  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }
  function compressImage(dataUrl, maxSide) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        var scale = 1;
        if (Math.max(w, h) > (maxSide || 1280)) scale = (maxSide || 1280) / Math.max(w, h);
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      // 解码失败（如 iOS 未转码的 HEIC）→ 返回 null，由调用方提示并跳过
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }

  /* ---------- 回忆卡片（首页/列表复用） ---------- */
  function buildCard(memory) {
    var el = document.createElement('div');
    el.className = 'memory-card';
    var photo = memory.photos && memory.photos.length ? memory.photos[0] : null;
    var content = (memory.content || '').trim();
    el.innerHTML =
      (photo
        ? '<div class="mc-photo"></div>'
        : '<div class="mc-photo mc-no-photo"><span>📷</span></div>') +
      '<div class="mc-body">' +
        '<div class="mc-title">' + esc(memory.title || '这一刻') + '</div>' +
        '<div class="mc-date">' + esc(memory.date || '') + '</div>' +
        (content ? '<div class="mc-content">' + esc(content) + '</div>' : '') +
      '</div>';
    if (photo) {
      OD.PhotoStore.get(photo.id).then(function (url) {
        if (!url) return;
        var box = el.querySelector('.mc-photo');
        if (box) box.innerHTML = '<img src="' + url + '" alt="' + esc(memory.title || '回忆照片') + '">';
      });
    }
    el.addEventListener('click', function () {
      global.Nav.go('/memory/detail?id=' + memory.id);
    });
    return { el: el };
  }
  global.Card = { build: buildCard };

  /* ================= 表单状态 ================= */
  var form = {
    id: null,            // 编辑中的 memory id，null 为新建
    photos: [],          // [{id, dataUrl}]
    originalPhotoIds: [] // 编辑前的旧照片 id（用于清理删除）
  };
  var MAX_PHOTOS = 9;
  var prevContentLen = 0;

  function resetForm(id) {
    form.id = id || null;
    form.photos = [];
    form.originalPhotoIds = [];
    document.getElementById('mem-title').value = '';
    document.getElementById('mem-content').value = '';
    document.getElementById('mem-content-count').textContent = '0';
    document.getElementById('mem-date').value = Utils.fmtInput(Utils.today());
    document.getElementById('mem-ai-status').hidden = true;
    document.getElementById('mem-ai-status').textContent = '';
    document.getElementById('mem-photos').innerHTML = '';
    setMood('happy');
    renderUploader();
  }

  function setMood(key) {
    form.mood = key;
    var chips = document.querySelectorAll('.mood-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('active', chips[i].getAttribute('data-mood') === key);
    }
  }

  function renderUploader() {
    var el = document.getElementById('mem-uploader');
    el.style.display = form.photos.length >= MAX_PHOTOS ? 'none' : '';
    var file = document.getElementById('mem-file');
    file.setAttribute('accept', 'image/*');
    file.multiple = true;
  }

  function renderPhotoPreview() {
    var box = document.getElementById('mem-photos');
    box.innerHTML = '';
    form.photos.forEach(function (p, idx) {
      var thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      thumb.innerHTML = '<img src="' + p.dataUrl + '" alt="照片预览">' +
        '<button type="button" class="pt-del" data-del-idx="' + idx + '" aria-label="移除照片">✕</button>';
      box.appendChild(thumb);
    });
    var delBtns = box.querySelectorAll('.pt-del');
    for (var i = 0; i < delBtns.length; i++) {
      delBtns[i].addEventListener('click', function () {
        var idx = +this.getAttribute('data-del-idx');
        form.photos.splice(idx, 1);
        renderPhotoPreview();
        renderUploader();
      });
    }
    renderUploader();
  }

  function handleFiles(files) {
    var remain = MAX_PHOTOS - form.photos.length;
    var valid = [];
    for (var i = 0; i < files.length && valid.length < remain; i++) {
      var f = files[i];
      // 放宽为任意 image/*：iOS 相册可能返回 HEIC 等格式，可解码的会被自动压缩为 JPEG
      if (f && /^image\//i.test(f.type)) valid.push(f);
    }
    if (!valid.length) { UI.toast('请选择图片文件'); return; }
    var seq = valid.map(function (file) {
      return fileToDataUrl(file).then(function (dataUrl) {
        return compressImage(dataUrl, 1280).then(function (small) {
          return small ? { id: Utils.uid('ph'), dataUrl: small } : null;
        });
      }).catch(function () { return null; });
    });
    Promise.all(seq).then(function (items) {
      var ok = 0;
      items.forEach(function (it) { if (it && it.dataUrl) { form.photos.push(it); ok++; } });
      renderPhotoPreview();
      if (!ok) { UI.toast('这些图片暂时无法识别，换几张试试'); return; }
      if (valid.length < files.length) UI.toast('最多添加 9 张照片');
    });
  }

  /* ---------- AI 帮我写 ---------- */
  function aiWrite() {
    var title = document.getElementById('mem-title').value.trim();
    var content = document.getElementById('mem-content').value.trim();
    var dateVal = document.getElementById('mem-date').value;
    var couple = State.couple() || {};
    var statusEl = document.getElementById('mem-ai-status');
    statusEl.hidden = false;
    statusEl.textContent = '✨ 正在帮你写下来…';
    var btn = document.getElementById('mem-ai-write');
    btn.disabled = true;

    global.AI.writeMemory({
      title: title, content: content, mood: form.mood,
      dateStr: dateVal ? Utils.fmtCN(Utils.parseDate(dateVal)) : '',
      myName: couple.myName, taName: couple.taName
    }).then(function (text) {
      btn.disabled = false;
      var contentEl = document.getElementById('mem-content');
      if (!contentEl.value.trim()) {
        contentEl.value = text;
        document.getElementById('mem-content-count').textContent = String(text.length);
        statusEl.hidden = true;
        UI.toast('写好啦，可以再改改');
      } else {
        statusEl.hidden = true;
        UI.tipSheet('AI 也写了一版：\n\n' + text + '\n\n你可以把喜欢的部分抄到正文里，再微调。', '✨ AI 草稿');
      }
    }).catch(function () {
      btn.disabled = false;
      statusEl.textContent = '';
      statusEl.hidden = true;
      UI.toast('AI 今天有点害羞，先把这段文字保存下来吧');
    });
  }

  /* ---------- 保存 ---------- */
  function saveMemory() {
    var title = document.getElementById('mem-title').value.trim();
    var content = document.getElementById('mem-content').value.trim();
    var dateVal = document.getElementById('mem-date').value;

    if (!dateVal) { UI.toast('请选择日期'); return; }
    var d = Utils.parseDate(dateVal);
    if (d > Utils.today()) { UI.toast('这一天还没到哦，换一个日期吧'); return; }
    if (!title && !content && !form.photos.length) {
      UI.toast('写下一点点内容，或加一张照片吧');
      return;
    }

    var btn = document.getElementById('mem-save');
    btn.disabled = true;
    var oldHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>已记住 ❤️';

    var memories = State.memories();
    var savedId = form.id;
    var now = new Date().toISOString();

    // 照片落库
    var photoPromises = form.photos.map(function (p) {
      return OD.PhotoStore.put(p.id, p.dataUrl);
    });
    // 清理被移除的旧照片
    var keepIds = {};
    form.photos.forEach(function (p) { keepIds[p.id] = true; });
    form.originalPhotoIds.forEach(function (pid) {
      if (!keepIds[pid]) photoPromises.push(OD.PhotoStore.remove(pid));
    });

    Promise.all(photoPromises).then(function () {
      var memory = null;
      if (savedId) {
        for (var i = 0; i < memories.length; i++) {
          if (memories[i].id === savedId) { memory = memories[i]; break; }
        }
      }
      if (memory) {
        memory.title = title;
        memory.content = content;
        memory.date = dateVal;
        memory.mood = form.mood || 'happy';
        memory.photos = form.photos.map(function (p) { return { id: p.id }; });
        memory.updatedAt = now;
      } else {
        memory = {
          id: Utils.uid('memory'),
          date: dateVal,
          title: title,
          content: content,
          mood: form.mood || 'happy',
          photos: form.photos.map(function (p) { return { id: p.id }; }),
          createdAt: now,
          updatedAt: now
        };
        memories.push(memory);
      }
      State.saveMemories(memories);
      btn.disabled = false;
      btn.innerHTML = oldHtml;

      UI.confirm({
        title: '❤️ 这一天被记住了',
        text: '已加入你们的故事。',
        okText: '查看回忆',
        cancelText: '继续记录',
        danger: false
      }).then(function (view) {
        if (view) {
          global.Nav.go('/memory/detail?id=' + memory.id);
        } else {
          resetForm(null);
          // 编辑模式保存后选择“继续记录”：表单转为新建，标题应同步复位
          document.getElementById('mem-new-title').textContent = '记录这一刻';
          // 桌面端才自动聚焦，避免移动端立刻弹起键盘遮挡表单
          if (global.matchMedia && global.matchMedia('(hover: hover)').matches) {
            document.getElementById('mem-title').focus();
          }
        }
      });
    });
  }

  /* ---------- 打开表单（由路由渲染器调用） ---------- */
  function openForm(id) {
    var memories = State.memories();
    var mem = null;
    if (id) {
      for (var i = 0; i < memories.length; i++) if (memories[i].id === id) { mem = memories[i]; break; }
    }
    document.getElementById('mem-new-title').textContent = mem ? '编辑回忆' : '记录这一刻';

    if (!mem) { resetForm(null); return; }
    resetForm(mem.id);
    form.originalPhotoIds = (mem.photos || []).map(function (p) { return p.id; });
    document.getElementById('mem-title').value = mem.title || '';
    document.getElementById('mem-content').value = mem.content || '';
    document.getElementById('mem-content-count').textContent = String((mem.content || '').length);
    document.getElementById('mem-date').value = mem.date;
    setMood(mem.mood || 'happy');

    var loads = (mem.photos || []).map(function (p, idx) {
      return OD.PhotoStore.get(p.id).then(function (url) {
        if (url) form.photos.push({ id: p.id, dataUrl: url });
      });
    });
    Promise.all(loads).then(function () {
      renderPhotoPreview();
      renderUploader();
    });
  }

  /* ---------- 详情（由路由渲染器调用） ---------- */
  function openDetail(id) {
    var memories = State.memories();
    var mem = null;
    for (var i = 0; i < memories.length; i++) if (memories[i].id === id) { mem = memories[i]; break; }
    if (!mem) { UI.toast('这条回忆不存在了'); global.Nav.go('/story'); return; }
    renderDetail(mem);
  }

  function renderDetail(mem) {
    document.getElementById('detail-title').textContent = mem.title || '这一刻';
    var d = Utils.parseDate(mem.date);
    document.getElementById('detail-date').textContent = d ? Utils.fmtCN(d) : '';
    var moodEl = document.getElementById('detail-mood');
    if (mem.mood && OD.MOODS[mem.mood]) {
      moodEl.textContent = OD.MOODS[mem.mood].emoji + ' ' + OD.MOODS[mem.mood].label;
      moodEl.style.display = '';
    } else moodEl.style.display = 'none';

    document.getElementById('detail-location').style.display = 'none';
    document.getElementById('detail-content').textContent = mem.content || '';
    document.getElementById('detail-tags').innerHTML = '';

    // 照片轮播
    var photoBox = document.getElementById('detail-photos');
    photoBox.innerHTML = '';
    var photos = mem.photos || [];
    if (photos.length) {
      var n = 0;
      photos.forEach(function (p) {
        OD.PhotoStore.get(p.id).then(function (url) {
          if (!url) return;
          var img = document.createElement('img');
          img.alt = (mem.title || '回忆') + '照片';
          img.src = url;
          img.loading = 'lazy';
          photoBox.appendChild(img);
          n++;
        });
      });
    } else {
      photoBox.innerHTML = '<div class="mc-no-photo" style="display:flex;align-items:center;justify-content:center;min-height:120px;background:var(--soft);border-radius:22px;font-size:40px">💌</div>';
    }

    // 按钮行为
    document.getElementById('detail-edit').onclick = function () { global.Nav.go('/memory/new?id=' + mem.id); };
    document.getElementById('detail-share').onclick = function () { shareMemory(mem); };
    document.getElementById('detail-ai-rewrite').onclick = function () { aiRewriteDetail(mem); };
    document.getElementById('detail-delete').onclick = function () { deleteMemory(mem); };
  }

  function aiRewriteDetail(mem) {
    var couple = State.couple() || {};
    var statusTxt = '✨ 正在重新写…';
    var btn = document.getElementById('detail-ai-rewrite');
    btn.disabled = true;
    global.AI.writeMemory({
      title: mem.title, content: (mem.content || '').slice(0, 300), mood: mem.mood,
      dateStr: mem.date ? Utils.fmtCN(Utils.parseDate(mem.date)) : '',
      myName: couple.myName, taName: couple.taName
    }).then(function (text) {
      btn.disabled = false;
      UI.tipSheet('AI 重新写了一段：\n\n' + text + '\n\n想要采用的话，点「编辑」后粘贴进正文。', '✨ 新的版本');
    }).catch(function () {
      btn.disabled = false;
      UI.toast('AI 今天有点害羞，稍后再试试');
    });
  }

  function deleteMemory(mem) {
    UI.confirm({
      title: '要把这段回忆藏起来吗？',
      text: '藏起来后，它就不会出现在你们的故事里了。',
      okText: '删除',
      cancelText: '取消'
    }).then(function (ok) {
      if (!ok) return;
      var list = State.memories().filter(function (m) { return m.id !== mem.id; });
      State.saveMemories(list);
      (mem.photos || []).forEach(function (p) { OD.PhotoStore.remove(p.id); });
      UI.toast('已藏起来。');
      global.Nav.go('/story');
    });
  }

  /* ---------- 分享 ---------- */
  function shareMemory(mem) {
    var d = Utils.parseDate(mem.date);
    var photo = (mem.photos && mem.photos.length) ? null : null;
    var load = Promise.resolve(null);
    if (mem.photos && mem.photos.length) {
      load = OD.PhotoStore.get(mem.photos[0].id);
    }
    load.then(function (url) {
      global.ShareOpen('memory', {
        title: mem.title || '我们的回忆',
        dateCN: d ? Utils.fmtCN(d) : '',
        content: (mem.content || '').slice(0, 120),
        photo: url,
        moodEmoji: mem.mood && OD.MOODS[mem.mood] ? OD.MOODS[mem.mood].emoji : '❤️'
      }, '/memory/detail?id=' + mem.id);
    });
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    var uploader = document.getElementById('mem-uploader');
    var file = document.getElementById('mem-file');
    uploader.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      handleFiles(Array.prototype.slice.call(file.files || []));
      file.value = '';
    });

    var moods = document.querySelectorAll('.mood-chip');
    for (var i = 0; i < moods.length; i++) {
      moods[i].addEventListener('click', function () {
        setMood(this.getAttribute('data-mood'));
      });
    }

    document.getElementById('mem-content').addEventListener('input', function () {
      document.getElementById('mem-content-count').textContent = String(this.value.length);
    });
    document.getElementById('mem-ai-write').addEventListener('click', aiWrite);
    document.getElementById('mem-save').addEventListener('click', saveMemory);

    document.getElementById('mem-new-close').addEventListener('click', function () {
      if (form.id) { global.Nav.go('/memory/detail?id=' + form.id); }
      else { global.Nav.go('/story'); }
    });
    document.getElementById('mem-detail-close').addEventListener('click', function () {
      global.Nav.go('/story');
    });
  }

  global.Views['memory-new'] = { render: function (opts) { openForm(opts && opts.id ? opts.id : null); } };
  global.Views['memory-detail'] = { render: function (opts) { if (opts && opts.id) openDetail(opts.id); } };

  global.MemoryOpen = { form: openForm, detail: openDetail };

  bind();
})(window);
