/* ============================================================
   和你第N天 · anniversary.js
   纪念日（PRD 9）：自定义 / 自动纪念日 · 倒计时 · 拖拽排序
   ------------------------------------------------------------
   列表顺序规则（本次改造）：
     1. 自定义纪念日整体排在自动纪念日之前（DOM 用分组标题体现该顺序）；
     2. 组内顺序由拖拽决定，持久化在 localStorage 的 od.annivOrder（字符串 key 数组）；
     3. 新条目（未出现在顺序记录里）按默认次序追加到本组末尾，
        因此新增纪念日不会打乱已拖拽好的老顺序。
   拖拽：零依赖 Pointer 兼容实现（鼠标 + 触摸），整卡按住拖动排序
   （轻点查看详情、点按钮不触发；未超过位移阈值不拦截页面滚动）。
   ============================================================ */
(function (global) {
  'use strict';
  var OD = global.OurDays;
  var Utils = OD.Utils;
  var State = OD.State;
  var LS = OD.LS;
  var UI = global.UI;

  global.Views = global.Views || {};

  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var LABELS = {
    7: '一周', 30: '满月', 50: '五十天', 100: '百天', 365: '一周年', 520: '我爱你',
    666: '666天', 999: '长长久久', 1000: '千天', 1314: '一生一世', 2000: '两千天', 3650: '十周年'
  };

  /* 顺序持久化 */
  var ORDER_KEY = 'annivOrder';     // → localStorage: od.annivOrder
  var G_CUSTOM = 'c';               // key 前缀：自定义
  var G_AUTO = 'a';                 // key 前缀：自动

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function weekdayOf(d) { return d ? WEEK[d.getDay()] : ''; }
  function dateCNOf(dateStr) {
    var d = Utils.parseDate(dateStr);
    return d ? (Utils.fmtCN(d) + ' · ' + weekdayOf(d)) : String(dateStr || '');
  }
  /* 日期行 HTML（hero 主卡片 / 列表项）：日期+星期几包进 .ai-date-main 整体不换行，
     窄屏（含 320px）空间不足时在"·"前整体换行，避免"2026年7月6日 · 周一"断成两行或
     "周五/周一"被拆字截断；自定义备注由调用方以 .ai-note 追加，可单独省略号截断 */
  function dateCNHtml(dateStr) {
    var d = Utils.parseDate(dateStr);
    if (!d) return esc(dateStr || '');
    return '<span class="ai-date-main">' + esc(Utils.fmtCN(d)) + '<span class="ai-dow"> · ' + weekdayOf(d) + '</span></span>';
  }
  function countText(diff) {
    if (diff > 0) return '还有 ' + diff + ' 天';
    if (diff === 0) return '就是今天 ❤️';
    return '已过 ' + (-diff) + ' 天';
  }
  function autoTitle(n) {
    return (LABELS[n] || (n + '天')) + '纪念日';
  }

  function collectAuto() {
    var couple = State.couple();
    if (!couple) return [];
    var start = Utils.parseDate(couple.relationshipDate);
    if (!start) return [];
    return OD.AUTO_ANNIV.map(function (a) {
      var date = Utils.nthDayDate(start, a.n);
      return { n: a.n, date: date, diff: Utils.diffDaysFromToday(date) };
    });
  }
  function customList() {
    return State.customAnniv().slice().sort(function (a, b) {
      if (a.date === b.date) return a.createdAt < b.createdAt ? -1 : 1;
      return a.date < b.date ? -1 : 1;
    });
  }
  /* 距离今天最近的未来日子（含今天） */
  function heroCandidate(autos, customs) {
    var best = null;
    autos.forEach(function (a) {
      if (a.diff < 0) return;
      if (!best || a.diff < best.diff) best = { kind: 'auto', n: a.n, date: a.date, diff: a.diff, note: '' };
    });
    customs.forEach(function (c) {
      var diff = Utils.diffDaysFromToday(Utils.parseDate(c.date));
      if (diff < 0) return;
      if (!best || diff < best.diff) best = { kind: 'custom', title: c.title, dateStr: c.date, diff: diff, note: c.note || '' };
    });
    return best;
  }

  /* ---------- 顺序持久化 ---------- */
  function readOrder() {
    var v = LS.get(ORDER_KEY, []);
    return Object.prototype.toString.call(v) === '[object Array]'
      ? v.filter(function (k) { return typeof k === 'string' && k; })
      : [];
  }
  function writeOrder(keys) { LS.set(ORDER_KEY, keys || []); }

  /* 合并为最终展示列表：自定义（前） + 自动（后），组内按持久化顺序，
     未记录的条目保持默认次序并追加到本组已排序条目之后。 */
  function buildList() {
    var rank = {};
    readOrder().forEach(function (k, i) { if (rank[k] === undefined) rank[k] = i; });

    function stableSort(items) {
      return items.map(function (it, i) { return { it: it, idx: i }; }).sort(function (a, b) {
        var ra = rank[a.it.key], rb = rank[b.it.key];
        if (ra === undefined && rb === undefined) return a.idx - b.idx;
        if (ra === undefined) return 1;
        if (rb === undefined) return -1;
        return ra - rb;
      }).map(function (x) { return x.it; });
    }

    var customItems = stableSort(customList().map(function (c) {
      return {
        kind: 'custom', key: G_CUSTOM + ':' + c.id, id: c.id,
        title: c.title, dateStr: c.date, note: c.note || '',
        coverId: c.coverId || '', remind: Number(c.remind) || 0
      };
    }));
    var autoItems = stableSort(collectAuto().map(function (a) {
      return {
        kind: 'auto', key: G_AUTO + ':' + a.n, n: a.n,
        dateStr: Utils.fmtInput(a.date), diff: a.diff
      };
    }));
    return { customs: customItems, autos: autoItems, all: customItems.concat(autoItems) };
  }

  /* ---------- 渲染 ---------- */
  function renderHero() {
    var hero = document.getElementById('anniv-hero');
    var cand = heroCandidate(collectAuto(), customList());
    if (!cand) {
      hero.innerHTML =
        '<div class="nah-label">💕 下一个特别日子</div>' +
        '<div class="nah-title">把平凡的日子过成纪念日</div>' +
        '<div class="nah-date">最近的重要日子都已度过</div>' +
        '<div class="nah-days">今天，也是值得珍惜的一天</div>';
      return;
    }
    var title = cand.kind === 'auto' ? autoTitle(cand.n) : cand.title;
    var dateStr = cand.kind === 'auto' ? Utils.fmtInput(cand.date) : cand.dateStr;
    hero.innerHTML =
      '<div class="nah-label">💕 下一个特别日子</div>' +
      '<div class="nah-title">' + esc(title) + '</div>' +
      '<div class="nah-date">' + dateCNHtml(dateStr) + '</div>' +
      '<div class="nah-days">' + countText(cand.diff) + '</div>';
  }

  function customRowHtml(it) {
    var diff = Utils.diffDaysFromToday(Utils.parseDate(it.dateStr));
    /* 封面功能已移除：一律使用默认图标（已存储的 coverId 读取时忽略，不迁移）。 */
    var coverHtml = '<span class="ai-icon">💝</span>';
    var remindHtml = it.remind > 0
      ? '<span class="anniv-flag">🔔 提前' + it.remind + '天</span>'
      : '';
    return '<div class="anniv-item" data-custom="' + esc(it.id) + '" data-key="' + esc(it.key) + '">' +
      coverHtml +
      '<div class="ai-main">' +
        '<div class="ai-title">' + esc(it.title) + remindHtml + '</div>' +
        '<div class="ai-date">' + dateCNHtml(it.dateStr) + (it.note ? '<span class="ai-note"> · ' + esc(it.note) + '</span>' : '') + '</div>' +
      '</div>' +
      '<div class="ai-count">' + countText(diff) + '</div>' +
      '<button class="ai-edit" data-custom-edit="' + esc(it.id) + '" aria-label="编辑">✏️</button>' +
      '<button class="ai-del" data-custom-del="' + esc(it.id) + '" aria-label="移除">🗑</button>' +
    '</div>';
  }

  function autoRowHtml(it) {
    var passed = it.diff < 0;
    var isKey = OD.AUTO_HIGHLIGHT.indexOf(it.n) > -1;
    return '<div class="anniv-item' + (passed ? ' passed' : '') + '" data-auto="' + it.n + '" data-key="' + esc(it.key) + '">' +
      '<span class="ai-icon">💕</span>' +
      '<div class="ai-main">' +
        '<div class="ai-title">' + autoTitle(it.n) + (isKey ? '<span class="anniv-flag">重点</span>' : '') + '</div>' +
        '<div class="ai-date">' + dateCNHtml(it.dateStr) + '</div>' +
      '</div>' +
      '<div class="ai-count">' + countText(it.diff) + '</div>' +
    '</div>';
  }

  function renderList() {
    var box = document.getElementById('anniv-list');
    if (!box) return;
    var data = buildList();
    var html = '<div class="anniv-group-title">自定义纪念日</div>';
    if (!data.customs.length) {
      /* 空状态（K）：引导卡片，鼓励添加第一个自定义纪念日 */
      html += '<div class="anniv-empty">' +
        '<div class="anniv-empty-ico">💝</div>' +
        '<div class="anniv-empty-title">还没有专属纪念日</div>' +
        '<div class="anniv-empty-desc">把你们的重要日子记下来，倒计时与提醒都会在这里出现。</div>' +
        '<button class="btn btn-primary" data-anniv-empty-add>添加第一个纪念日</button>' +
      '</div>';
    } else {
      html += data.customs.map(customRowHtml).join('');
    }
    html += '<div class="anniv-group-title">自动纪念日</div>' + data.autos.map(autoRowHtml).join('');
    box.innerHTML = html;
  }

  function render() {
    var couple = State.couple();
    if (!couple) { global.Nav.go('/onboarding'); return; }
    renderHero();
    renderList();
  }

  /* ---------- 拖拽排序（鼠标 + 触摸，长按触发） ----------
     · 按下后长按约 450ms（期间位移不超过 10px）才进入拖拽模式，
       长按激活瞬间给卡片轻微缩放/阴影提示可拖；未长按即松手/移动视为轻点或滚动；
     · 按下位置是删除按钮等可交互元素时，不启动拖拽（点击交给按钮处理）；
     · 只允许同组互换位置（自定义 / 自动各自一组，跨组落点回退为本组末尾）；
     · 松手即把当前 DOM 顺序写回 od.annivOrder，并重渲染保证与存储一致。 */
  var drag = null;
  var suppressClickUntil = 0;
  var LONG_PRESS_MS = 450;     // 长按触发阈值（落在 400-500ms 区间）
  var LONG_PRESS_MOVE = 10;    // 长按期间位移超过该值则取消长按（视为轻点/滚动）

  function listBox() { return document.getElementById('anniv-list'); }

  function keyRows() {
    var box = listBox();
    if (!box) return [];
    return Array.prototype.slice.call(box.querySelectorAll('.anniv-item[data-key]'));
  }

  function groupOf(row) {
    var k = row.getAttribute('data-key') || '';
    return k.charAt(0);
  }

  function clearMark() {
    var rows = keyRows();
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove('dragging');
  }

  function dragBegin(cx, cy, target) {
    if (!target || !target.closest) return false;
    // 在按钮/链接上按下：不启动拖拽，保留原生点击
    var interactive = target.closest('.ai-del, button, a, [data-nav]');
    if (interactive) return false;
    var row = target.closest('.anniv-item[data-key]');
    if (!row) return false;
    if (drag) { clearTimeout(drag.timer); drag = null; }
    drag = { row: row, group: groupOf(row), active: false, ready: false, timer: null, sx: cx, sy: cy };
    /* 长按定时器：到点进入拖拽模式并给出视觉反馈（未长按即松手/移动则取消） */
    drag.timer = setTimeout(function () {
      if (!drag || drag.active) return;
      drag.ready = true;
      drag.active = true;
      drag.row.classList.add('dragging');
      drag.row.setAttribute('aria-grabbed', 'true');
    }, LONG_PRESS_MS);
    return true;
  }

  function dragMove(cx, cy) {
    if (!drag) return;
    if (!drag.ready) {
      // 长按未完成：位移超过阈值即取消长按（不拦截轻点与页面滚动）
      if (Math.abs(cy - drag.sy) >= LONG_PRESS_MOVE || Math.abs(cx - drag.sx) >= LONG_PRESS_MOVE) {
        clearTimeout(drag.timer);
        drag = null;
      }
      return;
    }
    var rows = keyRows();
    var target = null;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r === drag.row || groupOf(r) !== drag.group) continue;
      var rect = r.getBoundingClientRect();
      if (cy < rect.top + rect.height / 2) { target = r; break; }
    }
    var box = listBox();
    if (!box) return;
    if (target) {
      if (target.previousElementSibling !== drag.row) box.insertBefore(drag.row, target);
    } else {
      // 落到本组末尾：插到本组之后的第一个异组节点之前
      var boundary = null, seenSame = false;
      for (var j = 0; j < rows.length; j++) {
        var rj = rows[j];
        if (rj === drag.row) continue;
        if (groupOf(rj) === drag.group) { seenSame = true; continue; }
        if (seenSame) { boundary = rj; break; }
      }
      if (boundary) {
        if (drag.row.nextElementSibling !== boundary) box.insertBefore(drag.row, boundary);
      } else if (box.lastElementChild !== drag.row) {
        box.appendChild(drag.row);
      }
    }
  }

  function dragEnd() {
    if (!drag) return;
    var d = drag;
    drag = null;
    d.row.classList.remove('dragging');
    d.row.removeAttribute('aria-grabbed');
    if (!d.active) return;                    // 轻点：不改顺序，交给 click 处理
    clearMark();
    var keys = keyRows().map(function (r) { return r.getAttribute('data-key'); });
    writeOrder(keys);
    suppressClickUntil = Date.now() + 400;    // 抑制拖拽尾部产生的 click
    renderList();
  }

  function bindDrag() {
    var box = listBox();
    if (!box) return;

    // 起点：整卡（事件委托，列表 innerHTML 重建后依然有效）。
    // 触摸时不在 touchstart 拦截：未激活拖拽前允许页面正常滚动，
    // 纵向位移超过阈值激活后，由 touchmove 的 preventDefault 停止滚动。
    box.addEventListener('mousedown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (dragBegin(e.clientX, e.clientY, e.target)) e.preventDefault(); // 阻止选中文本
    });
    box.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      var t = e.touches[0];
      dragBegin(t.clientX, t.clientY, e.target);
    }, { passive: true });

    // 过程 / 结束：挂到 document，手指移出列表也能继续拖
    document.addEventListener('mousemove', function (e) {
      if (drag) dragMove(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', function () {
      if (drag) dragEnd();
    });
    document.addEventListener('touchmove', function (e) {
      if (!drag) return;
      var t = e.touches[0];
      if (!t) return;
      dragMove(t.clientX, t.clientY);
      if (drag && drag.active && e.cancelable) e.preventDefault(); // 激活后不滚页面
    }, { passive: false });
    document.addEventListener('touchend', function () {
      if (drag) dragEnd();
    });
    document.addEventListener('touchcancel', function () {
      if (drag) dragEnd();
    });
  }

  /* ---------- 增删（含编辑 / 封面图 / 提前提醒） ----------
     存储约定：
       · 自定义条目新增字段：coverId（IndexedDB 封面图引用）、remind（0/1/3/7 提前提醒天数）
       · 封面图片本身存入 PhotoStore（与回忆照片同一套 IndexedDB + LS 兜底），条目只存 id，
         导出 JSON 时与回忆一致仅含引用，不把大图塞进 localStorage。 */
  var editingId = null;       // 正在编辑的自定义纪念日 id（null = 新增）

  function openAdd(id) {
    editingId = id || null;
    var title = document.getElementById('anniv-sheet-title');
    var nameEl = document.getElementById('anniv-name');
    var dateEl = document.getElementById('anniv-date');
    var noteEl = document.getElementById('anniv-note');
    nameEl.value = '';
    dateEl.value = '';
    noteEl.value = '';
    setRemindActive(0);
    if (editingId) {
      var c = findCustom(editingId);
      if (c) {
        title.textContent = '编辑纪念日';
        nameEl.value = c.title || '';
        dateEl.value = c.date || '';
        noteEl.value = c.note || '';
        setRemindActive(Number(c.remind) || 0);
      } else {
        editingId = null;
        title.textContent = '添加纪念日';
      }
    } else {
      title.textContent = '添加纪念日';
    }
    UI.openSheet('anniv-sheet');
  }

  function setRemindActive(v) {
    var chips = document.querySelectorAll('#anniv-remind .mood-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('active', Number(chips[i].getAttribute('data-remind')) === Number(v));
    }
  }
  function getRemindValue() {
    var chips = document.querySelectorAll('#anniv-remind .mood-chip');
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].classList.contains('active')) return Number(chips[i].getAttribute('data-remind')) || 0;
    }
    return 0;
  }

  function saveAdd() {
    var name = document.getElementById('anniv-name').value.trim();
    var dateStr = document.getElementById('anniv-date').value;
    var note = document.getElementById('anniv-note').value.trim();
    if (!name) { UI.toast('给这个日子起个名字吧'); return; }
    if (!dateStr) { UI.toast('选择一个日期'); return; }
    var remind = getRemindValue();
    var list = State.customAnniv();

    if (editingId) {
      var idx = -1;
      for (var i = 0; i < list.length; i++) if (list[i].id === editingId) { idx = i; break; }
      if (idx < 0) { UI.toast('要编辑的纪念日不存在'); return; }
      list[idx].title = name;
      list[idx].date = dateStr;
      list[idx].note = note;
      list[idx].remind = remind;
      State.saveCustomAnniv(list);
      UI.closeSheet('anniv-sheet');
      editingId = null;
      UI.toast('已更新纪念日');
      render();
      return;
    }

    var newId = Utils.uid('anniv');
    list.push({
      id: newId,
      title: name,
      date: dateStr,
      note: note,
      remind: remind,
      createdAt: Utils.fmtInput(Utils.today())
    });
    State.saveCustomAnniv(list);
    UI.closeSheet('anniv-sheet');
    editingId = null;
    UI.toast('已添加纪念日');
    render();
  }
  function removeCustom(id) {
    UI.confirm({
      title: '要移除这个纪念日吗？',
      text: '移除后就不会出现在纪念日列表里了。',
      okText: '移除',
      cancelText: '取消'
    }).then(function (ok) {
      if (!ok) return;
      var removed = State.customAnniv().filter(function (x) { return x.id === id; });
      if (removed.length && removed[0].coverId) OD.PhotoStore.remove(removed[0].coverId);
      State.saveCustomAnniv(State.customAnniv().filter(function (x) { return x.id !== id; }));
      // 同步清理顺序记录中的该条目
      writeOrder(readOrder().filter(function (k) { return k !== (G_CUSTOM + ':' + id); }));
      UI.toast('已移除');
      render();
    });
  }

  /* ---------- 提醒检查（E） ----------
     进入页面时由 app.js 调用：遍历自定义纪念日，remind>0 且 diff===remind 时弹出提示。
     防重复：od.annivReminded 记录 {id: 提醒日期}，同一天同一纪念日只提醒一次。 */
  var REMINDED_KEY = 'annivReminded';
  function checkReminders() {
    try {
      var list = State.customAnniv();
      if (!list.length) return;
      var todayStr = Utils.fmtInput(Utils.today());
      var done = LS.get(REMINDED_KEY, {});
      var hit = null;
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        var r = Number(it.remind) || 0;
        if (r <= 0 || !it.date) continue;
        var diff = Utils.diffDaysFromToday(Utils.parseDate(it.date));
        if (diff !== r) continue;
        if (done[it.id] === todayStr) continue;
        done[it.id] = todayStr;
        if (!hit) hit = it;
      }
      if (!hit) return;
      LS.set(REMINDED_KEY, done);
      var d = Utils.parseDate(hit.date);
      UI.tipSheet('🔔 「' + hit.title + '」还有 ' + hit.remind + ' 天就到了！\n\n' + dateCNOf(hit.date) + '\n\n记得提前准备一下，给TA一个惊喜吧。');
    } catch (e) { /* 提醒失败不阻塞页面 */ }
  }
  function findAuto(n) {
    var arr = collectAuto().filter(function (x) { return x.n === n; });
    return arr.length ? arr[0] : null;
  }
  function findCustom(id) {
    var arr = customList().filter(function (x) { return x.id === id; });
    return arr.length ? arr[0] : null;
  }

  function bind() {
    document.getElementById('anniv-add').addEventListener('click', function () { openAdd(null); });
    document.getElementById('anniv-save').addEventListener('click', saveAdd);

    /* 提醒 chips：点击切换选中 */
    var remindBar = document.getElementById('anniv-remind');
    if (remindBar) {
      remindBar.addEventListener('click', function (e) {
        var chip = e.target.closest ? e.target.closest('.mood-chip') : null;
        if (!chip || !remindBar.contains(chip)) return;
        setRemindActive(Number(chip.getAttribute('data-remind')) || 0);
      });
    }

    bindDrag();

    document.getElementById('page-anniv').addEventListener('click', function (e) {
      if (Date.now() < suppressClickUntil) return;   // 刚拖动过：忽略尾巴 click
      var t = e.target;
      /* 空状态引导按钮 */
      var emptyAdd = t.closest ? t.closest('[data-anniv-empty-add]') : null;
      if (emptyAdd) { openAdd(null); return; }
      var del = t.closest ? t.closest('[data-custom-del]') : null;
      if (del) { removeCustom(del.getAttribute('data-custom-del')); return; }
      var edit = t.closest ? t.closest('[data-custom-edit]') : null;
      if (edit) { openAdd(edit.getAttribute('data-custom-edit')); return; }
      var row = t.closest ? t.closest('.anniv-item') : null;
      if (!row) return;
      var rAuto = row.getAttribute('data-auto');
      var rCustom = row.getAttribute('data-custom');
      if (rAuto !== null) {
        var a2 = findAuto(Number(rAuto));
        if (a2) {
          var tail = a2.diff >= 0 ? '，记得好好纪念一下。' : '，时间过得真快呀。';
          UI.tipSheet('「' + autoTitle(a2.n) + '」' + dateCNOf(Utils.fmtInput(a2.date)) + '\n\n' + countText(a2.diff) + tail);
        }
      } else if (rCustom) {
        var c2 = findCustom(rCustom);
        if (c2) {
          UI.tipSheet('「' + c2.title + '」' + dateCNOf(c2.date) + '\n\n' + countText(Utils.diffDaysFromToday(Utils.parseDate(c2.date))) + (c2.remind > 0 ? '\n\n🔔 提前 ' + c2.remind + ' 天提醒' : '') + (c2.note ? '\n\n' + c2.note : ''));
        }
      }
    });
  }

  global.Views.anniv = { render: render };
  /* 供 app.js 在页面加载完成后触发提醒检查 */
  global.AnnivReminder = { check: checkReminders };
  bind();
})(window);
