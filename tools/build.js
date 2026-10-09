#!/usr/bin/env node
/* Tứ Tộc Kỳ Chiến — BẢN PHÁT HÀNH (bảo vệ mã nguồn)
   Gộp toàn bộ mã game (js/core, js/net, js/ui) thành MỘT file → thu gọn (esbuild) → làm rối (javascript-obfuscator):
     - đổi tên biến/hàm thành mã hex, mã hoá chuỗi (base64 + xoay mảng chuỗi), làm phẳng luồng điều khiển nhẹ,
     - tự vệ (self-defending): file bị định dạng lại / sửa sẽ ngừng chạy,
     - KHOÁ TÊN MIỀN: chỉ chạy trên các miền bạn cho phép (sao chép sang web khác sẽ không chạy),
     - chặn nhúng trang vào iframe của web khác.
   Đầu ra: thư mục dist/ — đăng thư mục này lên hosting (KHÔNG đăng thư mục gốc).

   Dùng:
     npm i                              (một lần: cài esbuild + javascript-obfuscator)
     node tools/build.js --domain=tentoi.github.io,tentoi.web.app
     node tools/build.js --domain=... --light   (làm rối nhẹ hơn, chạy nhanh hơn trên máy yếu)
     node tools/build.js --domain=... --nolocal (không cho chạy cả trên localhost)

   Lưu ý: KHÔNG có cách nào giấu hoàn toàn mã chạy trên trình duyệt; bản dựng này làm việc đọc hiểu / sửa / sao chép
   tốn công hơn rất nhiều. Phần chống gian lận thật sự nằm ở kiểm tra gói đội hình (prep.js) + luật Firebase. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'dist');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.replace(/^--/, '').split('='); return [m[0], m[1] == null ? true : m[1]]; }));
const DOMAINS = String(args.domain || '').split(',').map(s => s.trim()).filter(Boolean);
const LIGHT = !!args.light;

let esbuild, Obf;
try { esbuild = require('esbuild'); Obf = require('javascript-obfuscator'); }
catch (e) { console.error('Thiếu thư viện. Chạy: npm i   (cài esbuild và javascript-obfuscator)'); process.exit(1); }
if (!DOMAINS.length) console.warn('[!] Chưa có --domain=... → bản dựng KHÔNG khoá tên miền (chỉ làm rối mã).');

/* 1. đọc index.html, tách script của game và script thư viện */
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const tags = [...html.matchAll(/<script src="([^"]+)"><\/script>\s*/g)];
const own = tags.filter(t => !/^js\/vendor\//.test(t[1]));
if (!own.length) { console.error('Không tìm thấy script game trong index.html'); process.exit(1); }

/* 2. lớp bảo vệ chạy trước mọi mã game: khoá miền + chặn iframe lạ */
const allow = DOMAINS.concat(args.nolocal ? [] : ['localhost', '127.0.0.1']);   // --nolocal: cấm cả chạy ở máy cục bộ
const guard = `(function(){var h=location.hostname,ok=${JSON.stringify(allow)}.some(function(d){return h===d||h.slice(-d.length-1)==='.'+d;});
if(location.protocol==='file:')ok=false;
${DOMAINS.length ? '' : 'ok=true;'}
if(!ok){document.documentElement.innerHTML='';throw new Error('x');}
try{if(window.top!==window.self){var tr=document.referrer?new URL(document.referrer).hostname:'';if(!${JSON.stringify(allow)}.some(function(d){return tr===d||tr.slice(-d.length-1)==='.'+d;}))window.top.location=window.self.location;}}catch(e){}
})();\n`;

/* 3. gộp + thu gọn */
let src = guard + own.map(t => {
  const f = path.join(ROOT, t[1]);
  return '/* ' + t[1] + ' */\n' + fs.readFileSync(f, 'utf8') + '\n;';
}).join('\n');
const min = esbuild.transformSync(src, { minify: true, target: 'es2018', legalComments: 'none' }).code;

/* 4. làm rối — cấu hình cân bằng giữa an toàn và tốc độ (mô phỏng chạy 20 tick/giây) */
const obf = Obf.obfuscate(min, {
  compact: true,
  target: 'browser',
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,            // TT, THREE, firebase là biến toàn cục dùng chung với thư viện
  transformObjectKeys: false,      // tên thuộc tính là dữ liệu mạng (gói đội hình) — phải giữ nguyên
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: LIGHT ? .5 : .8,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersType: 'function',
  splitStrings: false,
  controlFlowFlattening: !LIGHT,
  controlFlowFlatteningThreshold: .12,
  deadCodeInjection: false,
  numbersToExpressions: false,
  simplify: true,
  selfDefending: true,
  disableConsoleOutput: false,
  debugProtection: false,
  domainLock: DOMAINS.length ? allow : [],
  domainLockRedirectUrl: 'about:blank',
  sourceMap: false,
  seed: crypto.randomInt(1, 1e9)
}).getObfuscatedCode();

/* 5. ghi dist/ */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'js', 'vendor'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
const hash = crypto.createHash('sha1').update(obf).digest('hex').slice(0, 10);
const gameFile = 'js/g.' + hash + '.js';
fs.writeFileSync(path.join(OUT, gameFile), obf);

// HTML: thay các script game bằng một file duy nhất, đặt ở vị trí script game CUỐI CÙNG (sau mọi thư viện: Firebase, Three.js), bỏ chú thích
const lastOwn = own[own.length - 1][1];
html = html.replace(/<script src="([^"]+)"><\/script>\s*/g, (m, s) => {
  if (/^js\/vendor\//.test(s)) return m;
  return s === lastOwn ? '<script src="' + gameFile + '"></script>\n' : '';
});
html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
// CSS: gộp mọi file css/*.css trong index.html (theo thứ tự) → thu gọn → một file, đổi tên theo mã băm để trình duyệt không giữ bản cũ
const cssLinks = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"?]+)[^"]*">\s*/g)];
const cssSrc = cssLinks.map(m => fs.readFileSync(path.join(ROOT, m[1]), 'utf8')).join('\n');
const css = esbuild.transformSync(cssSrc, { loader: 'css', minify: true }).code;
const cssFile = 'css/s.' + crypto.createHash('sha1').update(css).digest('hex').slice(0, 10) + '.css';
fs.writeFileSync(path.join(OUT, cssFile), css);
let firstCss = true;
html = html.replace(/<link rel="stylesheet" href="css\/[^"]*">\s*/g, () => { if (!firstCss) return ''; firstCss = false; return '<link rel="stylesheet" href="' + cssFile + '">\n'; });
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// thư viện (đã thu gọn sẵn) + tài nguyên
const copy = (rel) => { const s = path.join(ROOT, rel), d = path.join(OUT, rel); if (!fs.existsSync(s)) return; fs.cpSync(s, d, { recursive: true }); };
tags.filter(t => /^js\/vendor\//.test(t[1])).forEach(t => copy(t[1]));
['assets', '.nojekyll', 'favicon.ico', 'favicon.svg'].forEach(copy);

const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
console.log('Đã dựng dist/');
console.log('  ' + gameFile + '  ' + kb(gameFile) + '  (gộp ' + own.length + ' file, làm rối' + (LIGHT ? ' nhẹ' : '') + ')');
console.log('  ' + cssFile + '  ' + kb(cssFile));
console.log('  khoá miền: ' + (DOMAINS.length ? DOMAINS.join(', ') + ' (+ localhost)' : 'KHÔNG'));
