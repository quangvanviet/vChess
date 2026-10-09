/* Biểu tượng SVG tự vẽ (không dùng ảnh ngoài) cho quân, tài nguyên, tộc. viewBox 0 0 64 64 */
(function (G) {
  'use strict';
  var TT = G.TT;
  var I = TT.Icons = {};

  var P = {
    king: '<path d="M10 46 L14 20 L24 32 L32 14 L40 32 L50 20 L54 46 Z" fill="currentColor"/><rect x="10" y="48" width="44" height="6" rx="2" fill="currentColor"/><circle cx="14" cy="18" r="3" fill="currentColor"/><circle cx="32" cy="12" r="3" fill="currentColor"/><circle cx="50" cy="18" r="3" fill="currentColor"/>',
    soldier: '<path d="M32 6 L37 12 L37 40 L27 40 L27 12 Z" fill="currentColor"/><rect x="18" y="40" width="28" height="5" rx="2" fill="currentColor"/><rect x="29" y="45" width="6" height="10" fill="currentColor"/><circle cx="32" cy="58" r="3.5" fill="currentColor"/>',
    archer: '<path d="M18 6 Q50 32 18 58" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M18 6 L18 58" stroke="currentColor" stroke-width="2"/><path d="M14 32 L54 32" stroke="currentColor" stroke-width="3.5"/><path d="M54 32 L45 26 L47 32 L45 38 Z" fill="currentColor"/><path d="M14 32 L9 27 M14 32 L9 37" stroke="currentColor" stroke-width="3"/>',
    shield: '<path d="M32 6 L54 14 L52 34 Q48 50 32 58 Q16 50 12 34 L10 14 Z" fill="currentColor"/><path d="M32 14 L32 50 M20 26 L44 26" stroke="rgba(0,0,0,.45)" stroke-width="4"/>',
    cavalry: '<path d="M18 56 L22 38 Q14 30 20 20 L30 8 L33 16 Q48 16 52 30 L54 40 L46 42 L42 34 L38 36 Q42 46 40 56 Z" fill="currentColor"/><circle cx="30" cy="20" r="2.5" fill="rgba(0,0,0,.6)"/>',
    assassin: '<path d="M44 6 L50 12 L24 40 L18 34 Z" fill="currentColor"/><path d="M14 34 L30 50 L26 54 L10 38 Z" fill="currentColor"/><path d="M16 46 L8 56" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M38 48 Q52 50 56 38" fill="none" stroke="currentColor" stroke-width="3"/>',
    mage: '<path d="M20 58 L36 22" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="40" cy="16" r="9" fill="currentColor"/><path d="M40 2 L42 9 L49 10 L42 12 L40 19 L38 12 L31 10 L38 9 Z" fill="rgba(255,255,255,.9)"/><circle cx="52" cy="30" r="2.5" fill="currentColor"/><circle cx="26" cy="10" r="2" fill="currentColor"/>',
    siege: '<rect x="10" y="40" width="44" height="7" rx="2" fill="currentColor"/><circle cx="18" cy="52" r="6" fill="currentColor"/><circle cx="46" cy="52" r="6" fill="currentColor"/><path d="M30 40 L42 10" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M36 10 Q42 2 50 8 L44 16 Z" fill="currentColor"/><path d="M22 40 L30 26 L38 40" fill="none" stroke="currentColor" stroke-width="4"/>',
    chariot: '<circle cx="24" cy="40" r="15" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="24" cy="40" r="4" fill="currentColor"/><path d="M24 25 L24 55 M9 40 L39 40 M13 29 L35 51 M13 51 L35 29" stroke="currentColor" stroke-width="3"/><path d="M30 24 L56 14 L58 20 L36 30 Z" fill="currentColor"/>',
    beast: '<path d="M8 50 Q20 30 16 8 Q30 26 32 10 Q36 28 48 8 Q46 30 56 50 Q44 42 32 58 Q20 42 8 50 Z" fill="currentColor"/><circle cx="24" cy="34" r="3" fill="rgba(0,0,0,.6)"/><circle cx="40" cy="34" r="3" fill="rgba(0,0,0,.6)"/>',
    commander: '<path d="M16 6 L16 60" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M18 8 L52 12 L42 22 L52 32 L18 30 Z" fill="currentColor"/><circle cx="16" cy="6" r="4" fill="currentColor"/>',
    elephant: '<path d="M10 40 Q8 18 30 14 Q52 12 56 32 L56 52 L48 52 L48 42 L40 42 L40 52 L32 52 L30 42 Q22 44 20 52 Q18 60 10 56 Q16 54 14 46 Z" fill="currentColor"/><path d="M22 34 Q12 38 18 46" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="3"/><circle cx="24" cy="24" r="2.5" fill="rgba(0,0,0,.6)"/>',
    workerV: '<path d="M10 22 Q32 2 54 22 Q32 14 10 22 Z" fill="currentColor"/><path d="M32 16 L30 60" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    workerT: '<path d="M32 60 L32 18" stroke="currentColor" stroke-width="4"/><ellipse cx="32" cy="12" rx="5" ry="9" fill="currentColor"/><ellipse cx="22" cy="24" rx="4.5" ry="8" transform="rotate(-30 22 24)" fill="currentColor"/><ellipse cx="42" cy="24" rx="4.5" ry="8" transform="rotate(30 42 24)" fill="currentColor"/><ellipse cx="22" cy="38" rx="4.5" ry="8" transform="rotate(-30 22 38)" fill="currentColor"/><ellipse cx="42" cy="38" rx="4.5" ry="8" transform="rotate(30 42 38)" fill="currentColor"/>',
    workerG: '<path d="M22 60 L38 8" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M34 12 Q52 4 56 22 Q46 22 38 26 Z" fill="currentColor"/>',
    resV: '<circle cx="32" cy="32" r="22" fill="#f6c548"/><circle cx="32" cy="32" r="16" fill="none" stroke="#a6731a" stroke-width="3"/><path d="M26 24 L38 24 L32 42 Z" fill="#a6731a"/>',
    resT: '<path d="M32 58 L32 20" stroke="#d6b25a" stroke-width="4"/><ellipse cx="32" cy="14" rx="6" ry="10" fill="#f1d27a"/><ellipse cx="21" cy="28" rx="5" ry="9" transform="rotate(-32 21 28)" fill="#e7c25e"/><ellipse cx="43" cy="28" rx="5" ry="9" transform="rotate(32 43 28)" fill="#e7c25e"/><ellipse cx="22" cy="43" rx="5" ry="9" transform="rotate(-32 22 43)" fill="#d6ae49"/><ellipse cx="42" cy="43" rx="5" ry="9" transform="rotate(32 42 43)" fill="#d6ae49"/>',
    resG: '<path d="M32 4 L50 30 L40 30 L54 48 L10 48 L24 30 L14 30 Z" fill="#3fae6a"/><path d="M32 12 L44 30 M32 12 L20 30" stroke="#2d7d4c" stroke-width="2"/><rect x="28" y="48" width="8" height="12" fill="#8a5a2b"/>',
    soul: '<path d="M32 6 Q50 24 44 42 Q40 56 32 58 Q24 56 20 42 Q14 24 32 6 Z" fill="#b38cff"/><circle cx="27" cy="36" r="3.5" fill="#1b0b2e"/><circle cx="37" cy="36" r="3.5" fill="#1b0b2e"/><path d="M28 46 Q32 49 36 46" stroke="#1b0b2e" stroke-width="2" fill="none"/>',
    sword2: '<path d="M14 50 L46 18 M50 50 L18 18" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M10 54 L18 46 M54 54 L46 46" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    healer: '<path d="M22 58 L36 20" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M40 6 v20 M30 16 h20" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="40" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="3" opacity=".6"/>',
    coin2: '<circle cx="32" cy="33" r="26" fill="#d98a10"/><circle cx="32" cy="30" r="26" fill="#ffc83a"/><circle cx="32" cy="30" r="19" fill="#ffdf6e" stroke="#e8a21a" stroke-width="3"/><path d="M27 21h10l-2 9h6L28 44l3-11h-6Z" fill="#e8a21a"/>',
    cry: '<path d="M32 4 52 22 32 60 12 22Z" fill="#7fd7ff"/><path d="M32 4 40 22 32 60 24 22Z" fill="#c6f1ff"/><path d="M12 22h40" stroke="#3a9ad6" stroke-width="2"/><path d="M32 4 52 22 32 60 12 22Z" fill="none" stroke="#2a7ab6" stroke-width="2"/>',
    it_sword: '<path d="M46 6 L56 6 L56 16 L24 48 L16 40 Z" fill="currentColor"/><path d="M12 36 L28 52" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M18 46 L8 56" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    it_armor: '<path d="M20 8 L32 14 L44 8 L56 18 L50 28 L46 26 L46 56 L18 56 L18 26 L14 28 L8 18 Z" fill="currentColor"/><path d="M32 14 L32 56" stroke="rgba(0,0,0,.3)" stroke-width="3"/>',
    it_heart: '<path d="M32 56 C10 40 6 28 10 18 C14 8 28 8 32 18 C36 8 50 8 54 18 C58 28 54 40 32 56 Z" fill="currentColor"/>',
    it_bow: '<path d="M18 6 Q52 32 18 58" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M18 6 L18 58" stroke="currentColor" stroke-width="2"/><path d="M12 32 L56 32 M48 26 L56 32 L48 38" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
    it_gem: '<path d="M18 10 H46 L58 26 L32 58 L6 26 Z" fill="currentColor"/><path d="M6 26 H58 M24 10 L32 26 L40 10 M32 26 L32 58" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2.5"/>',
    it_ring: '<circle cx="32" cy="38" r="17" fill="none" stroke="currentColor" stroke-width="7"/><path d="M24 14 L32 4 L40 14 L32 22 Z" fill="currentColor"/>',
    it_axe: '<path d="M22 58 L44 10" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M38 8 Q58 8 58 28 Q48 22 40 26 Z" fill="currentColor"/>',
    it_flag: '<path d="M14 6v52" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M16 8 Q30 2 36 10 Q44 18 54 10 L54 34 Q44 42 36 34 Q30 26 16 32 Z" fill="currentColor"/>',
    it_staff: '<path d="M18 58 L40 20" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="44" cy="14" r="10" fill="currentColor"/><circle cx="44" cy="14" r="4" fill="rgba(255,255,255,.7)"/>',
    it_bottle: '<path d="M26 6 H38 V18 Q52 24 50 42 Q48 58 32 58 Q16 58 14 42 Q12 24 26 18 Z" fill="currentColor"/><path d="M18 40 Q32 34 46 40" stroke="rgba(255,255,255,.6)" stroke-width="4" fill="none"/>',
    it_seal: '<circle cx="32" cy="32" r="22" fill="currentColor"/><path d="M32 16 L36 28 L48 28 L38 36 L42 48 L32 40 L22 48 L26 36 L16 28 L28 28 Z" fill="rgba(255,255,255,.75)"/>',
    hourglass: '<path d="M16 6 H48 M16 58 H48 M20 6 Q20 26 32 32 Q20 38 20 58 M44 6 Q44 26 32 32 Q44 38 44 58" fill="none" stroke="currentColor" stroke-width="4"/><path d="M24 50 Q32 42 40 50 Z" fill="currentColor"/>'
  };
  I.paths = P;
  I.ROLE_ICON = { linh: 'soldier', thuan: 'shield', cung: 'archer', y: 'healer', ky: 'cavalry', chihuy: 'commander', thichkhach: 'assassin', phapsu: 'mage', congthanh: 'siege', tuong: 'elephant', thanthu: 'beast' };
  I.ITEM_ICON = { kiem: 'it_sword', giap: 'it_armor', bua: 'it_heart', cunggio: 'it_bow', ngoc: 'it_gem', nhan: 'it_ring', daidao: 'it_axe', thanhtri: 'it_armor', cutam: 'it_heart', huyetkiem: 'it_sword', cohieu: 'it_flag', cunglinh: 'it_bow', phongtoc: 'it_bow', kiemda: 'it_sword', aogiaplon: 'it_armor', binhlinh: 'it_bottle', quanky: 'it_flag', truonglinh: 'it_staff', thankiem: 'it_sword', battu: 'it_seal', longgiap: 'it_armor', thientam: 'it_flag' };
  I.TIER_COLOR = { 1: '#b7c3d0', 2: '#5fb8ff', 3: '#c58bff', 4: '#ffc23a' };
  I.CORE_TIER = { 1: '#d9a066', 2: '#b9c6d6', 3: '#ffcf3a', 4: '#c58bff' };
  I.role = function (role, color, size) { return I.svg(I.ROLE_ICON[role] || 'soldier', color, size); };
  I.item = function (k, size) { var it = TT.ITEMS[k]; return '<span class="it-ic t' + (it ? it.tier : 1) + '">' + I.svg(I.ITEM_ICON[k] || 'it_gem', '#fff', size || 22) + '</span>'; };
  var CORE_FX = { hpPct: 'heart', atkPct: 'swords', critDmg: 'swords', armorPen: 'swords', def: 'shield', defPct: 'shield', reflect: 'shield', asPct: 'bolt', standAs: 'bolt', extraShot: 'bolt', ls: 'leaf', healPct: 'leaf',
    mp0: 'wand', mpGain: 'wand', mpStartPct: 'wand', skillDmg: 'wand', crit: 'target', dodge: 'wind', spdPct: 'wind', terrainFree: 'wind', goldDaily: 'coin', goldNow: 'coin', interestAdd: 'coin', freeReroll: 'dice',
    rngAdd: 'eye', farDmg: 'eye', burnOnHit: 'sun', killStack: 'skull', soulMaxAdd: 'skull', soulAtk: 'skull', rebirthAll: 'skull', deathRaise: 'skull', auraR: 'crown', auraPct: 'crown', squadBig: 'crown',
    splashAdd: 'star', stunAdd: 'star', slowOnHit: 'star', fearStart: 'star', hillAtk: 'tower', towerX2: 'tower', capAdd: 'soldier2', perItem: 'bag', perItemMax: 'bag', itemPct: 'bag', longhuyetX2: 'diamond', roleOnly: 'soldier2' };
  I.coreIcon = function (id, size) {
    var c = TT.CORES[id]; if (!c) return '';
    var sc = c.scope, name = sc.indexOf('role:') === 0 ? I.ROLE_ICON[sc.slice(5)] : sc === 'cls:can' ? 'sword2' : sc === 'cls:xa' ? 'archer' : sc === 'cls:trung' ? 'healer' : sc.indexOf('race:') === 0 ? 'beast' : null;
    if (name) return '<span class="core-ic t' + c.tier + '">' + I.svg(name, '#fff', size || 22) + '</span>';
    // Lõi toàn quân / kinh tế: biểu tượng theo chỉ số chính → nhìn icon là biết Lõi cộng gì
    var fx = Object.keys(c.fx || {})[0] || '', ic = CORE_FX[fx] || 'star';
    return '<span class="core-ic t' + c.tier + '">' + I.ui(ic, Math.round((size || 22) * .82), '#fff') + '</span>';
  };
  I.svg = function (name, color, size) {
    var body = P[name] || P.soldier;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="' + (size || 64) + '" height="' + (size || 64) + '" style="color:' + (color || '#fff') + '">' + body + '</svg>';
  };
  I.unitKey = function (t, job) { return t === 'worker' ? 'worker' + (job || 'V') : t; };

  /* ảnh để vẽ lên canvas — cache theo màu */
  var cache = {};
  I.img = function (name, color) {
    var k = name + '|' + color;
    if (cache[k]) return cache[k];
    var im = new Image();
    var s = I.svg(name, color, 128).replace('style="color:' + color + '"', '').replace(/currentColor/g, color);
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    cache[k] = im;
    return im;
  };

  /* biểu tượng tộc trong huy hiệu (không dùng chữ) — khung 64x64 */
  var EMBLEM = {
    dragon: '<path d="M10 40c4-16 16-26 30-26 6 0 10 2 14 6l-6 2 4 6-8-1c2 4 2 10-2 14-4 5-12 6-18 3l-8 8-2-8-6 2Z" fill="#fff" stroke="#7a1a10" stroke-width="2.5" stroke-linejoin="round"/><circle cx="40" cy="26" r="3" fill="#7a1a10"/><path d="M26 16 22 6l10 8M36 14l2-10 6 10" fill="#fff" stroke="#7a1a10" stroke-width="2.5" stroke-linejoin="round"/>',
    human: '<path d="M32 6 52 14v16c0 14-9 22-20 28C21 52 12 44 12 30V14Z" fill="#fff" stroke="#1d4f9a" stroke-width="2.5"/><path d="M32 16v30M22 26h20" stroke="#1d4f9a" stroke-width="5" stroke-linecap="round"/><path d="M26 40h12" stroke="#1d4f9a" stroke-width="4" stroke-linecap="round"/>',
    fairy: '<path d="M32 30C22 12 8 12 8 24c0 10 12 14 24 8M32 30c10-18 24-18 24-6 0 10-12 14-24 8M32 34c-8 4-16 12-12 20 4 6 10-4 12-16M32 34c8 4 16 12 12 20-4 6-10-4-12-16" fill="#fff" stroke="#0e7a6a" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 22v30" stroke="#0e7a6a" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="18" r="4" fill="#fff" stroke="#0e7a6a" stroke-width="2.5"/>',
    demon: '<path d="M12 8c2 12 8 16 14 18h12c6-2 12-6 14-18 4 10 4 22-6 28v10c0 6-6 10-14 10s-14-4-14-10V36C8 30 8 18 12 8Z" fill="#fff" stroke="#4a1a80" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 36l6 3M42 36l-6 3" stroke="#4a1a80" stroke-width="4" stroke-linecap="round"/><path d="M26 48h12" stroke="#4a1a80" stroke-width="3" stroke-linecap="round"/>'
  };
  /* huy hiệu tộc — vẽ bằng SVG */
  I.crest = function (fid, size) {
    var f = TT.FACTIONS[fid]; size = size || 96;
    var id = 'g' + fid + Math.random().toString(36).slice(2, 6);
    var deco = {
      dragon: '<path d="M50 12 Q78 20 82 48 Q70 36 62 40 Q74 58 58 80 Q60 60 50 56 Q40 60 42 80 Q26 58 38 40 Q30 36 18 48 Q22 20 50 12 Z" fill="url(#' + id + ')" opacity=".9"/>',
      human: '<path d="M50 14 L80 24 L76 54 Q70 76 50 86 Q30 76 24 54 L20 24 Z" fill="url(#' + id + ')" opacity=".9"/><path d="M50 22 L50 78 M30 40 L70 40" stroke="rgba(255,255,255,.55)" stroke-width="3"/>',
      fairy: '<path d="M50 50 Q20 10 14 40 Q20 58 50 50 Q80 58 86 40 Q80 10 50 50 Z" fill="url(#' + id + ')" opacity=".9"/><path d="M50 50 Q30 86 22 70 Q30 56 50 50 Q70 56 78 70 Q70 86 50 50 Z" fill="url(#' + id + ')" opacity=".7"/>',
      demon: '<path d="M22 14 Q30 36 40 38 L60 38 Q70 36 78 14 Q84 40 70 54 Q66 80 50 86 Q34 80 30 54 Q16 40 22 14 Z" fill="url(#' + id + ')" opacity=".9"/>'
    }[fid];
    return '<svg class="crest" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + size + '" height="' + size + '">' +
      '<defs><radialGradient id="' + id + '" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="' + f.color2 + '"/><stop offset="100%" stop-color="' + f.color + '"/></radialGradient></defs>' +
      '<defs><radialGradient id="bg' + id + '" cx="50%" cy="35%" r="65%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#cfe4ff"/></radialGradient></defs>' +
      '<circle cx="50" cy="50" r="47" fill="url(#bg' + id + ')" stroke="#ffc23a" stroke-width="4"/>' +
      '<circle cx="50" cy="50" r="42" fill="none" stroke="' + f.color + '" stroke-width="2" stroke-dasharray="4 4" opacity=".7"/>' +
      deco +
      '<g transform="translate(26 26) scale(.75)">' + EMBLEM[fid] + '</g>' +
      '</svg>';
  };


  /* biểu tượng kỹ năng (vẽ trên thẻ) */
  I.SKILL = {
    longluc: '<path d="M32 4 C40 18 52 22 48 40 C46 52 38 60 32 60 C22 60 14 52 16 40 C18 30 26 28 26 18 C30 22 31 26 32 30 C36 22 34 12 32 4Z" fill="#ffb347"/><path d="M32 30 C38 38 42 44 40 50 C38 56 34 58 32 58 C26 58 22 52 24 46 C26 40 30 38 32 30Z" fill="#fff1a8"/>',
    longuy: '<path d="M14 8 L30 56 M28 6 L42 54 M42 8 L54 50" stroke="#ff5a4a" stroke-width="7" stroke-linecap="round"/><path d="M14 8 L30 56 M28 6 L42 54 M42 8 L54 50" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
    longhong: '<circle cx="18" cy="32" r="8" fill="#ff9a6a"/><path d="M28 18 Q38 32 28 46" stroke="#ff9a6a" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M36 12 Q50 32 36 52" stroke="#ffc09a" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M44 6 Q62 32 44 58" stroke="#ffe0c8" stroke-width="5" fill="none" stroke-linecap="round"/>',
    taitro: '<ellipse cx="32" cy="46" rx="18" ry="7" fill="#d79a20"/><ellipse cx="32" cy="42" rx="18" ry="7" fill="#ffd34d"/><ellipse cx="32" cy="32" rx="18" ry="7" fill="#d79a20"/><ellipse cx="32" cy="28" rx="18" ry="7" fill="#ffe27a"/><ellipse cx="32" cy="18" rx="14" ry="6" fill="#d79a20"/><ellipse cx="32" cy="15" rx="14" ry="6" fill="#fff0a8"/>',
    hoilo: '<path d="M8 36 L22 24 L34 30 L46 22 L58 34 L44 46 L30 44 Z" fill="#ffd9b8" stroke="#8a5a3a" stroke-width="2.5"/><circle cx="46" cy="14" r="9" fill="#ffd34d" stroke="#b07a10" stroke-width="2"/><text x="46" y="18" font-size="11" text-anchor="middle" fill="#8a5a00" font-weight="bold">$</text>',
    thuthue: '<path d="M18 22 Q32 8 46 22 L50 52 Q32 60 14 52 Z" fill="#c9965a" stroke="#7a5228" stroke-width="2.5"/><path d="M22 22 Q32 28 42 22" stroke="#7a5228" stroke-width="3" fill="none"/><circle cx="32" cy="40" r="8" fill="#ffd34d" stroke="#b07a10" stroke-width="2"/>',
    linhnhan: '<path d="M4 32 Q32 6 60 32 Q32 58 4 32Z" fill="#e8fbff" stroke="#3cc8ea" stroke-width="3"/><circle cx="32" cy="32" r="12" fill="#3cc8ea"/><circle cx="32" cy="32" r="5" fill="#0b4a6a"/><circle cx="36" cy="28" r="3" fill="#fff"/>',
    hoanvi: '<path d="M12 22 H44 L36 12" stroke="#2ee6d6" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M52 42 H20 L28 52" stroke="#7fb8ff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    thienmac: '<path d="M8 50 Q8 14 32 12 Q56 14 56 50 Z" fill="rgba(140,240,255,.5)" stroke="#3cc8ea" stroke-width="3"/><path d="M18 30 Q22 22 30 20" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="4" y="48" width="56" height="6" rx="3" fill="#3cc8ea"/>',
    loinguyen: '<path d="M32 6 C46 6 54 16 54 28 C54 36 50 40 46 42 L46 52 L18 52 L18 42 C14 40 10 36 10 28 C10 16 18 6 32 6Z" fill="#c9b2ff" stroke="#5a2aa0" stroke-width="2.5"/><circle cx="23" cy="28" r="6" fill="#3a1670"/><circle cx="41" cy="28" r="6" fill="#3a1670"/><path d="M26 44 V52 M32 44 V52 M38 44 V52" stroke="#5a2aa0" stroke-width="2.5"/>',
    huyette: '<path d="M32 4 C40 20 50 30 50 42 C50 52 42 60 32 60 C22 60 14 52 14 42 C14 30 24 20 32 4Z" fill="#ff3a55" stroke="#9a0f25" stroke-width="2.5"/><path d="M24 40 Q24 30 30 26" stroke="#ffd0d6" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    haphon: '<path d="M32 32 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a12 12 0 1 1 -12 -12 a16 16 0 1 1 16 16 a20 20 0 1 1 -20 -20" stroke="#b67bff" stroke-width="4.5" fill="none" stroke-linecap="round"/>',
    oanhon: '<path d="M32 6 Q50 24 44 42 Q40 56 32 58 Q24 56 20 42 Q14 24 32 6 Z" fill="#c9b2ff"/><circle cx="27" cy="36" r="3.5" fill="#2a1240"/><circle cx="37" cy="36" r="3.5" fill="#2a1240"/>',
    taisinh: '<path d="M32 58 V20" stroke="#5fd46a" stroke-width="5"/><path d="M32 30 Q16 26 14 12 Q30 12 32 26 Q34 12 50 12 Q48 26 32 30Z" fill="#7fe07a"/><circle cx="32" cy="10" r="6" fill="#fff6a8"/>',
    chotroi: '<path d="M8 26 H56 L50 14 H14 Z" fill="#ff8a5a"/><path d="M8 26 H56" stroke="#c0563c" stroke-width="3"/><rect x="12" y="28" width="40" height="26" rx="3" fill="#ffe3b0"/><circle cx="24" cy="42" r="6" fill="#ffd34d"/><path d="M36 38 H46 M36 46 H46" stroke="#8a5a3a" stroke-width="3"/>',
    doatsinh: '<path d="M32 8 L38 26 L56 26 L42 38 L48 56 L32 44 L16 56 L22 38 L8 26 L26 26 Z" fill="#b67bff" stroke="#fff" stroke-width="2"/>'
  };
  I.skillSvg = function (id, size) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="' + (size || 48) + '" height="' + (size || 48) + '">' + (I.SKILL[id] || I.SKILL.doatsinh) + '</svg>'; };

  /* ảnh đại diện: biểu tượng quân trên nền màu */
  I.AVATARS = [['king', '#f5b942'], ['beast', '#e0483a'], ['mage', '#9b5cf6'], ['archer', '#22c3a6'], ['soldier', '#3b82f6'], ['cavalry', '#f07a2a'], ['assassin', '#4b4f7a'], ['shield', '#2f9e6a'], ['elephant', '#c06bd6'], ['commander', '#e0414e'], ['chariot', '#d39a1a'], ['siege', '#6b8fbf']];
  I.avatar = function (i) { var a = I.AVATARS[(i || 0) % I.AVATARS.length]; return '<span class="av-ic" style="background:' + a[1] + '">' + I.svg(a[0], '#fff', 64) + '</span>'; };

  /* biểu tượng giao diện (thay emoji / ký hiệu) */
  var UI = {
    menu: '<path d="M10 18h44M10 32h44M10 46h44" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    undo: '<path d="M22 14 8 28l14 14" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 28h26a16 16 0 0 1 0 32H26" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    close: '<path d="M16 16 48 48M48 16 16 48" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    down: '<path d="M14 24 32 42 50 24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    trash: '<path d="M14 18h36M26 18v-6h12v6M18 18l3 36h22l3-36" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 28v18M37 28v18" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    up: '<path d="M14 40 32 22 50 40" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    back: '<path d="M38 12 18 32l20 20" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    rotl: '<path d="M50 34a18 18 0 1 1-6-14" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M46 8v14H32" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    rotr: '<path d="M14 34a18 18 0 1 0 6-14" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M18 8v14h14" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    home: '<path d="M10 32 32 12l22 20M18 26v24h28V26" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    top: '<rect x="12" y="12" width="40" height="40" rx="6" fill="none" stroke="currentColor" stroke-width="6"/><path d="M12 32h40M32 12v40" stroke="currentColor" stroke-width="4"/>',
    swords: '<path d="M12 12 44 44M52 12 20 44" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M14 50l8-8M50 50l-8-8" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
    chat: '<path d="M8 12h48v30H26l-12 10V42H8Z" fill="currentColor"/><circle cx="22" cy="27" r="3" fill="rgba(0,0,0,.3)"/><circle cx="32" cy="27" r="3" fill="rgba(0,0,0,.3)"/><circle cx="42" cy="27" r="3" fill="rgba(0,0,0,.3)"/>',
    soldier2: '<circle cx="32" cy="16" r="9" fill="currentColor"/><path d="M18 58V36a14 12 0 0 1 28 0v22Z" fill="currentColor"/>',
    move: '<path d="M32 4l9 10h-6v12h12v-6l10 9-10 9v-6H35v12h6l-9 10-9-10h6V38H17v6L7 35l10-9v6h12V14h-6Z" fill="currentColor"/>',
    bag: '<path d="M14 22h36l4 34H10Z" fill="currentColor"/><path d="M22 24v-6a10 10 0 0 1 20 0v6" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="38" r="6" fill="rgba(0,0,0,.25)"/>',
    map: '<path d="M6 14l16-6 20 6 16-6v42l-16 6-20-6-16 6Z" fill="currentColor"/><path d="M22 8v42M42 14v42" stroke="rgba(0,0,0,.3)" stroke-width="3"/>',
    crown: '<path d="M8 46 12 18l12 14 8-18 8 18 12-14 4 28Z" fill="currentColor"/><rect x="8" y="48" width="48" height="7" rx="2" fill="currentColor"/>',
    skull: '<path d="M32 8c13 0 22 9 22 21 0 7-4 12-8 14v8H18v-8c-4-2-8-7-8-14C10 17 19 8 32 8Z" fill="currentColor"/><circle cx="23" cy="30" r="6" fill="#fff"/><circle cx="41" cy="30" r="6" fill="#fff"/>',
    trophy: '<path d="M18 8h28v14a14 14 0 0 1-28 0Z" fill="currentColor"/><path d="M18 14H8c0 10 6 14 12 14M46 14h10c0 10-6 14-12 14" fill="none" stroke="currentColor" stroke-width="5"/><rect x="28" y="36" width="8" height="10" fill="currentColor"/><rect x="18" y="46" width="28" height="8" rx="3" fill="currentColor"/>',
    warn: '<path d="M32 6 60 56H4Z" fill="currentColor"/><path d="M32 24v14" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="47" r="3.5" fill="#fff"/>',
    worker: '<circle cx="32" cy="20" r="11" fill="currentColor"/><path d="M12 56c0-14 9-22 20-22s20 8 20 22Z" fill="currentColor"/><path d="M18 18h28" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    cart: '<path d="M6 12h9l7 30h28l6-22H18" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="52" r="5" fill="currentColor"/><circle cx="46" cy="52" r="5" fill="currentColor"/>',
    star: '<path d="M32 4 39 25 60 32 39 39 32 60 25 39 4 32 25 25Z" fill="currentColor"/>',
    diamond: '<path d="M32 6 56 32 32 58 8 32Z" fill="currentColor"/>',
    sound: '<path d="M8 24h12l14-12v40L20 40H8Z" fill="currentColor"/><path d="M42 22a14 14 0 0 1 0 20M48 14a24 24 0 0 1 0 36" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    mute: '<path d="M8 24h12l14-12v40L20 40H8Z" fill="currentColor"/><path d="M42 24l16 16M58 24 42 40" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    dice: '<rect x="8" y="8" width="48" height="48" rx="10" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="22" cy="22" r="5" fill="currentColor"/><circle cx="42" cy="42" r="5" fill="currentColor"/><circle cx="32" cy="32" r="5" fill="currentColor"/>',
    play: '<path d="M18 10 54 32 18 54Z" fill="currentColor"/>',
    arrowup: '<path d="M32 8 54 34H40v22H24V34H10Z" fill="currentColor"/>',
    leaf: '<path d="M54 10C24 10 10 26 10 44c0 4 1 7 2 10 4-14 14-24 28-28-12 8-20 18-22 30 30 2 40-24 36-46Z" fill="currentColor"/>',
    lock: '<rect x="12" y="28" width="40" height="30" rx="6" fill="currentColor"/><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="currentColor" stroke-width="6"/>',
    flag: '<path d="M14 6v52" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M16 8h34l-8 12 8 12H16Z" fill="currentColor"/>',
    plus: '<path d="M32 12v40M12 32h40" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    minus: '<path d="M12 32h40" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    check: '<path d="M10 34 26 50 54 16" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
    ff: '<path d="M8 12 30 32 8 52Z M32 12 54 32 32 52Z" fill="currentColor"/>',
    skip: '<path d="M10 12 36 32 10 52Z" fill="currentColor"/><rect x="40" y="12" width="9" height="40" rx="2" fill="currentColor"/>',
    pause: '<rect x="14" y="10" width="12" height="44" rx="3" fill="currentColor"/><rect x="38" y="10" width="12" height="44" rx="3" fill="currentColor"/>',
    coin: '<circle cx="32" cy="32" r="22" fill="currentColor"/><path d="M32 18v28M24 24h12a6 6 0 0 1 0 12H28a6 6 0 0 0 0 12h12" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="4"/>',
    split: '<circle cx="18" cy="46" r="8" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="46" cy="46" r="8" fill="none" stroke="currentColor" stroke-width="5"/><path d="M22 40 44 8M42 40 20 8" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    wand: '<path d="M10 54 40 24" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M46 6 48 14 56 16 48 18 46 26 44 18 36 16 44 14Z" fill="currentColor"/><circle cx="54" cy="34" r="3" fill="currentColor"/><circle cx="30" cy="8" r="3" fill="currentColor"/>',
    eye: '<path d="M4 32 Q32 6 60 32 Q32 58 4 32Z" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="32" cy="32" r="9" fill="currentColor"/>',
    sun: '<circle cx="32" cy="32" r="12" fill="currentColor"/><path d="M32 4v10M32 50v10M4 32h10M50 32h10M12 12l7 7M45 45l7 7M12 52l7-7M45 19l7-7" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    moon: '<path d="M40 6A26 26 0 1 0 58 40 20 20 0 1 1 40 6Z" fill="currentColor"/>',
    rain: '<path d="M16 34a12 12 0 0 1 4-23 16 16 0 0 1 30 4 10 10 0 0 1-2 19Z" fill="currentColor"/><path d="M20 42l-4 10M32 42l-4 10M44 42l-4 10" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
    wind: '<path d="M6 24h34a8 8 0 1 0-8-8M6 36h44a8 8 0 1 1-8 8M6 48h20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    tower: '<path d="M18 58V22h28v36Z" fill="currentColor"/><path d="M14 22 32 6 50 22Z" fill="currentColor"/><path d="M32 6V0" stroke="currentColor" stroke-width="3"/>',
    heart: '<path d="M32 56C10 40 6 28 10 18c4-10 18-10 22 0 4-10 18-10 22 0 4 10 0 22-22 38Z" fill="currentColor"/>',
    target: '<circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="32" cy="32" r="4" fill="currentColor"/>',
    shield: '<path d="M32 6 54 14 52 34Q48 50 32 58 16 50 12 34L10 14Z" fill="currentColor"/>',
    bolt: '<path d="M36 4 12 36h18l-4 24 26-34H34Z" fill="currentColor"/>',
    info: '<circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="32" cy="18" r="4" fill="currentColor"/><path d="M32 28v20" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    sleep: '<path d="M12 14h18L12 34h18M36 30h14L36 46h14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  I.ui = function (name, size, color) {
    return '<svg class="ui-ic" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="' + (size || 16) + '" height="' + (size || 16) + '"' + (color ? ' style="color:' + color + '"' : '') + ' aria-hidden="true">' + (UI[name] || '') + '</svg>';
  };
})(window);
