// Généré : liste des fichiers mis en cache pour le mode hors ligne
const VERSION = 'mofumusic-v2';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js',
  'js/audio.js',
  'js/exercise.js',
  'js/game.js',
  'js/music.js',
  'js/song.js',
  'js/ui.js',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/maskable-512.png',
  'assets/cats/music00_01.png',
  'assets/cats/music01_01.png',
  'assets/cats/music02_01.png',
  'assets/cats/music03_01.png',
  'assets/cats/music04_01.png',
  'assets/cats/music05_01.png',
  'assets/cats/music06_01.png',
  'assets/cats/music07_01.png',
  'assets/cats/music08_01.png',
  'assets/cats/music09_01.png',
  'assets/cats/music10_01.png',
  'assets/cats/music12_01.png',
  'assets/cats/music13_01.png',
  'assets/cats/sheet1_01.png',
  'assets/cats/sheet1_02.png',
  'assets/cats/sheet1_03.png',
  'assets/cats/sheet1_04.png',
  'assets/cats/sheet1_05.png',
  'assets/cats/sheet1_06.png',
  'assets/cats/sheet1_08.png',
  'assets/cats/sheet1_09.png',
  'assets/cats/sheet1_10a.png',
  'assets/cats/sheet1_10b.png',
  'assets/cats/sheet1_11.png',
  'assets/cats/sheet1_12.png',
  'assets/cats/sheet1_13.png',
  'assets/cats/sheet1_14.png',
  'assets/cats/sheet1_15.png',
  'assets/cats/sheet1_16.png',
  'assets/cats/sheet1_17.png',
  'assets/cats/sheet1_18.png',
  'assets/cats/sheet1_20.png',
  'assets/cats/sheet1_21.png',
  'assets/cats/sheet1_22a.png',
  'assets/cats/sheet1_22b.png',
  'assets/cats/sheet1_23.png',
  'assets/cats/sheet1_24.png',
  'assets/cats/sheet1_25a.png',
  'assets/cats/sheet1_25b.png',
  'assets/cats/sheet2_01.png',
  'assets/cats/sheet2_02.png',
  'assets/cats/sheet2_03.png',
  'assets/cats/sheet2_04.png',
  'assets/cats/sheet2_05.png',
  'assets/cats/sheet2_06.png',
  'assets/cats/sheet2_07.png',
  'assets/cats/sheet2_09.png',
  'assets/cats/sheet2_10.png',
  'assets/cats/sheet2_11.png',
  'assets/cats/sheet2_12.png',
  'assets/cats/sheet2_13.png',
  'assets/cats/sheet2_15.png',
  'assets/cats/sheet2_16.png',
  'assets/cats/sheet2_17.png',
  'assets/cats/sheet3_01.png',
  'assets/cats/sheet3_02.png',
  'assets/cats/sheet3_03.png',
  'assets/cats/sheet3_04.png',
  'assets/cats/sheet3_05.png',
  'assets/cats/sheet3_06.png',
  'assets/cats/sheet3_07.png',
  'assets/cats/sheet3_08.png',
  'assets/cats/sheet3_09.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord (pour recevoir les mises à jour), cache si hors ligne
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
