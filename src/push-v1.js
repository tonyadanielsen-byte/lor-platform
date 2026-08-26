const VAPID_KEY = 'BGZHOWnnMHSGeBnC3pETHWRAu84UFL7yBZBq74Uxoc2xAfBPySP3XuTolheQHJqG_CxgZYNX6-hSZuA5XHDqJXc';
const MESSAGING_SDK = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js';
const TOKEN_KEY = 'lor_fcm_token_v1';
const BUILD = '3.7.6';

let messaging = null;
let swRegistration = null;
let currentUser = null;
let inboxRef = null;
let inboxHandler = null;
let items = [];

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));

function toast(message, error = false) {
  const el = document.querySelector('#toast');
  if (!el) return console[error ? 'error' : 'log']('[LOR Push]', message);
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3500);
}

function loadMessagingSdk() {
  if (window.firebase?.messaging) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(s => s.src === MESSAGING_SDK);
    if (existing) {
      existing.addEventListener('load', resolve, { once:true });
      existing.addEventListener('error', reject, { once:true });
      return;
    }
    const script = document.createElement('script');
    script.src = MESSAGING_SDK;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Kunne ikke laste Firebase Messaging'));
    document.head.appendChild(script);
  });
}

async function registerWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker støttes ikke');
  if (swRegistration) return swRegistration;
  swRegistration = await navigator.serviceWorker.register(`./sw.js?v=376`, { scope:'./' });
  await swRegistration.update().catch(() => {});
  return swRegistration;
}

async function tokenId(token) {
  if (window.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
  }
  return btoa(token).replace(/[.#$\[\]/]/g,'_').slice(0,120);
}

async function saveToken(token) {
  const user = window.firebase?.auth?.().currentUser;
  if (!user) throw new Error('Ingen innlogget bruker');
  const id = await tokenId(token);
  await window.firebase.database().ref(`lor/pushTokens/${user.uid}/${id}`).set({
    token,
    uid:user.uid,
    email:user.email || '',
    app:'lor',
    appVersion:BUILD,
    permission:Notification.permission,
    platform:navigator.userAgentData?.platform || navigator.platform || '',
    userAgent:navigator.userAgent,
    updatedAt:Date.now()
  });
  localStorage.setItem(TOKEN_KEY, token);
}

async function initMessaging() {
  if (messaging) return messaging;
  if (!window.isSecureContext) throw new Error('Varsler krever HTTPS');
  if (!('Notification' in window)) throw new Error('Varsler støttes ikke i denne nettleseren');
  await loadMessagingSdk();
  messaging = window.firebase.messaging();
  messaging.onMessage(payload => {
    const title = payload?.notification?.title || payload?.data?.title || 'OpEx · LOR';
    const body = payload?.notification?.body || payload?.data?.body || 'Du har et nytt LOR-varsel.';
    toast(`${title}: ${body}`);
  });
  return messaging;
}

async function activatePush() {
  try {
    if (!currentUser) throw new Error('Logg inn først');
    if (!('Notification' in window)) throw new Error('Varsler støttes ikke på denne enheten');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      renderPanel();
      throw new Error(permission === 'denied' ? 'Varsler er blokkert i nettleseren' : 'Varsler ble ikke aktivert');
    }
    const registration = await registerWorker();
    const instance = await initMessaging();
    const token = await instance.getToken({ vapidKey:VAPID_KEY, serviceWorkerRegistration:registration });
    if (!token) throw new Error('Firebase returnerte ikke et push-token');
    await saveToken(token);
    renderPanel();
    toast('LOR-varsler er aktivert på denne enheten 🔔');
  } catch (error) {
    console.error('[LOR Push] Activation failed', error);
    toast(error?.message || 'Kunne ikke aktivere varsler', true);
  }
}

async function syncPushSilently() {
  if (!currentUser || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const registration = await registerWorker();
    const instance = await initMessaging();
    const token = await instance.getToken({ vapidKey:VAPID_KEY, serviceWorkerRegistration:registration });
    if (token) await saveToken(token);
  } catch (error) {
    console.warn('[LOR Push] Silent token sync failed', error);
  }
}

function unreadCount() { return items.filter(item => !item.seenAt).length; }

function fmtTime(value) {
  const time = Number(value);
  if (!time) return '';
  const date = new Date(time);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit'})
    : date.toLocaleDateString('nb-NO',{day:'2-digit',month:'2-digit'});
}

function ensureUi() {
  const menu = document.querySelector('.user-menu');
  if (!menu || menu.querySelector('#lorNotifyWrap')) return;
  const wrap = document.createElement('div');
  wrap.id = 'lorNotifyWrap';
  wrap.className = 'lor-notify-wrap';
  wrap.innerHTML = `
    <button id="lorNotifyButton" class="lor-notify-button" type="button" aria-label="Varsler" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
      <span id="lorNotifyBadge" class="lor-notify-badge" hidden>0</span>
    </button>
    <section id="lorNotifyPanel" class="lor-notify-panel" hidden></section>`;
  menu.insertBefore(wrap, menu.firstChild);
  wrap.querySelector('#lorNotifyButton').addEventListener('click', event => {
    event.stopPropagation();
    const panel = wrap.querySelector('#lorNotifyPanel');
    const open = panel.hidden;
    panel.hidden = !open;
    wrap.querySelector('#lorNotifyButton').setAttribute('aria-expanded',String(open));
    if (open) renderPanel();
  });
  renderBadge();
  renderPanel();
}

function renderBadge() {
  ensureUi();
  const badge = document.querySelector('#lorNotifyBadge');
  if (!badge) return;
  const count = unreadCount();
  badge.hidden = count === 0;
  badge.textContent = count > 99 ? '99+' : String(count);
}

function renderPanel() {
  ensureUi();
  const panel = document.querySelector('#lorNotifyPanel');
  if (!panel) return;
  const supported = 'Notification' in window && 'serviceWorker' in navigator;
  const permission = supported ? Notification.permission : 'unsupported';
  const enabled = permission === 'granted' && !!localStorage.getItem(TOKEN_KEY);
  const status = !supported ? 'Ikke støttet på denne enheten' : permission === 'denied' ? 'Blokkert i nettleseren' : enabled ? 'Push er aktivert' : 'Push er ikke aktivert';
  panel.innerHTML = `
    <div class="lor-notify-head">
      <div><span>VARSLER</span><strong>OpEx · LOR</strong></div>
      ${unreadCount() ? '<button type="button" data-lor-mark-all>Marker alle lest</button>' : ''}
    </div>
    <div class="lor-notify-status ${enabled?'active':''}">
      <div><b>${enabled?'🔔':'🔕'} ${esc(status)}</b><small>Aktiver per PC, mobil eller installert app.</small></div>
      ${permission !== 'denied' && supported ? `<button type="button" data-lor-enable-push>${enabled?'Synkroniser':'Aktiver'}</button>` : ''}
    </div>
    <div class="lor-notify-list">
      ${items.length ? items.slice(0,20).map(item => `
        <button type="button" class="lor-notify-item ${item.seenAt?'':'unread'}" data-lor-notification="${esc(item.id)}" data-link="${esc(item.link||'')}">
          <span class="lor-notify-dot"></span>
          <div><strong>${esc(item.title||'LOR-varsel')}</strong><p>${esc(item.body||'')}</p><small>${fmtTime(item.createdAt)}</small></div>
        </button>`).join('') : '<div class="lor-notify-empty">Ingen varsler ennå.</div>'}
    </div>`;
}

async function markSeen(id) {
  if (!currentUser || !id) return;
  await window.firebase.database().ref(`lor/notificationInbox/${currentUser.uid}/${id}/seenAt`).set(Date.now());
}

async function markAllSeen() {
  if (!currentUser) return;
  const updates = {};
  items.filter(item => !item.seenAt).forEach(item => { updates[`${item.id}/seenAt`] = Date.now(); });
  if (Object.keys(updates).length) await window.firebase.database().ref(`lor/notificationInbox/${currentUser.uid}`).update(updates);
}

function bindInbox(user) {
  if (inboxRef && inboxHandler) inboxRef.off('value', inboxHandler);
  inboxRef = null;
  inboxHandler = null;
  items = [];
  if (!user) { renderBadge(); renderPanel(); return; }
  inboxRef = window.firebase.database().ref(`lor/notificationInbox/${user.uid}`).limitToLast(30);
  inboxHandler = snap => {
    const next = [];
    snap.forEach(child => next.push({ id:child.key, ...(child.val()||{}) }));
    items = next.sort((a,b) => Number(b.createdAt||0)-Number(a.createdAt||0));
    renderBadge();
    renderPanel();
  };
  inboxRef.on('value', inboxHandler);
}

document.addEventListener('click', async event => {
  const wrap = document.querySelector('#lorNotifyWrap');
  if (wrap && !wrap.contains(event.target)) {
    const panel = document.querySelector('#lorNotifyPanel');
    const button = document.querySelector('#lorNotifyButton');
    if (panel) panel.hidden = true;
    if (button) button.setAttribute('aria-expanded','false');
  }
  if (event.target.closest('[data-lor-enable-push]')) {
    event.preventDefault();
    await activatePush();
    return;
  }
  if (event.target.closest('[data-lor-mark-all]')) {
    event.preventDefault();
    await markAllSeen();
    return;
  }
  const item = event.target.closest('[data-lor-notification]');
  if (item) {
    event.preventDefault();
    await markSeen(item.dataset.lorNotification).catch(() => {});
    const link = item.dataset.link;
    if (link) location.href = link;
  }
});

const app = document.querySelector('#app');
if (app) new MutationObserver(() => setTimeout(ensureUi,0)).observe(app,{childList:true,subtree:false});

window.firebase.auth().onAuthStateChanged(user => {
  currentUser = user || null;
  bindInbox(currentUser);
  setTimeout(ensureUi,0);
  if (user) syncPushSilently();
});

registerWorker().catch(error => console.warn('[LOR Push] Worker registration deferred', error));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUi, {once:true});
else ensureUi();

window.__lorPush = { activate:activatePush, sync:syncPushSilently };
