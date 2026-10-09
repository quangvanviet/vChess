# Gói Three.js dùng trong game

`js/vendor/three-bundle.min.js` = Three.js r158 + RGBELoader (HDRI) + RoundedBoxGeometry + pmndrs `postprocessing` 6.33.4 (Bloom, SMAA, Vignette, ToneMapping) + `n8ao` 1.8.4 (SSAO), gộp thành một file, gán vào `window.THREE`.

Dựng lại:

```bash
npm i three@0.158.0 postprocessing@6.33.4 n8ao@1.8.4 esbuild@0.19.12
npx esbuild tools/vendor/three-bundle-entry.js --bundle --minify --format=iife --target=es2018 --outfile=js/vendor/three-bundle.min.js
```

HDRI ánh sáng môi trường: `assets/hdri/quarry_01_1k.hdr` (Poly Haven, CC0).
