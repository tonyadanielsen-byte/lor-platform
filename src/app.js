const app = document.querySelector('#app');

const state = {
  activeView: 'dashboard',
  user: { name: 'Tony' },
};

const views = [
  ['dashboard', 'Dashboard'],
  ['mine', 'Mine LOR'],
  ['round', 'Gjennomfør LOR'],
  ['themes', 'Temabank'],
  ['analytics', 'Analyse'],
];

function navButtons() {
  return views.map(([id,label]) => `
    <button class="${state.activeView === id ? 'active' : ''}" data-view="${id}">${label}</button>
  `).join('');
}

function dashboardView() {
  return `
    <section class="hero">
      <div>
        <h1>Lederoppfølgingsrunder</h1>
        <p>God ettermiddag, ${state.user.name}. Her ser du status hittil i år.</p>
      </div>
      <button class="primary-action" data-view="round">+ Start LOR</button>
    </section>

    <section class="kpi-grid" aria-label="Nøkkeltall">
      ${kpi('Gjennomført', '29')}
      ${kpi('Gjennomføringsgrad', '91 %')}
      ${kpi('Åpne oppfølginger', '8')}
      ${kpi('Gjentagende funn', '3')}
    </section>

    <section class="grid-2">
      <article class="card panel">
        <h2>LOR-utvikling 2026</h2>
        <div class="placeholder-chart">Historikkgraf kobles til reelle data i neste fase</div>
      </article>

      <article class="card panel next-round">
        <div>
          <h2>Din neste runde</h2>
          <div class="meta">
            <span class="chip">Uke 35</span>
            <span class="chip">Renhold</span>
            <span class="chip">Kontrollrutiner</span>
          </div>
        </div>
        <p class="muted">Planlagt lederoppfølging. Mobilflyten skal være rask nok til å brukes direkte ute i avdelingen.</p>
        <button class="primary-action" data-view="round">Start planlagt LOR</button>
        <div class="insight"><strong>Innsikt</strong><br>Husorden har flere gjentagende funn enn øvrige temaer. Dette blir grunnlaget for senere beslutningsstøtte.</div>
      </article>
    </section>
  `;
}

function kpi(label, value) {
  return `<article class="card kpi"><span>${label}</span><strong>${value}</strong></article>`;
}

function placeholderView(title, text) {
  return `
    <section class="hero">
      <div><h1>${title}</h1><p>${text}</p></div>
    </section>
    <article class="card panel"><div class="placeholder-chart">Modulen etableres i Foundation V1</div></article>
  `;
}

function currentView() {
  if (state.activeView === 'dashboard') return dashboardView();
  if (state.activeView === 'mine') return placeholderView('Mine LOR', 'Personlig plan, gjennomføring, oppfølging og utvikling.');
  if (state.activeView === 'round') return placeholderView('Gjennomfør LOR', 'Mobilførst flyt for spørsmål, observasjoner, medarbeiderdialog og dokumentasjon.');
  if (state.activeView === 'themes') return placeholderView('Temabank', 'Temaer, kontrollpunkter, versjoner og frekvens styres her.');
  return placeholderView('Analyse', 'Historikk, trender, gjentagende funn og forslag til videre fokus.');
}

function render() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand"><strong>LOR</strong><span>Nortura Sarpsborg</span></div>
          <nav class="nav" aria-label="Hovedmeny">${navButtons()}</nav>
        </div>
      </header>
      <main class="main">${currentView()}</main>
    </div>
  `;
}

app.addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  state.activeView = button.dataset.view;
  render();
});

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
}
