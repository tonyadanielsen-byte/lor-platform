const BUILD = '3.8.18';
const SEED_URL = './data/seed/plan-2026.json';
let seedPlan = null;
let livePlans = [];
let liveRounds = [];
let syncQueued = false;
let plansBound = false;
let roundsBound = false;

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

function completedRound(round) {
  return ['gjennomført','oppfølging pågår','lukket'].includes(norm(round?.status));
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

function monthActivity() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString('nb-NO', { month:'short' }).replace('.', ''),
      count: 0
    });
  }
  liveRounds.filter(completedRound).forEach(round => {
    const t = Number(round.completedAt || round.startedAt || 0);
    if (!t) return;
    const d = new Date(t);
    const row = months.find(item => item.year === d.getFullYear() && item.month === d.getMonth());
    if (row) row.count += 1;
  });
  return months;
}

function departmentActivity() {
  const preferred = ['Renhold','Rekvisita','Ferdigmat'];
  const counts = new Map(preferred.map(name => [name, 0]));
  liveRounds.filter(completedRound).forEach(round => {
    const name = String(round.department || 'Annet').trim() || 'Annet';
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      const ai = preferred.indexOf(a.name), bi = preferred.indexOf(b.name);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return a.name.localeCompare(b.name, 'nb-NO');
    });
}

function ensureStyles() {
  if (document.querySelector('#v318DashboardStyles')) return;
  const style = document.createElement('style');
  style.id = 'v318DashboardStyles';
  style.textContent = `
    body.v318-dashboard-active main.main{padding-top:14px!important}
    body.v318-dashboard-active #v35Dashboard{margin-top:6px!important}
    #v35Dashboard .v35-kpi[data-dashboard-action]{cursor:pointer}
    #v35Dashboard .v318-head-action{border:0;background:transparent;color:#0b7d5a;font-weight:800;font-size:11px;cursor:pointer;padding:2px 0}
    #v35Dashboard .v318-year-wrap{display:grid;grid-template-columns:128px 1fr;gap:13px;align-items:center;height:188px}
    #v35Dashboard .v318-ring{--done:0%;--overdue:0%;width:120px;height:120px;border-radius:50%;background:conic-gradient(#11a66d 0 var(--done),#ef7777 var(--done) calc(var(--done) + var(--overdue)),#dfe7e9 calc(var(--done) + var(--overdue)) 100%);display:grid;place-items:center;position:relative}
    #v35Dashboard .v318-ring:after{content:'';position:absolute;inset:16px;background:#fff;border-radius:50%;box-shadow:inset 0 0 0 1px #edf1f2}
    #v35Dashboard .v318-ring-center{position:relative;z-index:1;text-align:center;display:grid}
    #v35Dashboard .v318-ring-center strong{font-size:26px;line-height:1;color:#0a2130}
    #v35Dashboard .v318-ring-center span{font-size:9px;color:#70818d;margin-top:4px}
    #v35Dashboard .v318-legend{display:grid;gap:8px}
    #v35Dashboard .v318-legend-row{display:grid;grid-template-columns:10px 1fr auto;gap:8px;align-items:center;font-size:11px;color:#5f7483}
    #v35Dashboard .v318-legend-row i{width:9px;height:9px;border-radius:50%;background:#dfe7e9}
    #v35Dashboard .v318-legend-row.done i{background:#11a66d}
    #v35Dashboard .v318-legend-row.overdue i{background:#ef7777}
    #v35Dashboard .v318-legend-row b{font-size:14px;color:#102735}
    #v35Dashboard .v318-activity{height:190px;display:grid;grid-template-rows:1fr auto;gap:8px;padding-top:3px}
    #v35Dashboard .v318-bars{display:grid;grid-template-columns:repeat(12,1fr);gap:7px;align-items:end;border-bottom:1px solid #dfe8ea;padding:12px 3px 0;min-height:145px}
    #v35Dashboard .v318-month{display:grid;grid-template-rows:1fr 18px;gap:5px;height:100%;align-items:end;text-align:center}
    #v35Dashboard .v318-barbox{height:100%;display:flex;align-items:flex-end;justify-content:center;position:relative}
    #v35Dashboard .v318-barbox i{display:block;width:min(22px,72%);min-height:4px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#1bb877,#0b8e61);transition:height .3s ease;box-shadow:0 5px 12px rgba(12,139,94,.12)}
    #v35Dashboard .v318-barbox b{position:absolute;bottom:calc(var(--h) + 4px);font-size:10px;color:#425e6b}
    #v35Dashboard .v318-month small{font-size:9px;color:#778a95;text-transform:capitalize}
    #v35Dashboard .v318-chart-foot{display:flex;justify-content:space-between;gap:10px;font-size:10px;color:#71838e}
    #v35Dashboard .v318-chart-foot strong{color:#0b8e61}
    #v35Dashboard .v318-depts{display:grid;gap:15px;padding:16px 2px 4px}
    #v35Dashboard .v318-dept{display:grid;grid-template-columns:76px 1fr 24px;gap:9px;align-items:center}
    #v35Dashboard .v318-dept span{font-size:11px;color:#536a78;font-weight:700}
    #v35Dashboard .v318-dept i{height:12px;border-radius:99px;background:#edf2f3;overflow:hidden}
    #v35Dashboard .v318-dept i b{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#0a8359,#25b77b);transition:width .3s ease}
    #v35Dashboard .v318-dept strong{font-size:13px;color:#0b2230;text-align:right}
    #v35Dashboard .v318-dept-total{margin-top:5px;padding-top:10px;border-top:1px solid #e5ecee;color:#738690;font-size:10px;display:flex;justify-content:space-between}
    #v35Dashboard .v318-dept-total b{color:#0b8e61;font-size:12px}
    #v35Dashboard .v318-upcoming{display:grid;gap:9px;padding-top:3px}
    #v35Dashboard .v318-upcoming button{width:100%;border:1px solid #e0e8e9;background:#fff;border-radius:13px;padding:12px;display:grid;grid-template-columns:58px 1fr auto;gap:10px;text-align:left;align-items:center;transition:.18s ease}
    #v35Dashboard .v318-upcoming button:hover{background:#f6fbf8;border-color:#bfded1}
    #v35Dashboard .v318-week{font-weight:900;color:#0b8d5c;background:#e8f7f0;border-radius:10px;padding:8px 6px;text-align:center;font-size:12px}
    #v35Dashboard .v318-upcoming strong{display:block;color:#102335;font-size:14px}
    #v35Dashboard .v318-upcoming small{display:block;color:#70818c;margin-top:2px}
    #v35Dashboard .v318-arrow{font-weight:900;color:#345665}
    #v35Dashboard .v318-next-note{font-size:12px;color:#d9eee7;margin-top:8px}
    #v35Dashboard .v318-empty{height:160px;display:grid;place-items:center;text-align:center;color:#71838e;font-size:12px}
    @media(max-width:1180px){#v35Dashboard .v318-year-wrap{grid-template-columns:115px 1fr}}
    @media(max-width:760px){body.v318-dashboard-active main.main{padding-top:8px!important}#v35Dashboard .v318-year-wrap{grid-template-columns:1fr;height:auto;justify-items:center}#v35Dashboard .v318-bars{gap:3px}.v318-chart-foot{flex-direction:column}}
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
    firstCard.removeAttribute('data-kpi-filter');
    firstCard.dataset.dashboardAction = 'my-plans';
    firstCard.title = 'Åpne mine planlagte runder i årsplanen';
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
  const donePct = metrics.total ? metrics.done / metrics.total * 100 : 0;
  const overduePct = metrics.total ? metrics.overdue / metrics.total * 100 : 0;
  card.innerHTML = `
    <div class="v35-head"><span>Årsplan 2026</span><button class="v318-head-action" data-dashboard-action="annual-plan">Åpne årsplan →</button></div>
    <div class="v318-year-wrap">
      <div class="v318-ring" style="--done:${donePct.toFixed(2)}%;--overdue:${overduePct.toFixed(2)}%">
        <div class="v318-ring-center"><strong>${metrics.done}</strong><span>av ${metrics.total} gjennomført</span></div>
      </div>
      <div class="v318-legend">
        <div class="v318-legend-row done"><i></i><span>Gjennomført</span><b>${metrics.done}</b></div>
        <div class="v318-legend-row overdue"><i></i><span>Forfalt</span><b>${metrics.overdue}</b></div>
        <div class="v318-legend-row"><i></i><span>Gjenstår</span><b>${metrics.remaining}</b></div>
      </div>
    </div>`;
}

function renderActivityChart(dash) {
  const cards = dash.querySelectorAll('.v35-topgrid > .v35-card');
  const card = cards[1];
  if (!card) return;
  const series = monthActivity();
  const max = Math.max(1, ...series.map(item => item.count));
  const total = series.reduce((sum, item) => sum + item.count, 0);
  const activeMonths = series.filter(item => item.count > 0).length;
  card.innerHTML = `
    <div class="v35-head"><span>LOR-aktivitet</span><span>Siste 12 mnd</span></div>
    <div class="v318-activity">
      <div class="v318-bars">
        ${series.map(item => {
          const height = item.count ? Math.max(14, item.count / max * 100) : 3;
          return `<div class="v318-month"><div class="v318-barbox" style="--h:${height}%">${item.count ? `<b>${item.count}</b>` : ''}<i style="height:${height}%"></i></div><small>${esc(item.label)}</small></div>`;
        }).join('')}
      </div>
      <div class="v318-chart-foot"><span><strong>${total}</strong> gjennomførte LOR</span><span>aktivitet i ${activeMonths} av 12 måneder</span></div>
    </div>`;
}

function renderDepartmentChart(dash) {
  const cards = dash.querySelectorAll('.v35-topgrid > .v35-card');
  const card = cards[2];
  if (!card) return;
  const rows = departmentActivity();
  const max = Math.max(1, ...rows.map(item => item.count));
  const total = rows.reduce((sum, item) => sum + item.count, 0);
  card.innerHTML = `
    <div class="v35-head"><span>Gjennomført per avdeling</span><span>${total} totalt</span></div>
    <div class="v318-depts">
      ${rows.map(item => `<div class="v318-dept"><span>${esc(item.name)}</span><i><b style="width:${item.count ? Math.max(8, item.count / max * 100) : 0}%"></b></i><strong>${item.count}</strong></div>`).join('')}
      <div class="v318-dept-total"><span>Basert på gjennomførte runder i Firebase</span><b>${total}</b></div>
    </div>`;
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
    <div class="v318-next-note">Dette er din neste planlagte runde i årsplanen.</div>
    <div class="insight"><strong>★ LOR-prinsipp</strong><br>Start positivt, vær konkret og bruk funn til læring og forbedring.</div>`;
}

function renderUpcoming(dash, upcoming) {
  const card = dash.querySelector('.v35-bottomgrid > .v35-card:nth-child(2)');
  if (!card) return;
  const items = upcoming.slice(0, 4);
  card.innerHTML = `
    <div class="v35-head"><span>Mine kommende runder</span><button class="v318-head-action" data-dashboard-action="my-plans">Åpne mine runder →</button></div>
    <div class="v318-upcoming">
      ${items.length ? items.map(row => `
        <button type="button" data-start-plan="${esc(row.id)}">
          <span class="v318-week">Uke ${row.week}</span>
          <span><strong>${esc(row.themeName)}</strong><small>${esc(row.department)}</small></span>
          <span class="v318-arrow">→</span>
        </button>`).join('') : '<div class="v318-empty">Du har ingen fremtidige LOR-runder i årsplanen.</div>'}
    </div>`;
}

function applyDashboardMeaning() {
  const dash = document.querySelector('#v35Dashboard');
  document.body.classList.toggle('v318-dashboard-active', !!dash);
  if (!dash || !seedPlan) return;
  ensureStyles();
  const metrics = annualMetrics();
  const upcoming = personalUpcoming(metrics);
  const baseKpis = [...document.querySelectorAll('main.main .dashboard-kpis .kpi')]
    .map(card => `${card.querySelector('strong')?.textContent || ''}|${card.querySelector('small')?.textContent || ''}`)
    .join(';');
  const roundSignature = liveRounds.map(round => `${round.id}:${round.updatedAt || round.completedAt || ''}`).join(',');
  const signature = [
    metrics.done,
    metrics.overdue,
    metrics.remaining,
    upcoming.map(row => row.id).join(','),
    baseKpis,
    roundSignature
  ].join('::');
  if (dash.dataset.dashboardMeaningSignature === signature) return;
  dash.dataset.dashboardMeaningSignature = signature;

  syncKpis(dash);
  renderAnnualCard(dash, metrics);
  renderActivityChart(dash);
  renderDepartmentChart(dash);
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

function findAnnualPlanNav() {
  return [...document.querySelectorAll('button,a')].find(el => norm(el.textContent) === 'årsplan');
}

function applyPersonalAnnualFilter(attempt = 0) {
  const user = first(currentUserName());
  if (!user) return;
  const selects = [...document.querySelectorAll('main select')];
  const ownerSelect = selects.find(select => [...select.options].some(option => norm(option.textContent).includes('alle ansvarlige')));
  if (!ownerSelect) {
    if (attempt < 6) setTimeout(() => applyPersonalAnnualFilter(attempt + 1), 120);
    return;
  }
  const option = [...ownerSelect.options].find(item => first(item.textContent) === user);
  if (!option) return;
  if (ownerSelect.value !== option.value) {
    ownerSelect.value = option.value;
    ownerSelect.dispatchEvent(new Event('change', { bubbles:true }));
  }
}

function openAnnualPlan(personal = false) {
  const nav = findAnnualPlanNav();
  if (!nav) return;
  nav.click();
  if (personal) setTimeout(() => applyPersonalAnnualFilter(), 80);
}

document.addEventListener('click', event => {
  const target = event.target.closest('#v35Dashboard [data-dashboard-action]');
  if (!target) return;
  const action = target.dataset.dashboardAction;
  if (!['my-plans','annual-plan'].includes(action)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openAnnualPlan(action === 'my-plans');
}, true);

async function loadSeed() {
  if (seedPlan) return;
  seedPlan = await fetch(`${SEED_URL}?dashboard=${BUILD}`, { cache:'no-store' }).then(response => {
    if (!response.ok) throw new Error('Kunne ikke laste årsplanen til dashboardet.');
    return response.json();
  });
}

function bindData() {
  if (!window.firebase?.database) return;
  const db = window.firebase.database();
  if (!plansBound) {
    plansBound = true;
    db.ref('lor/plans').on('value', snap => {
      livePlans = Object.entries(snap.val() || {}).map(([id, value]) => ({ id, ...(value || {}) }));
      queueSync();
    });
  }
  if (!roundsBound) {
    roundsBound = true;
    db.ref('lor/rounds').on('value', snap => {
      liveRounds = Object.entries(snap.val() || {}).map(([id, value]) => ({ id, ...(value || {}) }));
      queueSync();
    });
  }
}

Promise.resolve()
  .then(loadSeed)
  .then(() => {
    bindData();
    const app = document.querySelector('#app');
    if (app) new MutationObserver(queueSync).observe(app, { childList:true, subtree:true });
    window.addEventListener('load', queueSync);
    queueSync();
  })
  .catch(error => console.error(`[LOR ${BUILD}] Dashboard-meaning`, error));

document.documentElement.dataset.v35PlanTruth = 'app-js';
document.documentElement.dataset.dashboardMeaning = BUILD;
