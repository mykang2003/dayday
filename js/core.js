/* ============================================================
   和你第N天 · core.js
   工具 + 日期计算 + 本地存储(LocalStorage / IndexedDB)
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 本地存储封装 ----------
     iOS 隐私模式 / 站点数据被禁用 / 配额写满时，localStorage 会抛异常：
     此时自动降级为「内存存储」，保证页面不白屏、功能可继续操作（仅本次会话有效） */
  var LS_PREFIX = 'od.';
  var _memStore = {};
  var LS = {
    get: function (key, fallback) {
      if (Object.prototype.hasOwnProperty.call(_memStore, key)) {
        try { return JSON.parse(_memStore[key]); } catch (e) { /* fallthrough */ }
      }
      try {
        var raw = localStorage.getItem(LS_PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, val) {
      var s;
      try { s = JSON.stringify(val); } catch (e) { return; }
      _memStore[key] = s; // 会话内兜底副本
      try { localStorage.setItem(LS_PREFIX + key, s); } catch (e) { /* 隐私模式/配额：仅内存可用 */ }
    },
    remove: function (key) {
      delete _memStore[key];
      try { localStorage.removeItem(LS_PREFIX + key); } catch (e) { /* ignore */ }
    },
    /* 是否真正可持久化（供 UI 提示用，不抛异常） */
    persistent: function () {
      try {
        var k = LS_PREFIX + '__probe__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch (e) { return false; }
    }
  };

  /* ---------- 图片 IndexedDB 存储（附 LocalStorage 兜底） ---------- */
  var DB_NAME = 'ourdays-photos';
  var DB_STORE = 'photos';
  var _dbPromise = null;
  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function (resolve) {
      try {
        if (!global.indexedDB) { resolve(null); return; }
        var req = global.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          try {
            if (!req.result.objectStoreNames.contains(DB_STORE)) {
              req.result.createObjectStore(DB_STORE, { keyPath: 'id' });
            }
          } catch (e) { /* ignore */ }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); } /* iOS 隐私模式下 open 可能同步抛错 */
    });
    return _dbPromise;
  }

  /* 统一的事务封装：任何异常都不阻塞调用方（resolve(false)，由上层走兜底/静默） */
  function withStore(mode, fn) {
    return openDB().then(function (db) {
      if (!db) return false; /* 无 IndexedDB：交由调用方走 LocalStorage 兜底 */
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(DB_STORE, mode);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
          fn(tx.objectStore(DB_STORE));
        } catch (e) { resolve(false); }
      });
    });
  }

  var PhotoStore = {
    /* dataUrl: string */
    put: function (id, dataUrl) {
      return openDB().then(function (db) {
        if (!db) { // fallback：无 IndexedDB 时用 LocalStorage（容量有限）
          var map = LS.get('photos.fallback', {});
          map[id] = dataUrl;
          LS.set('photos.fallback', map);
          return true;
        }
        return withStore('readwrite', function (store) {
          store.put({ id: id, dataUrl: dataUrl });
        });
      }).catch(function () { return false; });
    },
    get: function (id) {
      return openDB().then(function (db) {
        if (!db) {
          var map = LS.get('photos.fallback', {});
          return map[id] || null;
        }
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction(DB_STORE, 'readonly');
            var req = tx.objectStore(DB_STORE).get(id);
            req.onsuccess = function () {
              var row = req.result;
              resolve(row ? row.dataUrl : null);
            };
            req.onerror = function () { resolve(null); };
          } catch (e) { resolve(null); }
        });
      }).catch(function () { return null; });
    },
    remove: function (id) {
      return openDB().then(function (db) {
        if (!db) {
          var map = LS.get('photos.fallback', {});
          delete map[id];
          LS.set('photos.fallback', map);
          return true;
        }
        return withStore('readwrite', function (store) { store.delete(id); });
      }).catch(function () { return false; });
    },
    clear: function () {
      LS.remove('photos.fallback');
      return openDB().then(function (db) {
        if (!db) return true;
        return withStore('readwrite', function (store) { store.clear(); });
      }).catch(function () { return false; });
    }
  };

  /* ---------- 日期计算 ----------
     规则：开始日 = 第 1 天（见 PRD 44.1）
     以本地零点换算 UTC 毫秒差，避免夏令时/时区误差 */
  function toUTCDate(d) {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function parseDate(str) {
    if (!str) return null;
    var parts = String(str).split('-');
    if (parts.length !== 3) return null;
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  }
  function fmtCN(d) {
    if (!d || isNaN(d.getTime())) return '';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function fmtDot(d) {
    if (!d || isNaN(d.getTime())) return '';
    return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
  }
  function fmtInput(d) {
    if (!d || isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function today() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  /* 恋爱第 N 天：开始日当天=1 */
  function dayNumber(start) {
    if (!start) return 0;
    var diff = Math.round((toUTCDate(today()) - toUTCDate(start)) / 86400000);
    return diff < 0 ? 0 : diff + 1;
  }
  /* 第 n 天纪念日的日期 = 开始日 + (n-1) 天 */
  function nthDayDate(start, n) {
    if (!start) return null;
    var d = new Date(start);
    d.setDate(d.getDate() + (n - 1));
    return d;
  }
  function diffDaysFromToday(date) {
    var diff = Math.round((toUTCDate(date) - toUTCDate(today())) / 86400000);
    return diff;
  }
  /* 在一起总时长：从开始日到今天的「X 年 X 个月 X 天」（按自然月/年差计算） */
  function duration(start) {
    if (!start || isNaN(start.getTime())) return null;
    var t = today();
    var y = t.getFullYear() - start.getFullYear();
    var m = t.getMonth() - start.getMonth();
    var d = t.getDate() - start.getDate();
    if (d < 0) {
      m--;
      var prev = new Date(t.getFullYear(), t.getMonth(), 0); // 上个月最后一天
      d += prev.getDate();
    }
    if (m < 0) { y--; m += 12; }
    var text;
    if (y > 0 && m > 0) text = y + ' 年 ' + m + ' 个月 ' + d + ' 天';
    else if (y > 0) text = y + ' 年 ' + d + ' 天';
    else if (m > 0) text = m + ' 个月 ' + d + ' 天';
    else text = d + ' 天';
    return { y: y, m: m, d: d, text: text };
  }
  /* 下一个生日：接受 'YYYY-MM-DD'、'MM-DD'（公历）或 'L:MM-DD'（农历）
     公历：今年已过则取明年；
     农历：对当年与次年分别用 toSolarDate 换算公历日期，取距离今天最近且未过的；
     返回 {date, diff, month, day, isLunar} */
  function nextBirthday(bdStr) {
    if (!bdStr) return null;
    var isLunar = false;
    var s = String(bdStr);
    if (s.indexOf('L:') === 0) { isLunar = true; s = s.slice(2); }
    var parts = s.split('-');
    var month = 0, day = 0;
    if (parts.length === 3) { month = +parts[1]; day = +parts[2]; }
    else if (parts.length === 2) { month = +parts[0]; day = +parts[1]; }
    if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
    var now = today();
    var y = now.getFullYear();

    if (!isLunar) {
      var cand = new Date(y, month - 1, day);
      var diff = Math.round((toUTCDate(cand) - toUTCDate(now)) / 86400000);
      if (diff < 0) {
        cand = new Date(y + 1, month - 1, day);
        diff = Math.round((toUTCDate(cand) - toUTCDate(now)) / 86400000);
      }
      return { date: cand, diff: diff, month: month, day: day, isLunar: false };
    }

    var Lunar = global.OurDays && global.OurDays.Lunar;
    if (!Lunar || !Lunar.toSolarDate) return null;
    var cands = [];
    var d0 = Lunar.toSolarDate(y, month, day, false);
    if (d0) cands.push(d0);
    var d1 = Lunar.toSolarDate(y + 1, month, day, false);
    if (d1) cands.push(d1);
    if (!cands.length) return null;
    var best = null, bestDiff = -1;
    for (var i = 0; i < cands.length; i++) {
      var dd = Math.round((toUTCDate(cands[i]) - toUTCDate(now)) / 86400000);
      if (dd >= 0 && (best === null || dd < bestDiff)) { best = cands[i]; bestDiff = dd; }
    }
    if (best === null) {
      best = cands[0];
      bestDiff = Math.round((toUTCDate(best) - toUTCDate(now)) / 86400000);
    }
    return { date: best, diff: bestDiff, month: month, day: day, isLunar: true };
  }

  /* ---------- 常量 ---------- */
  var AUTO_ANNIV = [
    { n: 7 }, { n: 30 }, { n: 50 }, { n: 100 }, { n: 365 }, { n: 520 },
    { n: 666 }, { n: 999 }, { n: 1000 }, { n: 1314 }, { n: 2000 }, { n: 3650 }
  ];
  var AUTO_HIGHLIGHT = [100, 365, 520, 666, 999, 1000, 1314];

  var MOODS = {
    happy: { emoji: '❤️', label: '开心' },
    bliss: { emoji: '🥰', label: '幸福' },
    funny: { emoji: '😂', label: '搞笑' },
    touched: { emoji: '🥹', label: '感动' },
    unforget: { emoji: '✨', label: '难忘' },
    calm: { emoji: '🌿', label: '平静' }
  };

  var QUOTES = [
    '今天也要好好爱TA。',
    '普通的一天，因为有TA，所以值得记录。',
    '第{n}天，也还是喜欢你。',
    '愿你们的第1000天，比第1天更喜欢彼此。',
    '一起走过很多路的人，要一直走下去呀。',
    '把日子过成值得记住的样子。',
    '和TA在一起的时候，连晚风都变温柔了。'
  ];

  /* 根据标题关键词判断一个小图标（时间轴用） */
  function pickIcon(title, moodKey) {
    if (!title) return moodKey && MOODS[moodKey] ? MOODS[moodKey].emoji : '❤️';
    var rules = [
      ['在一起', '❤️'], ['表白', '💌'], ['约会', '💋'], ['送花', '🌹'],
      ['生日', '🎂'], ['旅行', '✈️'], ['旅游', '✈️'], ['见父母', '🏠'],
      ['毕业', '🎓'], ['演唱会', '🎵'], ['演出', '🎵'], ['电影', '🎬'],
      ['宠物', '🐱'], ['猫', '🐱'], ['狗', '🐶'], ['礼物', '🎁'],
      ['纪念日', '💕'], ['520', '💕'], ['跨年', '🎆'], ['新年', '🎆'],
      ['圣诞', '🎄'], ['求婚', '💍'], ['领证', '📜'], ['婚礼', '💒']
    ];
    for (var i = 0; i < rules.length; i++) {
      if (title.indexOf(rules[i][0]) > -1) return rules[i][1];
    }
    if (moodKey && MOODS[moodKey]) return MOODS[moodKey].emoji;
    return '📍';
  }

  /* ---------- 长数字自适应 ----------
     天数位数多时（如历史脏数据 41546 天）首页大数字会撑破布局，按位数切换字号 class */
  function numSizeClass(n) {
    var len = String(n === null || n === undefined ? '' : n).length;
    if (len >= 7) return 'num-7';
    if (len === 6) return 'num-6';
    if (len === 5) return 'num-5';
    if (len === 4) return 'num-4';
    return '';
  }
  function fitNum(el, n) {
    if (!el || !el.classList) return;
    var cls = numSizeClass(n);
    el.classList.remove('num-4', 'num-5', 'num-6', 'num-7');
    if (cls) el.classList.add(cls);
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  /* ---------- 业务状态 ---------- */
  var State = {
    couple: function () {
      var c = LS.get('couple', null);
      return c;
    },
    saveCouple: function (couple) { LS.set('couple', couple); },
    hasCouple: function () { return !!LS.get('couple', null); },

    memories: function () {
      var list = LS.get('memories', []);
      return list;
    },
    saveMemories: function (list) { LS.set('memories', list); },

    customAnniv: function () {
      return LS.get('customAnniv', []);
    },
    saveCustomAnniv: function (list) { LS.set('customAnniv', list); },

    /* 自己的生日自动同步到自定义纪念日：
       保存 couple（引导页/编辑资料/生日弹窗）后调用。
       以 auto='myBirthday' 标记区分，重复保存先移除旧条目再重建；
       未设置生日时清掉历史同步条目，避免残留。 */
    syncMyBirthdayAnniv: function (couple) {
      var list = LS.get('customAnniv', []).filter(function (x) { return x.auto !== 'myBirthday'; });
      var mb = couple && couple.myBirthday;
      if (mb) {
        var d = birthdayToDate(mb);
        if (d) {
          list.push({
            id: uid('anniv'),
            title: '我的生日',
            date: fmtInput(d),
            note: '自动同步自我的生日',
            auto: 'myBirthday',
            createdAt: fmtInput(today())
          });
        }
      }
      LS.set('customAnniv', list);
    },

    settings: function () {
      return LS.get('settings', { ai: { base: '', model: '', key: '' }, theme: 'cream' });
    },
    saveSettings: function (s) { LS.set('settings', s); },

    clearAll: function () {
      LS.remove('couple');
      LS.remove('memories');
      LS.remove('customAnniv');
      LS.remove('settings');
      LS.remove('photos.fallback');
      return PhotoStore.clear();
    }
  };

  /* ---------- 生日字符串 → 下一次生日 ----------
     'MM-DD' 公历 / 'L:MM-DD' 农历；取今年或明年的最近一次（含今天）。
     无法解析或超出历法支持范围时返回 null。 */
  function birthdayToDate(mb) {
    var m = 0, d = 0, isLunar = false;
    if (typeof mb === 'string' && /^L:\d{2}-\d{2}$/.test(mb)) {
      isLunar = true;
      mb = mb.slice(2);
    }
    var parts = /^(\d{2})-(\d{2})$/.exec(mb || '');
    if (!parts) return null;
    m = parseInt(parts[1], 10);
    d = parseInt(parts[2], 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var y = new Date().getFullYear();
    var todayStart = new Date(y, new Date().getMonth(), new Date().getDate());
    function solar(yy) {
      var dt;
      if (isLunar && global.OurDays && global.OurDays.Lunar && global.OurDays.Lunar.toSolarDate) {
        dt = global.OurDays.Lunar.toSolarDate(yy, m, d, false);
        if (!dt || isNaN(dt.getTime())) return null;
      } else if (isLunar) {
        return null;
      } else {
        dt = new Date(yy, m - 1, d);
      }
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }
    var cur = solar(y);
    if (!cur) return null;
    return cur < todayStart ? (solar(y + 1) || cur) : cur;
  }

  /* ---------- 双人称呼 ----------
     引导页 / 编辑资料里设置的两个人名字（couple.myName / couple.taName）。
     返回 { my, ta, has, text }：都没设置时 has=false，调用方应隐藏对应展示位，
     保证未设置昵称的老用户页面排版不变。 */
  function pairNames() {
    var c = State.couple() || {};
    var my = String(c.myName == null ? '' : c.myName).trim();
    var ta = String(c.taName == null ? '' : c.taName).trim();
    return {
      my: my,
      ta: ta,
      has: !!(my || ta),
      text: (my && ta) ? (my + ' ♥ ' + ta) : (my || ta)
    };
  }

  global.OurDays = {
    LS: LS,
    PhotoStore: PhotoStore,
    Utils: {
      parseDate: parseDate, fmtCN: fmtCN, fmtDot: fmtDot, fmtInput: fmtInput,
      today: today, dayNumber: dayNumber, nthDayDate: nthDayDate,
      diffDaysFromToday: diffDaysFromToday, duration: duration, nextBirthday: nextBirthday,
      pad: pad, uid: uid, clone: clone,
      fitNum: fitNum, numSizeClass: numSizeClass, pairNames: pairNames
    },
    AUTO_ANNIV: AUTO_ANNIV,
    AUTO_HIGHLIGHT: AUTO_HIGHLIGHT,
    MOODS: MOODS,
    QUOTES: QUOTES,
    pickIcon: pickIcon,
    State: State
  };
})(window);
