/* ============================================================
   和你第N天 · lunar.js
   农历（阴历）离线换算 —— 纯静态、零依赖、不联网
   ------------------------------------------------------------
   · 数据来源：.NET ChineseLunisolarCalendar 内置历表（其覆盖区间为
     1901-02-19 ~ 2101-01-28），构建期一次性导出为下方压缩整数表，
     运行期只做整数运算，不请求网络、不加载外部文件、不使用 CDN。
   · 覆盖范围：公历 1901-02-19（农历 1901 年正月初一）
                ~ 2100-12-31（农历 2100 年腊月）
     超出范围返回 null，调用方需自行兜底（不显示农历即可）。
   · 每一年 1 个整数，位含义：
       bit16        闰月大小：1 = 30 天，0 = 29 天（无闰月时忽略）
       bit15 ~ bit4 正月 ~ 十二月大小：1 = 30 天，0 = 29 天
       bit3  ~ bit0 闰月月份：0 = 无闰月，n = 闰 n 月
   ============================================================ */
(function (global) {
  'use strict';

  var FROM_YEAR = 1901;
  var TO_YEAR = 2100;

  var DAY_MS = 86400000;
  /* 基准点：公历 1901-02-19 = 农历 1901 年正月初一 */
  var BASE_UTC = Date.UTC(1901, 1, 19);

  var MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '冬月', '腊月'];

  var DAY_NAMES = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

  /* 1901 ~ 2100 年压缩历表（200 项） */
  var INFO = [
    0x4AE0, 0xA570, 0x54D5, 0xD260, 0xD950, 0x16554, 0x56A0, 0x9AD0,
    0x55D2, 0x4AE0, 0xA5B6, 0xA4D0, 0xD250, 0x1D255, 0xB540, 0xD6A0,
    0xADA2, 0x95B0, 0x14977, 0x4970, 0xA4B0, 0xB4B5, 0x6A50, 0x6D40,
    0x1AB54, 0x2B60, 0x9570, 0x52F2, 0x4970, 0x6566, 0xD4A0, 0xEA50,
    0x16A95, 0x5AD0, 0x2B60, 0x186E3, 0x92E0, 0x1C8D7, 0xC950, 0xD4A0,
    0x1D8A6, 0xB550, 0x56A0, 0x1A5B4, 0x25D0, 0x92D0, 0xD2B2, 0xA950,
    0xB557, 0x6CA0, 0xB550, 0x15355, 0x4DA0, 0xA5B0, 0x14573, 0x52B0,
    0xA9A8, 0xE950, 0x6AA0, 0xAEA6, 0xAB50, 0x4B60, 0xAAE4, 0xA570,
    0x5260, 0xF263, 0xD950, 0x5B57, 0x56A0, 0x96D0, 0x4DD5, 0x4AD0,
    0xA4D0, 0xD4D4, 0xD250, 0xD558, 0xB540, 0xB6A0, 0x195A6, 0x95B0,
    0x49B0, 0xA974, 0xA4B0, 0xB27A, 0x6A50, 0x6D40, 0xAF46, 0xAB60,
    0x9570, 0x4AF5, 0x4970, 0x64B0, 0x74A3, 0xEA50, 0x6B58, 0x5AC0,
    0xAB60, 0x96D5, 0x92E0, 0xC960, 0xD954, 0xD4A0, 0xDA50, 0x7552,
    0x56A0, 0xABB7, 0x25D0, 0x92D0, 0xCAB5, 0xA950, 0xB4A0, 0xBAA4,
    0xAD50, 0x55D9, 0x4BA0, 0xA5B0, 0x15176, 0x52B0, 0xA930, 0x7954,
    0x6AA0, 0xAD50, 0x5B52, 0x4B60, 0xA6E6, 0xA4E0, 0xD260, 0xEA65,
    0xD530, 0x5AA0, 0x76A3, 0x96D0, 0x4AFB, 0x4AD0, 0xA4D0, 0x1D0B6,
    0xD250, 0xD520, 0xDD45, 0xB5A0, 0x56D0, 0x55B2, 0x49B0, 0xA577,
    0xA4B0, 0xAA50, 0x1B255, 0x6D20, 0xADA0, 0x14B63, 0x9370, 0x49F8,
    0x4970, 0x64B0, 0x168A6, 0xEA50, 0x6B20, 0x1A6C4, 0xAAE0, 0x92E0,
    0xD2E3, 0xC960, 0xD557, 0xD4A0, 0xDA50, 0x5D55, 0x56A0, 0xA6D0,
    0x55D4, 0x52D0, 0xA9B8, 0xA950, 0xB4A0, 0xB6A6, 0xAD50, 0x55A0,
    0xABA4, 0xA5B0, 0x52B0, 0xB273, 0x6930, 0x7337, 0x6AA0, 0xAD50,
    0x14B55, 0x4B60, 0xA570, 0x54E4, 0xD260, 0xE968, 0xD520, 0xDAA0,
    0x16AA6, 0x56D0, 0x4AE0, 0xA9D4, 0xA4D0, 0xD150, 0xF252, 0xD520
  ];

  function infoOf(y) { return INFO[y - FROM_YEAR]; }
  function leapMonthOf(y) { return infoOf(y) & 0xf; }
  function leapDaysOf(y) { return leapMonthOf(y) ? ((infoOf(y) & 0x10000) ? 30 : 29) : 0; }
  /* 某农历月天数：m = 1~12（不含闰月） */
  function monthDaysOf(y, m) { return (infoOf(y) & (0x10000 >> m)) ? 30 : 29; }
  function yearDaysOf(y) {
    var info = infoOf(y), sum = 348, mask = 0x8000;
    while (mask > 0x8) {
      if (info & mask) sum++;
      mask >>= 1;
    }
    return sum + leapDaysOf(y);
  }

  /* 农历月名：m=1~12，isLeap 时前缀「闰」 */
  function monthName(m, isLeap) {
    if (m < 1 || m > 12) return '';
    return (isLeap ? '闰' : '') + MONTH_NAMES[m - 1];
  }
  /* 农历日名：1~30 */
  function dayName(d) {
    if (d < 1 || d > 30) return '';
    return DAY_NAMES[d - 1];
  }

  function utcOf(date) { return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()); }

  /* 支持范围判断（按公历） */
  function inRange(date) {
    if (!date || isNaN(date.getTime())) return false;
    var off = Math.round((utcOf(date) - BASE_UTC) / DAY_MS);
    return off >= 0 && off < 73028; /* 73028 = 1901-02-19 ~ 2101-01-28 的天数 */
  }

  /* 公历 → 农历
     返回 { y, m, d, isLeap, monthName, dayName, label, cell }
       label：完整农历名（如「八月初十」「闰四月初一」）
       cell ：日历格内使用的短文本（初一显示月名，其余显示日名）
     超出 1901-02-19 ~ 2100-12-31 时返回 null */
  function fromDate(date) {
    if (!date || isNaN(date.getTime())) return null;
    var off = Math.round((utcOf(date) - BASE_UTC) / DAY_MS);
    if (off < 0) return null;

    var y = FROM_YEAR, yd;
    while (y <= TO_YEAR) {
      yd = yearDaysOf(y);
      if (off < yd) break;
      off -= yd;
      y++;
    }
    if (y > TO_YEAR) return null;

    var lm = leapMonthOf(y), m = 1, isLeap = false, days, guard = 0;
    while (guard++ < 30) {
      if (isLeap) {
        days = leapDaysOf(y);
        if (off < days) break;
        off -= days;
        isLeap = false;
        m++;
      } else {
        days = monthDaysOf(y, m);
        if (off < days) break;
        off -= days;
        if (lm === m) isLeap = true;
        else m++;
      }
    }
    if (m > 12) return null;

    var d = off + 1;
    var mn = monthName(m, isLeap), dn = dayName(d);
    return {
      y: y, m: m, d: d, isLeap: isLeap,
      monthName: mn,
      dayName: dn,
      label: mn + dn,
      cell: (d === 1) ? mn : dn
    };
  }

  /* 便捷：只要日历格短文本，取不到返回 '' */
  function cellOf(date) {
    var r = fromDate(date);
    return r ? r.cell : '';
  }
  /* 便捷：完整农历名，取不到返回 '' */
  function labelOf(date) {
    var r = fromDate(date);
    return r ? r.label : '';
  }

  /* 农历 → 公历
     输入农历年 y（1901~2100）、月 m（1~12）、日 d（1~30）、是否闰月 isLeap
     返回该农历日对应的公历 Date（与 fromDate 同基准，正时区 getFullYear/Month/Date 即为公历日）；
     · 农历年超出支持范围返回 null；
     · 月日非法（m 不在 1~12、d 不在 1~30）返回 null；
     · 该年不存在闰 m 月时 isLeap 请求返回 null；
     · 该农历月实际天数不足 d（如当年腊月仅廿九但 d=30）时取该月最后一天兜底 */
  function toSolarDate(y, m, d, isLeap) {
    y = +y; m = +m; d = +d;
    if (!y || !m || !d) return null;
    if (y < FROM_YEAR || y > TO_YEAR) return null;
    if (m < 1 || m > 12 || d < 1 || d > 30) return null;
    var lm = leapMonthOf(y);
    if (isLeap && lm !== m) return null;

    var off = 0;
    for (var yy = FROM_YEAR; yy < y; yy++) off += yearDaysOf(yy);

    var cur = 1;
    if (isLeap) {
      /* 闰 m 月：先经过 1..m-1 常规月与常规 m 月，到达闰 m 月初一 */
      while (cur < m) { off += monthDaysOf(y, cur); cur++; }
      off += monthDaysOf(y, m);
    } else {
      /* 常规 m 月：经过 1..m-1 常规月；闰月紧跟在其同名月之后 */
      while (cur < m) {
        off += monthDaysOf(y, cur);
        if (cur === lm) off += leapDaysOf(y);
        cur++;
      }
    }

    var real = isLeap ? leapDaysOf(y) : monthDaysOf(y, m);
    if (d > real) d = real; /* 该月无此日，取月末兜底 */
    return new Date(BASE_UTC + (off + d - 1) * DAY_MS);
  }

  global.OurDays = global.OurDays || {};
  global.OurDays.Lunar = {
    range: { from: '1901-02-19', to: '2100-12-31' },
    FROM_YEAR: FROM_YEAR,
    TO_YEAR: TO_YEAR,
    fromDate: fromDate,
    toSolarDate: toSolarDate,
    cellOf: cellOf,
    labelOf: labelOf,
    monthName: monthName,
    dayName: dayName,
    inRange: inRange
  };
})(window);
