const LOR_SCOPE = self.registration.scope;

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
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
      icon:'./lor-icon.svg?v=3.7.7',
      badge:'./lor-icon.svg?v=3.7.7',
      tag:data.tag || 'lor-notification',
      renotify:false,
      data:{ link, planId:data.planId || '', eventType:data.eventType || '' }
    });
  });
} catch (error) {
  console.error('[LOR Push] Firebase Messaging kunne ikke initialiseres', error);
}
