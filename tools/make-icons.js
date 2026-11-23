const { chromium } = require('playwright');
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#062744"/><stop offset=".6" stop-color="#0a4c7d"/><stop offset="1" stop-color="#0e6ea3"/></linearGradient></defs>
<rect width="512" height="512" rx="${pad?0:96}" fill="url(#g)"/>
<g transform="translate(256 262) scale(${pad?0.78:1}) translate(-256 -262)">
<path d="M96 170 h120 l28 30 h172 a20 20 0 0 1 20 20 v190 a20 20 0 0 1 -20 20 h-300 a20 20 0 0 1 -20 -20 v-220 a20 20 0 0 1 20 -20z" fill="#2fb3e0"/>
<path d="M76 236 h360 v174 a20 20 0 0 1 -20 20 h-320 a20 20 0 0 1 -20 -20z" fill="#7fd3f2"/>
<path d="M256 252 c0 0 -58 66 -58 104 a58 58 0 0 0 116 0 c0 -38 -58 -104 -58 -104z" fill="#fff"/>
<path d="M230 360 a28 28 0 0 0 26 26" stroke="#0a4c7d" stroke-width="10" fill="none" stroke-linecap="round"/>
</g></svg>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [name, size, pad] of [['icon-192',192,0],['icon-512',512,0],['icon-maskable-512',512,1],['apple-touch-icon',180,1],['favicon',64,0]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg(pad)}`);
    await p.screenshot({ path: `../icons/${name}.png`, omitBackground: !pad });
  }
  await b.close();
})();
