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
    hourglass: '<path d="M16 6 H48 M16 58 H48 M20 6 Q20 26 32 32 Q20 38 20 58 M44 6 Q44 26 32 32 Q44 38 44 58" fill="none" stroke="currentColor" stroke-width="4"/><path d="M24 50 Q32 42 40 50 Z" fill="currentColor"/>'
  };
  I.paths = P;
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
      '<circle cx="50" cy="50" r="47" fill="#0b0f17" stroke="#c8aa6e" stroke-width="2.5"/>' +
      '<circle cx="50" cy="50" r="41" fill="none" stroke="' + f.color + '" stroke-width="1.5" stroke-dasharray="3 4" opacity=".8"/>' +
      deco +
      '<text x="50" y="62" text-anchor="middle" font-size="30" font-family="serif" fill="#fff" stroke="#000" stroke-width="1" style="paint-order:stroke">' + f.glyph + '</text>' +
      '</svg>';
  };

  I.AVATARS = ['🐉', '🦁', '🦊', '🐺', '🦅', '🐍', '🦄', '👹', '🧙', '🗡️', '🏹', '👑'];
})(window);
