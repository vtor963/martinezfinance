// Aplica o pacote instalável (PWA/iOS home-screen) sobre o dist-web.
// Uso: node scripts/pwa-patch.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist-web');
const src = path.join(root, 'assets', 'pwa');

const files = ['manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'sw.js'];
for (const f of files) {
  fs.copyFileSync(path.join(src, f), path.join(dist, f));
}

const htmlPath = path.join(dist, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('manifest.json')) {
  const tags = [
    '<link rel="manifest" href="/manifest.json">',
    '<meta name="theme-color" content="#080808">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="Martinez Finance">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  ].join('\n    ');
  html = html.replace('</head>', `    ${tags}\n  </head>`);
  fs.writeFileSync(htmlPath, html);
  console.log('index.html patched (PWA tags).');
} else {
  console.log('index.html already patched.');
}
if (!html.includes('serviceWorker.register')) {
  html = html.replace(
    '</body>',
    `  <script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js');});}</script>\n</body>`
  );
  fs.writeFileSync(htmlPath, html);
  console.log('index.html patched (service worker).');
} else {
  console.log('service worker already registered.');
}
console.log('PWA files copied to dist-web.');
