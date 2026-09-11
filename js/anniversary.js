/* ============================================================
   和你第N天 · anniversary.js
   纪念日（PRD 9）：自动纪念日 / 自定义纪念日 / 倒计时
   ============================================================ */
(function (global) {
  'use strict';
  var OD = global.OurDays;
  var Utils = OD.Utils;
  var State = OD.State;
  var UI = global.UI;

  global.Views = global.Views || {};

  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var LABELS = {
    7: '一周', 30: '满月', 50: '五十天', 100: '百天', 365: '一周年', 520: '我爱你',
    666: '666天', 999: '长长久久', 1000: '千天', 1314: '一生一世', 2000: '两千天', 3650: '十周年'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function weekdayOf(d) { return d ? WEEK[d.getDay()] : ''; }
  function dateCNOf(dateStr) {
    var d = Utils.parseDate(dateStr);
    return d ? (Utils.fmtCN(d) + ' · ' + weekdayOf(d)) : String(dateStr || '');
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
      '<div class="nah-date">' + dateCNOf(dateStr) + '</div>' +
      '<div class="nah-days">' + countText(cand.diff) + '</div>' +
      '<div class="nc-btn-row"><button class="btn btn-soft btn-sm" data-share-hero>生成分享卡</button></div>';
  }

  function renderAuto() {
    var box = document.getElementById('auto-anniv-list');
    var html = '';
    collectAuto().forEach(function (a) {
      var passed = a.diff < 0;
      var isKey = OD.AUTO_HIGHLIGHT.indexOf(a.n) > -1;
      var shareBtn = passed ? '' : '<button class="ai-del" data-share-auto="' + a.n + '" aria-label="生成分享卡">🖼</button>';
      html +=
        '<div class="anniv-item' + (passed ? ' passed' : '') + '" data-auto="' + a.n + '">' +
          '<span class="ai-icon">💕</span>' +
          '<div class="ai-main">' +
            '<div class="ai-title">' + autoTitle(a.n) + (isKey ? '<span class="anniv-flag">重点</span>' : '') + '</div>' +
            '<div class="ai-date">' + dateCNOf(Utils.fmtInput(a.date)) + '</div>' +
          '</div>' +
          '<div class="ai-count">' + countText(a.diff) + '</div>' +
          shareBtn +
        '</div>';
    });
    box.innerHTML = html;
  }

  function renderCustom() {
    var box = document.getElementById('custom-anniv-list');
    var customs = customList();
    if (!customs.length) {
      box.innerHTML =
        '<div class="anniv-item" style="justify-content:center;cursor:default">' +
        '<div class="ai-title" style="color:var(--sub);font-weight:400">还没有专属纪念日，点右上角 ＋ 添加一个吧</div></div>';
      return;
    }
    var html = '';
    customs.forEach(function (c) {
      var diff = Utils.diffDaysFromToday(Utils.parseDate(c.date));
      html +=
        '<div class="anniv-item" data-custom="' + esc(c.id) + '">' +
          '<span class="ai-icon">💝</span>' +
          '<div class="ai-main">' +
            '<div class="ai-title">' + esc(c.title) + '</div>' +
            '<div class="ai-date">' + dateCNOf(c.date) + (c.note ? ' · ' + esc(c.note) : '') + '</div>' +
          '</div>' +
          '<div class="ai-count">' + countText(diff) + '</div>' +
          (diff >= 0 ? '<button class="ai-del" data-share-custom="' + esc(c.id) + '" aria-label="生成分享卡">🖼</button>' : '') +
          '<button class="ai-del" data-custom-del="' + esc(c.id) + '" aria-label="移除">🗑</button>' +
        '</div>';
    });
    box.innerHTML = html;
  }

  function render() {
    var couple = State.couple();
    if (!couple) { global.Nav.go('/onboarding'); return; }
    renderHero();
    renderAuto();
    renderCustom();
  }

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

    document.getElementById('page-anniv').addEventListener('click', function (e) {
      var t = e.target;
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
