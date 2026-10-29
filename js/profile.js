/* ============================================================
   和你第N天 · profile.js
   我的（PRD 10）：主题 / AI 设置 / 导出 / 示例 / 清空
   ============================================================ */
(function (global) {
  'use strict';
  var OD = global.OurDays;
  var Utils = OD.Utils;
  var State = OD.State;
  var UI = global.UI;

  global.Views = global.Views || {};

  // 与 index.html #theme-sheet 中的 .theme-opt[data-theme] 保持一一对应
  var THEME_NAMES = {
    cream: '奶油恋爱', sakura: '樱花', night: '夜晚',
    mint: '薄荷', sea: '海盐', sun: '暖阳'
  };

  // 在一起日期合理性下限：1926-01-01（当前年份 - 100，与 onboarding / datepicker 的下限一致）
  var MIN_DATE = new Date(1926, 0, 1);

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function settings() {
    var s = State.settings();
    if (!s.ai) s.ai = { base: '', model: '', key: '' };
    if (!s.theme) s.theme = 'cream';
    return s;
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'cream');
    var s = settings();
    s.theme = theme || 'cream';
    State.saveSettings(s);
    // 状态栏 / 地址栏取色跟随当前主题
    if (UI && UI.syncThemeColor) UI.syncThemeColor();
  }
  function aiReady() {
    var ai = settings().ai;
    return !!(ai && ai.base && ai.model && ai.key);
  }
  function refreshLabels() {
    var s = settings();
    document.getElementById('theme-label').textContent = THEME_NAMES[s.theme] || '奶油恋爱';
    document.getElementById('ai-status').textContent = aiReady() ? '已接入' : '未配置（内置文案）';
    var opts = document.querySelectorAll('.theme-opt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('active', opts[i].getAttribute('data-theme') === s.theme);
    }
    var cl = document.getElementById('profile-cards-label');
    if (cl) cl.textContent = cardsLabel();
    var pdLabel = document.getElementById('profile-period-label');
    if (pdLabel) {
      var pd = OD.LS.get('period', null);
      pdLabel.textContent = (pd && pd.onboarded) ? '已设置' : '未设置';
    }
    var hbLabel = document.getElementById('profile-homebg-label');
    if (hbLabel) hbLabel.textContent = OD.LS.get('homeBg', '') ? '已设置' : '未设置';
  }

  function render() {
    var couple = State.couple();
    if (!couple) { global.Nav.go('/onboarding'); return; }
    var my = couple.myName || '你';
    var ta = couple.taName || 'TA';
    document.getElementById('profile-names').innerHTML = esc(my) + '<span class="sep">♥</span>' + esc(ta);
    var d = Utils.parseDate(couple.relationshipDate);
    if (d) {
      document.getElementById('profile-since').textContent =
        '从 ' + Utils.fmtCN(d) + ' 开始 · 今天第 ' + Utils.dayNumber(d) + ' 天';
    }
    renderDateRow(couple);
    renderBirthdayLabel(couple);
    refreshLabels();
  }

  /* 双人生日（I）：设置页展示两人的生日，未设置时提示去设置；
     农历存 L:MM-DD，展示为「农历八月初十」样式 */
  function bdDisplay(v) {
    if (!v) return '';
    var isLunar = String(v).indexOf('L:') === 0;
    var s = isLunar ? String(v).slice(2) : String(v);
    if (isLunar) {
      var p = s.split('-');
      var m = +p[0], d = +p[1];
      var L = OD.Lunar;
      if (L && L.monthName && L.dayName && m >= 1 && m <= 12 && d >= 1 && d <= 30) {
        return '农历' + L.monthName(m, false) + L.dayName(d);
      }
      return s;
    }
    return s;
  }
  function renderBirthdayLabel(couple) {
    var label = document.getElementById('profile-birthday-label');
    if (!label) return;
    var my = couple && couple.myBirthday;
    var ta = couple && couple.taBirthday;
    if (!my && !ta) {
      label.textContent = '未设置';
      label.classList.add('muted');
      return;
    }
    label.classList.remove('muted');
    var parts = [];
    if (my) parts.push('我 ' + bdDisplay(my));
    if (ta) parts.push('TA ' + bdDisplay(ta));
    label.textContent = parts.join(' · ');
  }

  /* "在一起日期"行：展示当前日期（2024.02.14）；
     存量异常值（无法解析或早于 MIN_DATE，如 1912-12-11）在该行醒目标注提示修改 */
  function renderDateRow(couple) {
    var row = document.getElementById('profile-date');
    var label = document.getElementById('profile-date-label');
    if (!row || !label) return;
    var d = Utils.parseDate(couple && couple.relationshipDate);
    if (!d || isNaN(d.getTime()) || d < MIN_DATE) {
      row.classList.add('danger');
      label.textContent = '日期异常，请修改';
    } else {
      row.classList.remove('danger');
      label.textContent = Utils.fmtDot(d);
    }
  }

  /* 修改"在一起日期"：复用 datepicker 组件选日期，校验通过后写回 couple 并持久化 */
  function editRelationshipDate() {
    var couple = State.couple();
    if (!couple) return;
    var input = document.createElement('input');
    input.type = 'text';
    input.value = couple.relationshipDate || '';
    input.style.display = 'none';
    document.body.appendChild(input);
    UI.datePicker(input).then(function (val) {
      if (input.parentNode) input.parentNode.removeChild(input);
      if (!val) return; // 用户取消，不改动
      var d = Utils.parseDate(val);
      if (!d || isNaN(d.getTime())) { UI.toast('日期格式不正确，请重新选择'); return; }
      if (d > Utils.today()) { UI.toast('在一起日期不能晚于今天'); return; }
      if (d < MIN_DATE) { UI.toast('在一起日期不能早于 1926-01-01'); return; }
      couple.relationshipDate = Utils.fmtInput(d);
      State.saveCouple(couple);
      render(); // 重新渲染"我的"页；返回首页时首页会重算天数
      UI.toast('在一起日期已更新');
    });
  }

  /* 双人生日（I）：datepicker 选中后（data-date-open 委托写回 YYYY-MM-DD 并触发 change）
     把全日期转成 MM-DD 展示与存储（兼容读取时两种格式） */
  function bdToMmdd(input, label) {
    var v = String(input.value || '').trim();
    if (!v) return;
    var p = v.split('-');
    if (p.length === 3) {
      var mmdd = p[1] + '-' + p[2];
      input.value = mmdd;
    }
    if (label) label.textContent = '已选择 ' + input.value;
  }

  /* 生日弹窗：公历/农历分段切换（两人各自独立，默认公历） */
  var bdType = { my: 'solar', ta: 'solar' };
  /* 农历选中暂存：datepicker 选公历日 → 换算成农历月日，保存时读取 */
  var bdLunarSel = { my: null, ta: null };
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* 解析存储值 L:MM-DD → { m, d }；非农历/非法返回 null */
  function parseLunarStored(v) {
    var s = String(v || '');
    if (s.indexOf('L:') !== 0) return null;
    var p = s.slice(2).split('-');
    var m = +p[0], d = +p[1];
    if (!m || !d || m < 1 || m > 12 || d < 1 || d > 30) return null;
    return { m: m, d: d };
  }
  /* 农历月日 → 今年/明年第一个未过的公历日期（用于日历定位与高亮） */
  function lunarAnchorDate(md) {
    var L = OD.Lunar;
    var today = Utils.today();
    var y = today.getFullYear();
    var d1 = L && L.toSolarDate ? L.toSolarDate(y, md.m, md.d, false) : null;
    if (d1 && d1 >= today) return d1;
    var d2 = L && L.toSolarDate ? L.toSolarDate(y + 1, md.m, md.d, false) : null;
    if (d2) return d2;
    return d1 || today;
  }
  /* 农历 input change：datepicker 写回公历 YYYY-MM-DD → 换算农历月日暂存并更新提示 */
  function onLunarPicked(person, input, label) {
    var v = String(input.value || '').trim();
    if (!v) return;
    var p = v.split('-');
    if (p.length !== 3) return;
    var date = new Date(+p[0], +p[1] - 1, +p[2]);
    var r = OD.Lunar && OD.Lunar.fromDate ? OD.Lunar.fromDate(date) : null;
    if (!r) { bdLunarSel[person] = null; if (label) label.textContent = '未设置'; UI.toast('所选日期超出农历支持范围'); return; }
    bdLunarSel[person] = { m: r.m, d: r.d };
    if (label) label.textContent = '已选择 ' + (r.isLeap ? '闰' : '') + r.monthName + r.dayName;
  }
  function setBdType(person, type) {
    var solar = document.getElementById('bd-' + person + '-solar');
    var lunar = document.getElementById('bd-' + person + '-lunar');
    if (solar) solar.hidden = (type !== 'solar');
    if (lunar) lunar.hidden = (type !== 'lunar');
    var btns = document.querySelectorAll('.bd-type-btn[data-bd-person="' + person + '"]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-bd-type') === type);
    }
    bdType[person] = type;
  }

  function openBirthdaySheet() {
    var couple = State.couple();
    if (!couple) { UI.toast('请先设置在一起日期'); return; }
    var myBd = couple.myBirthday || '';
    var taBd = couple.taBirthday || '';
    var myInput = document.getElementById('bd-my');
    var taInput = document.getElementById('bd-ta');
    var myLabel = document.getElementById('bd-my-label');
    var taLabel = document.getElementById('bd-ta-label');
    myInput.value = (myBd.indexOf('L:') === 0) ? '' : myBd;
    taInput.value = (taBd.indexOf('L:') === 0) ? '' : taBd;
    if (myLabel) myLabel.textContent = myBd ? '已选择 ' + bdDisplay(myBd) : '未设置';
    if (taLabel) taLabel.textContent = taBd ? '已选择 ' + bdDisplay(taBd) : '未设置';
    ['my', 'ta'].forEach(function (p) {
      var v = (p === 'my') ? myBd : taBd;
      var type = (String(v).indexOf('L:') === 0) ? 'lunar' : 'solar';
      var md = parseLunarStored(v);
      bdLunarSel[p] = md ? { m: md.m, d: md.d } : null;
      var li = document.getElementById('bd-' + p + '-lunar-input');
      if (li) li.value = md ? Utils.fmtInput(lunarAnchorDate(md)) : '';
      setBdType(p, type);
    });
    UI.openSheet('birthday-sheet');
  }
  function saveBirthday() {
    var couple = State.couple();
    if (!couple) return;
    function readOne(person) {
      var type = bdType[person] || 'solar';
      if (type === 'lunar') {
        var sel = bdLunarSel[person];
        if (!sel || !sel.m || !sel.d) return '';
        return 'L:' + pad2(sel.m) + '-' + pad2(sel.d);
      }
      return document.getElementById('bd-' + person).value.trim();
    }
    var mb = readOne('my');
    var tb = readOne('ta');
    var bad = [];
    if (mb && !/^\d{2}-\d{2}$/.test(mb) && !/^L:\d{2}-\d{2}$/.test(mb)) bad.push('我的生日');
    if (tb && !/^\d{2}-\d{2}$/.test(tb) && !/^L:\d{2}-\d{2}$/.test(tb)) bad.push('TA的生日');
    if (bad.length) { UI.toast(bad.join('、') + '格式应为 月-日（公历）或 L:月-日（农历），如 02-14 或 L:08-10'); return; }
    couple.myBirthday = mb || '';
    couple.taBirthday = tb || '';
    State.saveCouple(couple);
    State.syncMyBirthdayAnniv(couple);
    UI.closeSheet('birthday-sheet');
    UI.toast('双人生日已保存');
    render();
  }

  /* 首页卡片配置（数据源：home.js 导出的 global.HomeCards；未加载时兜底定义） */
  function cardDefs() {
    return (global.HomeCards && global.HomeCards.defs) ? global.HomeCards.defs : [
      { key: 'hero', label: '在一起天数' },
      { key: 'quote', label: '每日一句' },
      { key: 'birthday', label: 'TA 的生日' },
      { key: 'countdown', label: '纪念日倒计时' },
      { key: 'next', label: '下一个特别日子' },
      { key: 'quick', label: '快捷入口' },
      { key: 'recent', label: '最近回忆' }
    ];
  }
  function cardsLabel() {
    if (!global.HomeCards) return '';
    var cfg = global.HomeCards.get();
    var defs = cardDefs();
    var on = 0;
    for (var i = 0; i < defs.length; i++) {
      if (cfg[defs[i].key] !== false) on++;
    }
    return on + '/' + defs.length + ' 张';
  }
  function openCardsSheet() {
    if (!global.HomeCards) { UI.toast('首页卡片配置暂不可用'); return; }
    var cfg = global.HomeCards.get();
    var defs = cardDefs();
    var html = '';
    for (var i = 0; i < defs.length; i++) {
      var key = defs[i].key;
      var on = cfg[key] !== false;
      html += '<div class="cards-row">' +
        '<span class="cards-name">' + esc(defs[i].label) + '</span>' +
        '<button type="button" class="switch' + (on ? ' on' : '') + '" data-card-key="' + key + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '"><span class="switch-knob"></span></button>' +
        '</div>';
    }
    var wrap = document.getElementById('cards-list');
    if (wrap) wrap.innerHTML = html;
    UI.openSheet('cards-sheet');
  }
  function toggleCard(key, on) {
    if (!global.HomeCards) return;
    var cfg = global.HomeCards.get();
    cfg[key] = on;
    global.HomeCards.save(cfg);
    var label = document.getElementById('profile-cards-label');
    if (label) label.textContent = cardsLabel();
  }

  function exportData() {
    OD.PhotoStore.all().then(function (photos) {
      var payload = {
        version: 3,
        exportedAt: new Date().toISOString(),
        app: 'ourdays',
        keys: OD.LS.dumpAll(), // 全部 od.* 本地数据（键名不带 od. 前缀）
        photos: photos || []   // 回忆照片（IndexedDB / 兜底存储），恢复时按 id 写回
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ourdays-backup-' + Utils.fmtInput(Utils.today()) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 800);
      UI.toast('已导出备份文件');
    }).catch(function () {
      UI.toast('导出失败，请重试');
    });
  }

  /* ---------- 数据导入恢复（我的-设置：导入数据） ---------- */
  function importData() {
    document.getElementById('profile-import-file').click();
  }

  function onImportFilePicked() {
    var input = document.getElementById('profile-import-file');
    var file = input && input.files && input.files[0];
    input.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { handleImportText(String(reader.result || '')); };
    reader.onerror = function () { UI.toast('读取文件失败，请重试'); };
    reader.readAsText(file);
  }

  /* 解析备份 JSON：支持 v3（{app,version,keys:{键名:值},photos:[{id,dataUrl}]}）、
     v2（{app,version,keys:{键名:值}}）与 v1（顶层 couple/settings/... 字段） */
  function parseBackup(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var keysMap = {};
    var photos = [];
    if (obj.app === 'ourdays' && obj.keys && typeof obj.keys === 'object') {
      var ks = obj.keys;
      for (var k in ks) {
        if (Object.prototype.hasOwnProperty.call(ks, k) &&
            /^[a-zA-Z0-9._-]+$/.test(k) && k.indexOf('__') !== 0) {
          keysMap[k] = ks[k];
        }
      }
      if (Array.isArray(obj.photos)) {
        photos = obj.photos.filter(function (p) {
          return p && typeof p === 'object' && p.id && p.dataUrl;
        });
      }
    } else {
      ['couple', 'settings', 'memories', 'customAnniv', 'annivOrder', 'shareTemplate'].forEach(function (k) {
        if (obj[k] !== undefined) keysMap[k] = obj[k];
      });
    }
    return (Object.keys(keysMap).length || photos.length) ? { keysMap: keysMap, photos: photos } : null;
  }

  function applyImport(parsed) {
    var keysMap = parsed.keysMap;
    var photos = parsed.photos || [];
    var n = 0;
    for (var k in keysMap) {
      if (!Object.prototype.hasOwnProperty.call(keysMap, k)) continue;
      OD.LS.set(k, keysMap[k]);
      n++;
    }
    /* 照片恢复：PhotoStore.put 内部自行处理 IndexedDB / LocalStorage 兜底 */
    Promise.all(photos.map(function (p) { return OD.PhotoStore.put(p.id, p.dataUrl); }))
      .then(function () {
        UI.toast('已导入 ' + n + ' 项数据' + (photos.length ? '，含 ' + photos.length + ' 张照片' : '') + '，正在刷新…');
        setTimeout(function () {
          try { location.reload(); } catch (e) { global.Nav.go('/home'); }
        }, 700);
      })
      .catch(function () {
        UI.toast('已导入 ' + n + ' 项数据，但照片恢复失败');
        setTimeout(function () {
          try { location.reload(); } catch (e) { global.Nav.go('/home'); }
        }, 700);
      });
  }

  function handleImportText(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { UI.toast('文件不是有效的 JSON 备份'); return; }
    var parsed = parseBackup(obj);
    if (!parsed) { UI.toast('未识别到可导入的数据'); return; }
    UI.confirm({
      title: '导入数据',
      text: '导入将覆盖当前设备上的全部数据（回忆、纪念日、生理期、设置等），且不可恢复，是否继续？',
      okText: '覆盖导入',
      cancelText: '取消'
    }).then(function (ok) { if (ok) applyImport(parsed); });
  }

  function pushSample() {
    var couple = State.couple();
    var start = Utils.parseDate(couple ? couple.relationshipDate : null) || Utils.today();
    var today = Utils.today();
    function at(n) {
      var d = new Date(start);
      d.setDate(d.getDate() + (n - 1));
      return Utils.fmtInput(d > today ? today : d);
    }
    var seeds = [
      { date: at(1), title: '在一起的第一天', content: '说了好多好多话，从傍晚一直聊到深夜。原来遇到对的人，第一天就像认识了很久。', mood: 'happy' },
      { date: at(7), title: '一周啦', content: '一起看了场电影，散场后沿着河边走回家。路灯把影子拉得很长，也很近。', mood: 'bliss' },
      { date: at(30), title: '满月快乐', content: '认识你满一个月。谢谢你愿意把生活里的小事讲给我听。', mood: 'touched' }
    ];
    var list = State.memories();
    seeds.forEach(function (s) {
      list.push({ id: Utils.uid('mem'), title: s.title, content: s.content, date: s.date, mood: s.mood, photos: [], createdAt: Utils.fmtInput(Utils.today()) });
    });
    State.saveMemories(list);
    UI.toast('已载入 3 条示例回忆');
    global.Nav.go('/story');
  }
  function loadSample() {
    if (State.memories().length) {
      UI.confirm({
        title: '要载入示例回忆吗？',
        text: '载入会在现有回忆基础上追加 3 条示例，方便你体验完整功能。',
        okText: '载入示例',
        danger: false
      }).then(function (ok) { if (ok) pushSample(); });
      return;
    }
    pushSample();
  }
  function clearAll() {
    UI.confirm({
      title: '真的要清空吗？',
      text: '将删除这台设备上的回忆、纪念日、生理期等全部数据，且无法恢复。',
      okText: '清空全部',
      cancelText: '取消'
    }).then(function (ok) {
      if (!ok) return;
      State.clearAll().then(function () {
        // 数据已清空，主题设置一并还原为默认，避免界面残留旧主题
        document.documentElement.setAttribute('data-theme', 'cream');
        UI.toast('已清空，重新开始吧');
        global.Nav.go('/onboarding');
      });
    });
  }

  /* 生成今日分享卡（唯一分享入口）：复用首页的今日数据，分享页返回"我的" */
  function openDayShare() {
    if (!global.DayShareData) { UI.toast('今日分享卡暂不可用'); return; }
    var data = global.DayShareData();
    if (!data) { UI.toast('请先设置在一起日期'); return; }
    global.ShareOpen('day', data, '/profile');
  }

  function openAiSheet() {
    var ai = settings().ai;
    document.getElementById('ai-base').value = ai.base || '';
    document.getElementById('ai-model').value = ai.model || '';
    document.getElementById('ai-key').value = ai.key || '';
    UI.openSheet('ai-sheet');
  }
  function saveAi() {
    var s = settings();
    s.ai = {
      base: document.getElementById('ai-base').value.trim(),
      model: document.getElementById('ai-model').value.trim(),
      key: document.getElementById('ai-key').value.trim()
    };
    State.saveSettings(s);
    UI.closeSheet('ai-sheet');
    UI.toast(aiReady() ? 'AI 设置已保存' : '已保存（未填完整，将使用内置文案）');
    refreshLabels();
  }
  function openThemeSheet() {
    refreshLabels();
    UI.openSheet('theme-sheet');
  }

  /* ---------- 首页 hero 自定义背景图（设置入口：我的-设置） ---------- */
  var HOME_BG_MAX = 1280;

  function loadImageFile(file, cb) {
    var reader = new FileReader();
    reader.onload = function () { cb(reader.result); };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }

  function downscaleToDataUrl(dataUrl, maxSize, cb) {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      var w = Math.round(img.width * scale);
      var h = Math.round(img.height * scale);
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = function () { cb(null); };
    img.src = dataUrl;
  }

  function updateHomeBgLabel() {
    var label = document.getElementById('profile-homebg-label');
    if (label) label.textContent = OD.LS.get('homeBg', '') ? '已设置' : '未设置';
  }

  function refreshHomeBgPreview() {
    var img = document.getElementById('homebg-preview-img');
    var empty = document.getElementById('homebg-preview-empty');
    var clear = document.getElementById('homebg-clear');
    var bg = OD.LS.get('homeBg', '');
    if (bg) {
      img.src = bg;
      img.hidden = false;
      empty.hidden = true;
      clear.hidden = false;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
      empty.hidden = false;
      clear.hidden = true;
    }
  }

  function applyHomeBgNow() {
    if (global.Views.home && typeof global.Views.home.applyBg === 'function') {
      global.Views.home.applyBg();
    }
  }

  function openHomeBgSheet() {
    refreshLabels();
    refreshHomeBgPreview();
    showSelectState();
    UI.openSheet('homebg-sheet');
  }

  /* ---------- 3:4 拖拽裁剪器（上传后裁剪，纯前端） ---------- */
  var crop = {
    img: null,
    baseScale: 1,
    scale: 1,
    left: 0,
    top: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartLeft: 0,
    dragStartTop: 0
  };

  function showSelectState() {
    document.getElementById('homebg-crop').hidden = true;
    document.getElementById('homebg-select').hidden = false;
  }

  function showCropState() {
    document.getElementById('homebg-select').hidden = true;
    document.getElementById('homebg-crop').hidden = false;
  }

  function openCrop(dataUrl) {
    var img = new Image();
    img.onload = function () {
      crop.img = img;
      showCropState();
      initCrop();
    };
    img.onerror = function () { alert('图片读取失败，请重试'); };
    img.src = dataUrl;
  }

  function initCrop() {
    var stage = document.getElementById('crop-stage');
    var img = document.getElementById('crop-img');
    var r = stage.getBoundingClientRect();
    var iw = crop.img.naturalWidth, ih = crop.img.naturalHeight;
    var base = Math.min(r.width / iw, r.height / ih);
    crop.baseScale = base;
    crop.scale = base;
    img.src = crop.img.src;
    img.style.width = Math.round(iw * base) + 'px';
    img.style.height = Math.round(ih * base) + 'px';
    document.getElementById('crop-zoom').value = 1;
    centerCropImg();
  }

  function applyCropPos() {
    var img = document.getElementById('crop-img');
    img.style.transform = 'translate(' + crop.left + 'px,' + crop.top + 'px)';
  }

  function centerCropImg() {
    var stage = document.getElementById('crop-stage');
    var r = stage.getBoundingClientRect();
    var iw = crop.img.naturalWidth * crop.scale;
    var ih = crop.img.naturalHeight * crop.scale;
    crop.left = Math.round((r.width - iw) / 2);
    crop.top = Math.round((r.height - ih) / 2);
    applyCropPos();
  }

  /* 边界约束：图片必须始终覆盖整个裁剪窗口，边缘不得露出留白 */
  function clampCropPos() {
    var stage = document.getElementById('crop-stage');
    var r = stage.getBoundingClientRect();
    var iw = crop.img.naturalWidth * crop.scale;
    var ih = crop.img.naturalHeight * crop.scale;
    if (iw >= r.width) {
      crop.left = Math.max(r.width - iw, Math.min(0, crop.left));
    } else {
      crop.left = Math.round((r.width - iw) / 2);
    }
    if (ih >= r.height) {
      crop.top = Math.max(r.height - ih, Math.min(0, crop.top));
    } else {
      crop.top = Math.round((r.height - ih) / 2);
    }
    applyCropPos();
  }

  /* 缩放：滑块 1~3 倍，缩放时保持窗口中心稳定 */
  function setCropScale(s) {
    var stage = document.getElementById('crop-stage');
    var r = stage.getBoundingClientRect();
    var cx = r.width / 2, cy = r.height / 2;
    var prevLeft = crop.left, prevTop = crop.top, prevScale = crop.scale;
    var pImgX = (cx - prevLeft) / prevScale;
    var pImgY = (cy - prevTop) / prevScale;
    crop.scale = s;
    crop.left = Math.round(cx - pImgX * crop.scale);
    crop.top = Math.round(cy - pImgY * crop.scale);
    clampCropPos();
    var img = document.getElementById('crop-img');
    img.style.width = Math.round(crop.img.naturalWidth * crop.scale) + 'px';
    img.style.height = Math.round(crop.img.naturalHeight * crop.scale) + 'px';
    applyCropPos();
  }

  /* 确认裁剪：按窗口矩形相对图片位置输出 2x 像素图并保存 */
  function confirmCrop() {
    var stage = document.getElementById('crop-stage');
    var r = stage.getBoundingClientRect();
    var sx = -crop.left / crop.scale;
    var sy = -crop.top / crop.scale;
    var sw = r.width / crop.scale;
    var sh = r.height / crop.scale;
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(r.width * 2);
    canvas.height = Math.round(r.height * 2);
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(crop.img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    var out = canvas.toDataURL('image/jpeg', 0.85);
    OD.LS.set('homeBg', out);
    updateHomeBgLabel();
    refreshHomeBgPreview();
    applyHomeBgNow();
    showSelectState();
    UI.toast('首页背景图已更新');
  }

  /* 拖拽平移（Pointer Events，兼容触屏） */
  function bindCropEvents() {
    var img = document.getElementById('crop-img');
    img.addEventListener('pointerdown', function (e) {
      crop.dragging = true;
      crop.dragStartX = e.clientX;
      crop.dragStartY = e.clientY;
      crop.dragStartLeft = crop.left;
      crop.dragStartTop = crop.top;
      try { img.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    img.addEventListener('pointermove', function (e) {
      if (!crop.dragging) return;
      crop.left = crop.dragStartLeft + (e.clientX - crop.dragStartX);
      crop.top = crop.dragStartTop + (e.clientY - crop.dragStartY);
      clampCropPos();
    });
    img.addEventListener('pointerup', function () { crop.dragging = false; });
    img.addEventListener('pointercancel', function () { crop.dragging = false; });
  }

  /* 图片文件统一处理链路：读取 → 进裁剪态（点击选择与拖拽共用） */
  function handleHomeBgFile(file) {
    if (!file) return;
    loadImageFile(file, function (dataUrl) {
      if (!dataUrl) { alert('图片读取失败，请重试'); return; }
      openCrop(dataUrl);
    });
  }

  function onHomeBgPicked() {
    var input = document.getElementById('homebg-file');
    var file = input && input.files && input.files[0];
    if (!file) return;
    handleHomeBgFile(file);
    input.value = '';
  }

  /* 选择态拖拽文件上传（dragenter/dragover/dragleave/drop） */
  function bindDropUpload() {
    var zone = document.getElementById('homebg-select');
    if (!zone) return;
    var dragDepth = 0;
    zone.addEventListener('dragenter', function (e) {
      e.preventDefault();
      dragDepth += 1;
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
    });
    zone.addEventListener('dragleave', function (e) {
      e.preventDefault();
      dragDepth -= 1;
      if (dragDepth <= 0) {
        dragDepth = 0;
        zone.classList.remove('drag-over');
      }
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      dragDepth = 0;
      zone.classList.remove('drag-over');
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        UI.toast('仅支持图片文件');
        return;
      }
      handleHomeBgFile(file);
    });
  }

  function clearHomeBg() {
    OD.LS.remove('homeBg');
    updateHomeBgLabel();
    refreshHomeBgPreview();
    applyHomeBgNow();
  }

  function bind() {
    document.getElementById('profile-edit').addEventListener('click', function () {
      if (global.Views.onboarding && global.Views.onboarding.setEditMode) {
        global.Views.onboarding.setEditMode(true);
      }
      global.Nav.go('/onboarding');
    });
    document.getElementById('profile-share').addEventListener('click', openDayShare);
    document.getElementById('profile-date').addEventListener('click', editRelationshipDate);
    var cardsEntry = document.getElementById('profile-cards');
    if (cardsEntry) cardsEntry.addEventListener('click', openCardsSheet);
    document.getElementById('profile-theme').addEventListener('click', openThemeSheet);
    document.getElementById('profile-ai').addEventListener('click', openAiSheet);
    document.getElementById('profile-homebg').addEventListener('click', openHomeBgSheet);
    document.getElementById('homebg-pick').addEventListener('click', function () {
      document.getElementById('homebg-file').click();
    });
    document.getElementById('homebg-file').addEventListener('change', onHomeBgPicked);
    document.getElementById('homebg-clear').addEventListener('click', clearHomeBg);
    /* 3:4 裁剪器事件 */
    document.getElementById('crop-cancel').addEventListener('click', showSelectState);
    document.getElementById('crop-ok').addEventListener('click', confirmCrop);
    var cropSlider = document.getElementById('crop-zoom');
    cropSlider.addEventListener('input', function () {
      setCropScale(crop.baseScale * parseFloat(cropSlider.value));
    });
    document.getElementById('crop-zoom-out').addEventListener('click', function () {
      cropSlider.value = Math.max(1, parseFloat(cropSlider.value) - 0.1);
      setCropScale(crop.baseScale * parseFloat(cropSlider.value));
    });
    document.getElementById('crop-zoom-in').addEventListener('click', function () {
      cropSlider.value = Math.min(3, parseFloat(cropSlider.value) + 0.1);
      setCropScale(crop.baseScale * parseFloat(cropSlider.value));
    });
    bindCropEvents();
    bindDropUpload();
    var periodEntry = document.getElementById('profile-period');
    if (periodEntry) periodEntry.addEventListener('click', function () {
      if (global.Views.period && global.Views.period.openSetup) {
        global.Views.period.openSetup();
      } else {
        global.Nav.go('/period');
      }
    });
    document.getElementById('profile-export').addEventListener('click', exportData);
    document.getElementById('profile-import').addEventListener('click', importData);
    document.getElementById('profile-import-file').addEventListener('change', onImportFilePicked);
    document.getElementById('profile-sample').addEventListener('click', loadSample);
    document.getElementById('profile-reset').addEventListener('click', clearAll);
    document.getElementById('ai-save').addEventListener('click', saveAi);

    /* 双人生日（I） */
    var bdEntry = document.getElementById('profile-birthday');
    if (bdEntry) bdEntry.addEventListener('click', openBirthdaySheet);
    var bdMy = document.getElementById('bd-my');
    var bdTa = document.getElementById('bd-ta');
    if (bdMy) bdMy.addEventListener('change', function () { bdToMmdd(bdMy, document.getElementById('bd-my-label')); });
    if (bdTa) bdTa.addEventListener('change', function () { bdToMmdd(bdTa, document.getElementById('bd-ta-label')); });
    var bdMyLunar = document.getElementById('bd-my-lunar-input');
    var bdTaLunar = document.getElementById('bd-ta-lunar-input');
    if (bdMyLunar) bdMyLunar.addEventListener('change', function () { onLunarPicked('my', bdMyLunar, document.getElementById('bd-my-label')); });
    if (bdTaLunar) bdTaLunar.addEventListener('change', function () { onLunarPicked('ta', bdTaLunar, document.getElementById('bd-ta-label')); });
    var bdSave = document.getElementById('birthday-save');
    if (bdSave) bdSave.addEventListener('click', saveBirthday);
    /* 生日弹窗公历/农历分段切换 */
    var bdSheet = document.getElementById('birthday-sheet');
    if (bdSheet) {
      bdSheet.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.bd-type-btn') : null;
        if (!btn) return;
        setBdType(btn.getAttribute('data-bd-person'), btn.getAttribute('data-bd-type'));
      });
    }

    document.getElementById('theme-sheet').addEventListener('click', function (e) {
      var opt = e.target.closest ? e.target.closest('.theme-opt') : null;
      if (!opt) return;
      var theme = opt.getAttribute('data-theme');
      if (!theme) return;
      applyTheme(theme);
      UI.closeAllSheets();
      UI.toast('主题已切换');
      refreshLabels();
    });

    /* 首页卡片配置：开关点击即切换并持久化 */
    var cardsSheet = document.getElementById('cards-sheet');
    if (cardsSheet) {
      cardsSheet.addEventListener('click', function (e) {
        var sw = e.target.closest ? e.target.closest('.switch') : null;
        if (!sw) return;
        var key = sw.getAttribute('data-card-key');
        if (!key) return;
        var on = sw.classList.contains('on');
        toggleCard(key, !on);
        sw.classList.toggle('on', !on);
        sw.setAttribute('aria-checked', !on ? 'true' : 'false');
      });
    }
  }

  global.Views.profile = { render: render, applyTheme: applyTheme, refreshLabels: refreshLabels };
  bind();
})(window);
