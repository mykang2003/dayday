/* ============================================================
   和你第N天 · anniversary.js
   纪念日（PRD 9）：自定义 / 自动纪念日 · 倒计时 · 拖拽排序
   ------------------------------------------------------------
   列表顺序规则（本次改造）：
     1. 自定义纪念日整体排在自动纪念日之前（DOM 用分组标题体现该顺序）；
     2. 组内顺序由拖拽决定，持久化在 localStorage 的 od.annivOrder（字符串 key 数组）；
     3. 新条目（未出现在顺序记录里）按默认次序追加到本组末尾，
        因此新增纪念日不会打乱已拖拽好的老顺序。
   拖拽：零依赖 Pointer 兼容实现（鼠标 + 触摸），把手 .ai-grip 上触摸不滚页面。
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
  var GRIP = '≡';                   // 拖拽把手字形

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function weekdayOf(d) { return d ? WEEK[d.getDay()] : ''; }
  function dateCNOf(dateStr) {
    var d = Utils.parseDate(dateStr);
    return d ? (Utils.fmtCN(d) + ' · ' + weekdayOf(d)) : String(dateStr || '');
  }
  /* 日期行 HTML（hero 主卡片 / 列表项）："· 周X" 包进 .ai-dow 整体不换行，
     窄屏（含 320px）空间不足时在"·"前整体换行，避免"周五/周一"被拆字截断 */
  function dateCNHtml(dateStr) {
    var d = Utils.parseDate(dateStr);
    if (!d) return esc(dateStr || '');
    return esc(Utils.fmtCN(d)) + '<span class="ai-dow"> · ' + weekdayOf(d) + '</span>';
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
        title: c.title, dateStr: c.date, note: c.note || ''
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
      '<div class="nah-days">' + countText(cand.diff) + '</div>' +
      '<div class="nc-btn-row"><button class="btn btn-soft btn-sm" data-share-hero>生成分享卡</button></div>';
  }

  /* 双人名字（引导页/编辑资料设置）；未设置时整行隐藏，排版与旧版一致 */
  function renderNames() {
    var el = document.getElementById('anniv-names');
    if (!el) return;
    var pn = Utils.pairNames();
    el.textContent = pn.has ? pn.text : '';
    el.hidden = !pn.has;
  }

  function customRowHtml(it) {
    var diff = Utils.diffDaysFromToday(Utils.parseDate(it.dateStr));
    return '<div class="anniv-item" data-custom="' + esc(it.id) + '" data-key="' + esc(it.key) + '">' +
      '<span class="ai-grip" data-grip role="button" aria-label="按住拖动排序" tabindex="-1">' + GRIP + '</span>' +
      '<span class="ai-icon">💝</span>' +
      '<div class="ai-main">' +
        '<div class="ai-title">' + esc(it.title) + '</div>' +
        '<div class="ai-date">' + dateCNHtml(it.dateStr) + (it.note ? ' · ' + esc(it.note) : '') + '</div>' +
      '</div>' +
      '<div class="ai-count">' + countText(diff) + '</div>' +
      (diff >= 0 ? '<button class="ai-del" data-share-custom="' + esc(it.id) + '" aria-label="生成分享卡">🖼</button>' : '') +
      '<button class="ai-del" data-custom-del="' + esc(it.id) + '" aria-label="移除">🗑</button>' +
    '</div>';
  }

  function autoRowHtml(it) {
    var passed = it.diff < 0;
    var isKey = OD.AUTO_HIGHLIGHT.indexOf(it.n) > -1;
    var shareBtn = passed ? '' : '<button class="ai-del" data-share-auto="' + it.n + '" aria-label="生成分享卡">🖼</button>';
    return '<div class="anniv-item' + (passed ? ' passed' : '') + '" data-auto="' + it.n + '" data-key="' + esc(it.key) + '">' +
      '<span class="ai-grip" data-grip role="button" aria-label="按住拖动排序" tabindex="-1">' + GRIP + '</span>' +
      '<span class="ai-icon">💕</span>' +
      '<div class="ai-main">' +
        '<div class="ai-title">' + autoTitle(it.n) + (isKey ? '<span class="anniv-flag">重点</span>' : '') + '</div>' +
        '<div class="ai-date">' + dateCNHtml(it.dateStr) + '</div>' +
      '</div>' +
      '<div class="ai-count">' + countText(it.diff) + '</div>' +
      shareBtn +
    '</div>';
  }

  function renderList() {
    var box = document.getElementById('anniv-list');
    if (!box) return;
    var data = buildList();
    var html = '<div class="anniv-group-title">自定义纪念日</div>';
    if (!data.customs.length) {
      html += '<div class="anniv-item anniv-empty" style="justify-content:center;cursor:default">' +
        '<div class="ai-title" style="color:var(--sub);font-weight:400">还没有专属纪念日，点右上角 ＋ 添加一个吧</div></div>';
    } else {
      html += data.customs.map(customRowHtml).join('');
    }
    html += '<div class="anniv-group-title">自动纪念日</div>' + data.autos.map(autoRowHtml).join('');
    box.innerHTML = html;
  }

  function render() {
    var couple = State.couple();
    if (!couple) { global.Nav.go('/onboarding'); return; }
    renderNames();
    renderHero();
    renderList();
  }

  /* ---------- 拖拽排序（鼠标 + 触摸） ----------
     · 仅在把手 .ai-grip 上按下才进入拖拽，避免与「点行看详情 / 点按钮」冲突；
     · 移动超过 6px 才真正激活，轻点不改变顺序；
     · 只允许同组互换位置（自定义 / 自动各自一组，跨组落点回退为本组末尾）；
     · 松手即把当前 DOM 顺序写回 od.annivOrder，并重渲染保证与存储一致。 */
  var drag = null;
  var suppressClickUntil = 0;

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
    var grip = target && target.closest ? target.closest('[data-grip]') : null;
    if (!grip) return false;
    var row = grip.closest ? grip.closest('.anniv-item[data-key]') : null;
    if (!row) return false;
    drag = { row: row, group: groupOf(row), active: false, sx: cx, sy: cy };
    return true;
  }

  function dragMove(cx, cy) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.abs(cy - drag.sy) < 6 && Math.abs(cx - drag.sx) < 6) return;
      drag.active = true;
      drag.row.classList.add('dragging');
      drag.row.setAttribute('aria-grabbed', 'true');
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

    // 起点：把手（事件委托，列表 innerHTML 重建后依然有效）
    box.addEventListener('mousedown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (dragBegin(e.clientX, e.clientY, e.target)) e.preventDefault();
    });
    box.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      var t = e.touches[0];
      if (dragBegin(t.clientX, t.clientY, e.target) && e.cancelable) e.preventDefault();
    }, { passive: false });

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

  /* ---------- 增删 ---------- */
  function openAdd() {
    document.getElementById('anniv-sheet-title').textContent = '添加纪念日';
    document.getElementById('anniv-name').value = '';
    document.getElementById('anniv-date').value = '';
    document.getElementById('anniv-note').value = '';
    UI.openSheet('anniv-sheet');
  }
  function saveAdd() {
    var name = document.getElementById('anniv-name').value.trim();
    var dateStr = document.getElementById('anniv-date').value;
    var note = document.getElementById('anniv-note').value.trim();
    if (!name) { UI.toast('给这个日子起个名字吧'); return; }
    if (!dateStr) { UI.toast('选择一个日期'); return; }
    var list = State.customAnniv();
    list.push({
      id: Utils.uid('anniv'),
      title: name,
      date: dateStr,
      note: note,
      createdAt: Utils.fmtInput(Utils.today())
    });
    State.saveCustomAnniv(list);
    UI.closeSheet('anniv-sheet');
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
      State.saveCustomAnniv(State.customAnniv().filter(function (x) { return x.id !== id; }));
      // 同步清理顺序记录中的该条目
      writeOrder(readOrder().filter(function (k) { return k !== (G_CUSTOM + ':' + id); }));
      UI.toast('已移除');
      render();
    });
  }
  function shareAnniv(title, dateStr, diff, quote) {
    global.ShareOpen('anniv', {
      title: title,
      dateCN: dateCNOf(dateStr),
      remain: diff,
      quote: quote || ''
    }, '/anniv');
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
    document.getElementById('anniv-add').addEventListener('click', openAdd);
    document.getElementById('anniv-save').addEventListener('click', saveAdd);
    bindDrag();

    document.getElementById('page-anniv').addEventListener('click', function (e) {
      if (Date.now() < suppressClickUntil) return;   // 刚拖动过：忽略尾巴 click
      var t = e.target;
      if (t.closest && t.closest('[data-grip]')) return; // 把手上的点击不触发行详情
      var btn = t.closest ? t.closest('[data-share-hero],[data-share-auto],[data-share-custom],[data-custom-del]') : null;
      if (btn) {
        var hero = btn.getAttribute('data-share-hero') !== null;
        var autoN = btn.getAttribute('data-share-auto');
        var customId = btn.getAttribute('data-share-custom');
        var delId = btn.getAttribute('data-custom-del');
        if (delId) { removeCustom(delId); return; }
        if (hero) {
          var c = heroCandidate(collectAuto(), customList());
          if (c) shareAnniv(c.kind === 'auto' ? autoTitle(c.n) : c.title,
            c.kind === 'auto' ? Utils.fmtInput(c.date) : c.dateStr, c.diff, c.note);
        } else if (autoN !== null) {
          var a = findAuto(Number(autoN));
          if (a && a.diff >= 0) shareAnniv(autoTitle(a.n), Utils.fmtInput(a.date), a.diff, '');
        } else if (customId) {
          var cu = findCustom(customId);
          if (cu) shareAnniv(cu.title, cu.date, Utils.diffDaysFromToday(Utils.parseDate(cu.date)), cu.note);
        }
        return;
      }
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
          UI.tipSheet('「' + c2.title + '」' + dateCNOf(c2.date) + '\n\n' + countText(Utils.diffDaysFromToday(Utils.parseDate(c2.date))) + (c2.note ? '\n\n' + c2.note : ''));
        }
      }
    });
  }

  global.Views.anniv = { render: render };
  bind();
})(window);
