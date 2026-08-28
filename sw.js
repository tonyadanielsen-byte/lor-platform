const CACHE_NAME = 'lor-shell-v3.8.13';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/lor-icon-192.png',
  './icons/lor-icon-512.png'
];
const LOR_SCOPE = self.registration.scope;

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request, fallbackKey = null) {
  return fetch(request, { cache: 'no-store' })
    .then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    })
    .catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (fallbackKey) return caches.match(fallbackKey);
      throw new Error('Offline and no cached response');
    });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }

  const freshAsset = /\.(?:js|mjs|css|json|webmanifest)$/i.test(url.pathname);
  if (freshAsset) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const raw = event.notification?.data?.link || LOR_SCOPE;
  let target;
  try { target = new URL(raw, LOR_SCOPE).href; } catch { target = LOR_SCOPE; }
  if (!target.startsWith(LOR_SCOPE)) target = LOR_SCOPE;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    const existing = clients.find(client => client.url.startsWith(LOR_SCOPE));
    if (existing) {
      try { await existing.navigate(target); } catch (_) {}
      return existing.focus();
    }
    return self.clients.openWindow(target);
  })());
});

try {
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey:'AIzaSyDT6bW6kErdyhVK3WTMDEERsCLRTdjnoTg',
    authDomain:'opex-nortura.firebaseapp.com',
    databaseURL:'https://opex-nortura-default-rtdb.europe-west1.firebasedatabase.app',
    projectId:'opex-nortura',
    storageBucket:'opex-nortura.firebasestorage.app',
    messagingSenderId:'72695195747',
    appId:'1:72695195747:web:cb8ca9c1970b4fc3c9b056'
  });
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(payload => {
    if (payload?.notification?.title || payload?.notification?.body) return;
    const data = payload?.data || {};
    const title = data.title || 'OpEx · LOR';
    const body = data.body || 'Du har et nytt LOR-varsel.';
    const link = data.link || LOR_SCOPE;
    return self.registration.showNotification(title, {
      body,
      icon:'./icons/lor-icon-192.png',
      badge:'./icons/lor-icon-192.png',
      tag:data.tag || 'lor-notification',
      renotify:false,
      data:{ link, planId:data.planId || '', eventType:data.eventType || '' }
    });
  });
} catch (error) {
  console.error('[LOR Push] Firebase Messaging kunne ikke initialiseres', error);
}
