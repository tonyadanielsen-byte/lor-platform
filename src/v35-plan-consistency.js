const BUILD = '3.8.17';
const SEED_URL = './data/seed/plan-2026.json';
let seedPlan = null;
let livePlans = [];
let syncQueued = false;
let bound = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));
const norm = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb-NO');
const first = value => norm(value).split(/\s+/)[0] || '';

function currentWeek() {
  const d = new Date();
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil((((x - start) / 86400000) + 1) / 7);
}

function completedPlan(plan) {
  const status = norm(plan?.status);
  return Number(plan?.completedAt) > 0 || !!plan?.completedRoundId || ['completed','gjennomført','oppfølging pågår','lukket'].includes(status);
}

function seedRows() {
  const year = Number(seedPlan?.year || 2026);
  return (seedPlan?.records || []).map((row, index) => ({
    id: `seed-${year}-${row.week}-${index}`,
    year,
    week: Number(row.week),
    ownerName: row.ownerName || '',
    themeName: row.themeName || '',
    department: row.department || ''
  })).filter(row => Number.isFinite(row.week) && row.themeName);
}

function completedSeedIds() {
  const set = new Set();
  livePlans.filter(completedPlan).forEach(plan => {
    const id = String(plan.sourceSeedId || plan.id || '');
    if (id.startsWith('seed-')) set.add(id);
  });
  return set;
}

function annualMetrics() {
  const rows = seedRows();
  const completed = completedSeedIds();
  const week = currentWeek();
  const done = rows.filter(row => completed.has(row.id)).length;
  const overdue = rows.filter(row => row.week < week && !completed.has(row.id)).length;
  const remaining = rows.filter(row => row.week >= week && !completed.has(row.id)).length;
  return { rows, completed, done, overdue, remaining, total: rows.length };
}

function currentUserName() {
  return document.querySelector('.user-menu > span')?.textContent?.trim() || '';
}

function personalUpcoming(metrics) {
  const user = first(currentUserName());
  if (!user) return [];
  const week = currentWeek();
  return metrics.rows
    .filter(row => first(row.ownerName) === user)
    .filter(row => row.week >= week && !metrics.completed.has(row.id))
    .sort((a, b) => a.week - b.week);
}

function numberFrom(text) {
  const match = String(text || '').match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function findingCounts() {
  const base = document.querySelectorAll('main.main .dashboard-kpis .kpi');
  return {
    improvement: numberFrom(base[3]?.querySelector('strong')?.textContent),
    deviation: numberFrom(base[4]?.querySelector('strong')?.textContent)
  };
}

function ensureStyles() {
  if (document.querySelector('#v317DashboardStyles')) return;
  const style = document.createElement('style');
  style.id = 'v317DashboardStyles';
  style.textContent = `
    #v35Dashboard .v317-year{display:grid;gap:13px;padding-top:8px}
    #v35Dashboard .v317-year-total{display:flex;align-items:end;gap:8px}
    #v35Dashboard .v317-year-total strong{font-size:34px;line-height:1;color:#0b1f2c}
    #v35Dashboard .v317-year-total span{font-size:12px;color:#687c89;padding-bottom:4px}
    #v35Dashboard .v317-status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    #v35Dashboard .v317-status{border:1px solid #e1e9ea;border-radius:12px;padding:10px;background:#f9fbfb}
    #v35Dashboard .v317-status b{display:block;font-size:22px;color:#0d2431}
    #v35Dashboard .v317-status span{font-size:10px;color:#697d89}
    #v35Dashboard .v317-status.done{background:#eef9f4;border-color:#cce8da}
    #v35Dashboard .v317-status.overdue{background:#fff3f3;border-color:#f1d2d2}
    #v35Dashboard .v317-status.overdue b{color:#c33d3d}
    #v35Dashboard .v317-empty{height:185px;display:grid;place-items:center;text-align:center;padding:16px}
    #v35Dashboard .v317-empty div{max-width:260px}
    #v35Dashboard .v317-empty strong{display:block;font-size:17px;color:#15303d;margin-bottom:6px}
    #v35Dashboard .v317-empty p{margin:0;color:#70838f;font-size:12px;line-height:1.45}
    #v35Dashboard .v317-empty-icon{width:42px;height:42px;border-radius:13px;margin:0 auto 10px;background:#e8f7f0;color:#0d9461;display:grid;place-items:center;font-size:20px;font-weight:900}
    #v35Dashboard .v317-upcoming{display:grid;gap:9px;padding-top:3px}
    #v35Dashboard .v317-upcoming button{width:100%;border:1px solid #e0e8e9;background:#fff;border-radius:13px;padding:12px;display:grid;grid-template-columns:58px 1fr auto;gap:10px;text-align:left;align-items:center;transition:.18s ease}
    #v35Dashboard .v317-upcoming button:hover{background:#f6fbf8;border-color:#bfded1}
    #v35Dashboard .v317-week{font-weight:900;color:#0b8d5c;background:#e8f7f0;border-radius:10px;padding:8px 6px;text-align:center;font-size:12px}
    #v35Dashboard .v317-upcoming strong{display:block;color:#102335;font-size:14px}
    #v35Dashboard .v317-upcoming small{display:block;color:#70818c;margin-top:2px}
    #v35Dashboard .v317-arrow{font-weight:900;color:#345665}
    #v35Dashboard .v317-next-note{font-size:12px;color:#d9eee7;margin-top:8px}
    @media(max-width:760px){#v35Dashboard .v317-status-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function syncKpis(dash) {
  const base = [...document.querySelectorAll('main.main .dashboard-kpis .kpi')];
  const visible = [...dash.querySelectorAll('.v35-kpis .v35-kpi')];
  if (!base.length || !visible.length) return;

  const firstBaseValue = base[0]?.querySelector('strong')?.textContent?.trim() || '0 %';
  const firstBaseHint = base[0]?.querySelector('small')?.textContent?.trim() || '';
  const firstMatch = firstBaseHint.match(/(\d+)\s+av\s+(\d+)/i);
  const personalDone = firstMatch ? Number(firstMatch[1]) : 0;
  const personalTotal = firstMatch ? Number(firstMatch[2]) : 0;
  const personalRate = numberFrom(firstBaseValue);

  const firstCard = visible[0];
  if (firstCard) {
    const label = firstCard.querySelector('small');
    const value = firstCard.querySelector('strong');
    const hint = firstCard.querySelector('span:not(.v35-kpi-icon)');
    const bar = firstCard.querySelector('i > b');
    if (label) label.textContent = 'Mine planlagte runder';
    if (value) value.textContent = `${personalRate} %`;
    if (hint) hint.textContent = `${personalDone} av ${personalTotal} gjennomført`;
    if (bar) bar.style.width = `${personalRate}%`;
  }

  const secondCard = visible[1];
  if (secondCard) {
    const label = secondCard.querySelector('small');
    const value = secondCard.querySelector('strong');
    const hint = secondCard.querySelector('span:not(.v35-kpi-icon)');
    if (label) label.textContent = 'Gjennomførte LOR totalt';
    if (value) value.textContent = base[1]?.querySelector('strong')?.textContent?.trim() || '0';
    if (hint) hint.textContent = 'på tvers av fabrikken';
  }
}

function renderAnnualCard(dash, metrics) {
  const card = dash.querySelector('.v35-topgrid > .v35-card:first-child');
  if (!card) return;
  card.innerHTML = `
    <div class="v35-head"><span>Årsplan 2026</span></div>
    <div class="v317-year">
      <div class="v317-year-total"><strong>${metrics.done} av ${metrics.total}</strong><span>gjennomført</span></div>
      <div class="v317-status-grid">
        <div class="v317-status done"><b>${metrics.done}</b><span>Gjennomført</span></div>
        <div class="v317-status overdue"><b>${metrics.overdue}</b><span>Forfalt</span></div>
        <div class="v317-status"><b>${metrics.remaining}</b><span>Gjenstår</span></div>
      </div>
    </div>`;
}

function renderEmptyFindings(dash) {
  const counts = findingCounts();
  if (counts.improvement || counts.deviation) return;
  const cards = dash.querySelectorAll('.v35-topgrid > .v35-card');
  const timeline = cards[1];
  const themes = cards[2];
  if (timeline) timeline.innerHTML = `
    <div class="v35-head"><span>Funn over tid</span></div>
    <div class="v317-empty"><div><span class="v317-empty-icon">✓</span><strong>Ingen funn registrert ennå</strong><p>Grafen fylles når LOR-runder registrerer forbedringspunkter eller avvik.</p></div></div>`;
  if (themes) themes.innerHTML = `
    <div class="v35-head"><span>Funn per tema</span></div>
    <div class="v317-empty"><div><span class="v317-empty-icon">0</span><strong>0 forbedringspunkter · 0 avvik</strong><p>Når funn registreres, vises temaene med størst forbedringsbehov her.</p></div></div>`;
}

function renderNext(dash, upcoming) {
  const card = dash.querySelector('.v35-next');
  if (!card) return;
  const next = upcoming[0];
  if (!next) {
    card.innerHTML = `<span class="eyebrow">MIN NESTE LOR</span><h2>Ingen kommende LOR</h2><p>Du har ingen fremtidige runder i årsplanen.</p><div class="insight"><strong>★ LOR-prinsipp</strong><br>Start positivt, vær konkret og bruk funn til læring og forbedring.</div>`;
    return;
  }
  card.innerHTML = `
    <span class="eyebrow">MIN NESTE LOR</span>
    <h2>Uke ${next.week} · ${esc(next.themeName)}</h2>
    <p>${esc(next.department)} · planlagt for ${esc(next.ownerName)}</p>
    <button class="primary-action full-action" data-start-plan="${esc(next.id)}">Start planlagt LOR →</button>
    <div class="v317-next-note">Dette er din neste planlagte runde i årsplanen.</div>
    <div class="insight"><strong>★ LOR-prinsipp</strong><br>Start positivt, vær konkret og bruk funn til læring og forbedring.</div>`;
}

function renderUpcoming(dash, upcoming) {
  const card = dash.querySelector('.v35-bottomgrid > .v35-card:nth-child(2)');
  if (!card) return;
  const items = upcoming.slice(0, 4);
  card.innerHTML = `
    <div class="v35-head"><span>Mine kommende runder</span><span>${items.length ? `${items.length} neste` : ''}</span></div>
    <div class="v317-upcoming">
      ${items.length ? items.map(row => `
        <button type="button" data-start-plan="${esc(row.id)}">
          <span class="v317-week">Uke ${row.week}</span>
          <span><strong>${esc(row.themeName)}</strong><small>${esc(row.department)}</small></span>
          <span class="v317-arrow">→</span>
        </button>`).join('') : '<div class="v317-empty"><div><span class="v317-empty-icon">✓</span><strong>Ingen kommende runder</strong><p>Du har ingen fremtidige LOR-runder i årsplanen.</p></div></div>'}
    </div>`;
}

function applyDashboardMeaning() {
  const dash = document.querySelector('#v35Dashboard');
  if (!dash || !seedPlan) return;
  ensureStyles();
  const metrics = annualMetrics();
  const upcoming = personalUpcoming(metrics);
  syncKpis(dash);
  renderAnnualCard(dash, metrics);
  renderEmptyFindings(dash);
  renderNext(dash, upcoming);
  renderUpcoming(dash, upcoming);
  dash.dataset.dashboardMeaning = BUILD;
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  setTimeout(() => {
    syncQueued = false;
    applyDashboardMeaning();
  }, 0);
}

async function loadSeed() {
  if (seedPlan) return;
  seedPlan = await fetch(`${SEED_URL}?dashboard=${BUILD}`, { cache:'no-store' }).then(response => {
    if (!response.ok) throw new Error('Kunne ikke laste årsplanen til dashboardet.');
    return response.json();
  });
}

function bindPlans() {
  if (bound || !window.firebase?.database) return;
  bound = true;
  window.firebase.database().ref('lor/plans').on('value', snap => {
    livePlans = Object.entries(snap.val() || {}).map(([id, value]) => ({ id, ...(value || {}) }));
    queueSync();
  });
}

Promise.resolve()
  .then(loadSeed)
  .then(() => {
    bindPlans();
    const app = document.querySelector('#app');
    if (app) new MutationObserver(queueSync).observe(app, { childList:true, subtree:true });
    window.addEventListener('load', queueSync);
    queueSync();
  })
  .catch(error => console.error(`[LOR ${BUILD}] Dashboard-meaning`, error));

document.documentElement.dataset.v35PlanTruth = 'app-js';
document.documentElement.dataset.dashboardMeaning = BUILD;
