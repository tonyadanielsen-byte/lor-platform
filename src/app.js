import { onAuth, signIn, signOut, sendPasswordReset } from './auth.js';
import { subscribePlannedRounds, subscribeRounds } from './store.js';
import { createRoundController } from './round-flow.js';

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');

const state = {
  activeView: 'dashboard',
  user: null,
  authReady: false,
  authError: '',
  plans: [],
  rounds: [],
  roundController: null,
  unsubscribers: [],
};

const views = [
  ['dashboard', 'Dashboard'],
  ['mine', 'Mine LOR'],
  ['round', 'Gjennomfør LOR'],
  ['themes', 'Temabank'],
  ['analytics', 'Analyse'],
];

function notify(message, error = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('error', error);
  toastEl.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toastEl.classList.remove('show'), 3600);
}

function displayName(name = '') {
  const first = String(name).trim().split(/\s+/)[0];
  return first || 'leder';
}

function navButtons() {
  return views.map(([id,label]) => `<button class="${state.activeView === id ? 'active' : ''}" data-view="${id}">${label}</button>`).join('');
}

function loginView() {
  return `<div class="login-screen"><div class="login-card"><div class="login-mark">LOR</div><h1>Logg inn</h1><p>Samme sikre bruker som i OpEx-master.</p>${state.authError ? `<div class="login-error">${state.authError}</div>` : ''}<form id="loginForm"><label>E-post<input id="loginEmail" type="email" autocomplete="username" required placeholder="navn@nortura.no"></label><label>Passord<input id="loginPassword" type="password" autocomplete="current-password" required></label><button class="primary-action full-action" type="submit">Logg inn</button><button class="text-action" type="button" id="forgotPassword">Glemt passord?</button></form></div></div>`;
}

function kpi(label, value, hint='') {
  return `<article class="card kpi"><span>${label}</span><strong>${value}</strong>${hint ? `<small>${hint}</small>` : ''}</article>`;
}

function stats() {
  const currentYear = new Date().getFullYear();
  const yearRounds = state.rounds.filter(r => {
    const stamp = Number(r.startedAt || r.completedAt || 0);
    return stamp ? new Date(stamp).getFullYear() === currentYear : true;
  });
  const completed = yearRounds.filter(r => ['Gjennomført','Oppfølging pågår','Lukket'].includes(r.status)).length;
  const planned = Math.max(state.plans.length, completed);
  const rate = planned ? Math.round((completed / planned) * 100) : 0;
  const openFollowUp = yearRounds.filter(r => r.status === 'Oppfølging pågår').length;
  const deviations = yearRounds.reduce((sum,r) => sum + Number(r.summary?.counts?.deviation || 0), 0);
  return { planned, completed, rate, openFollowUp, deviations };
}

function dashboardView() {
  const s = stats();
  const next = state.plans.find(p => !p.completedAt) || null;
  return `<section class="hero"><div><h1>Lederoppfølgingsrunder</h1><p>God dag, ${displayName(state.user.name)}. Her ser du status hittil i år.</p></div><button class="primary-action" data-view="round">+ Start LOR</button></section><section class="kpi-grid" aria-label="Nøkkeltall">${kpi('Gjennomført', s.completed, `av ${s.planned || '–'} planlagte`)}${kpi('Gjennomføringsgrad', `${s.rate} %`)}${kpi('Åpne oppfølginger', s.openFollowUp)}${kpi('Registrerte avvik', s.deviations)}</section><section class="grid-2"><article class="card panel"><h2>Siste runder</h2>${recentRounds()}</article><article class="card panel next-round"><div><h2>Din neste runde</h2>${next ? `<div class="meta"><span class="chip">${next.week ? `Uke ${next.week}` : 'Planlagt'}</span><span class="chip">${next.department || 'Avdeling'}</span><span class="chip">${next.theme || 'Tema'}</span></div><p class="muted">${next.plannedDate || 'Dato ikke satt'}</p>` : '<p class="muted">Ingen planlagt runde ligger klar ennå.</p>'}</div><button class="primary-action" data-view="round">Start LOR</button><div class="insight"><strong>Prinsipp</strong><br>Start med positiv feedback. Funn skal brukes til læring og forbedring – ikke til å premiere færrest mulig avvik.</div></article></section>`;
}

function recentRounds() {
  if (!state.rounds.length) return '<div class="empty-state">Ingen LOR er registrert ennå. Den første gjennomførte runden vil dukke opp her.</div>';
  return `<div class="round-list">${state.rounds.slice(0,6).map(r => `<div class="round-row"><div><strong>${r.theme || 'LOR'}</strong><span>${r.department || ''} · ${r.leaderName || ''}</span></div><span class="status-pill">${r.status || 'Pågår'}</span></div>`).join('')}</div>`;
}

function mineView() {
  const mine = state.rounds.filter(r => r.leaderUid === state.user.uid);
  return `<section class="hero"><div><h1>Mine LOR</h1><p>Personlig historikk, plan og oppfølging.</p></div><button class="primary-action" data-view="round">+ Start LOR</button></section><article class="card panel">${mine.length ? `<div class="round-list">${mine.map(r => `<div class="round-row"><div><strong>${r.theme || 'LOR'}</strong><span>${r.department || ''} · ${r.status || ''}</span></div><span>${r.completedAt ? new Date(r.completedAt).toLocaleDateString('nb-NO') : 'Pågår'}</span></div>`).join('')}</div>` : '<div class="empty-state">Du har ingen registrerte LOR ennå.</div>'}</article>`;
}

function placeholderView(title, text) {
  return `<section class="hero"><div><h1>${title}</h1><p>${text}</p></div></section><article class="card panel"><div class="placeholder-chart">Datamodellen er klar. Denne modulen kobles på i neste leveranse.</div></article>`;
}

function currentView() {
  if (state.activeView === 'dashboard') return dashboardView();
  if (state.activeView === 'mine') return mineView();
  if (state.activeView === 'round') {
    if (!state.roundController) state.roundController = createRoundController({ user: state.user, notify, onDone: () => { state.roundController = null; state.activeView = 'dashboard'; render(); } });
    return state.roundController.render();
  }
  if (state.activeView === 'themes') return placeholderView('Temabank', 'Temaer, kontrollpunkter, versjoner og frekvens styres her.');
  return placeholderView('Analyse', 'Historikk, trender, gjentagende funn og forslag til videre fokus.');
}

function shell() {
  return `<div class="app-shell"><header class="topbar"><div class="topbar-inner"><div class="brand"><strong>LOR</strong><span>Nortura Sarpsborg</span></div><nav class="nav">${navButtons()}</nav><div class="user-menu"><span>${displayName(state.user.name)}</span><button id="logoutButton" title="Logg ut">Logg ut</button></div></div></header><main class="main">${currentView()}</main></div>`;
}

function render() {
  if (!state.authReady) { app.innerHTML = '<div class="loading-screen">Laster LOR…</div>'; return; }
  app.innerHTML = state.user ? shell() : loginView();
}

function clearSubscriptions() {
  state.unsubscribers.forEach(fn => fn?.());
  state.unsubscribers = [];
}

function connectData() {
  clearSubscriptions();
  if (!state.user) return;
  state.unsubscribers.push(subscribePlannedRounds(state.user.uid, plans => { state.plans = plans; render(); }));
  state.unsubscribers.push(subscribeRounds(rounds => { state.rounds = rounds; render(); }));
}

app.addEventListener('click', async event => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { state.activeView = viewButton.dataset.view; if (state.activeView !== 'round') state.roundController = null; render(); return; }
  if (event.target.closest('#logoutButton')) { await signOut(); return; }
  if (event.target.closest('#forgotPassword')) {
    const email = document.querySelector('#loginEmail')?.value?.trim();
    if (!email) return notify('Skriv inn e-postadressen først.', true);
    try { await sendPasswordReset(email); notify('E-post for nytt passord er sendt.'); } catch { notify('Kunne ikke sende e-post for passordbytte.', true); }
    return;
  }
  if (state.activeView === 'round' && state.roundController) {
    try {
      const result = await state.roundController.handle(event.target, app);
      if (result?.rerender) render();
    } catch (error) {
      console.error(error);
      notify(error?.message?.includes('PERMISSION_DENIED') ? 'Firebase mangler LOR-regler. Se database.rules.json i repoet.' : 'Kunne ikke lagre. Prøv igjen.', true);
    }
  }
});

app.addEventListener('change', event => {
  if (event.target.id === 'interviewAnonymous') {
    const wrap = document.querySelector('#employeeNameWrap');
    if (wrap) wrap.hidden = event.target.checked;
  }
});

app.addEventListener('submit', async event => {
  if (event.target.id !== 'loginForm') return;
  event.preventDefault();
  state.authError = '';
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Logger inn…';
  try { await signIn(document.querySelector('#loginEmail').value, document.querySelector('#loginPassword').value); }
  catch (error) { state.authError = error.friendlyMessage || 'Innloggingen mislyktes.'; render(); }
});

onAuth(user => {
  state.user = user;
  state.authReady = true;
  state.roundController = null;
  if (user) connectData(); else clearSubscriptions();
  render();
});

render();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
