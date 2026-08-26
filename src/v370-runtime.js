// V3.7.0 UX/data-source consolidation layer.
// Owns: dashboard annual-plan overview + next task, modal behavior, theme-bank density.
(() => {
  const BUILD = '3.7.0';
  let seedPlan = null;
  let legacy = [];
  let livePlans = [];
  let liveRounds = [];
  let dbBound = false;
  let applyTimer = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
  const first = n => String(n || '').trim().split(/\s+/)[0].toLowerCase();

  function isoWeek(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return { year: d.getUTCFullYear(), week: Math.ceil((((d - y0) / 86400000) + 1) / 7) };
  }

  function seedRows(year) {
    if (!seedPlan || Number(seedPlan.year) !== Number(year)) return [];
    return (seedPlan.records || []).map((r, i) => ({
      id: `seed-${year}-${r.week}-${i}`,
      sourceSeedId: `seed-${year}-${r.week}-${i}`,
      year: Number(year),
      week: Number(r.week),
      leaderName: r.ownerName || '',
      theme: r.themeName || '',
      themeName: r.themeName || '',
      department: r.department || '',
      coLeaderName: '',
      source: 'seed',
      needsReview: r.status === 'needsReview'
    })).filter(r => Number.isFinite(r.week) && r.week >= 1 && r.week <= 53 && r.theme);
  }

  function mergedRows(year) {
    const seeds = seedRows(year);
    const live = livePlans
      .filter(r => Number(r.year || 2026) === Number(year) && Number.isFinite(Number(r.week)))
      .map(r => ({
        ...r,
        year: Number(r.year || year),
        week: Number(r.week),
        leaderName: r.leaderName || r.ownerName || '',
        theme: r.theme || r.themeName || '',
        themeName: r.theme || r.themeName || '',
        department: r.department || '',
        coLeaderName: r.coLeaderName || '',
        source: 'live'
      }));
    const overrides = new Map(live.filter(r => r.sourceSeedId).map(r => [r.sourceSeedId, r]));
    const rows = seeds.map(s => overrides.has(s.id) ? { ...s, ...overrides.get(s.id), source: 'live' } : s);
    live.filter(r => !r.sourceSeedId || !seeds.some(s => s.id === r.sourceSeedId)).forEach(r => rows.push(r));
    return rows.filter(r => !r.archived && r.theme).sort((a, b) => a.week - b.week || String(a.id).localeCompare(String(b.id)));
  }

  function isCompleted(plan) {
    const digital = liveRounds.some(r =>
      r.planId === plan.id ||
      (plan.sourceSeedId && r.planId === plan.sourceSeedId) ||
      (Number(r.planWeek) === Number(plan.week) &&
        (!plan.theme || r.theme === plan.theme) &&
        (!plan.department || r.department === plan.department) &&
        (!plan.leaderName || first(r.leaderName) === first(plan.leaderName)))
    );
    if (digital) return true;
    if (Number(plan.year) === 2026) {
      return legacy.some(r => Number(r.week) === Number(plan.week) && (!plan.leaderName || first(r.leader) === first(plan.leaderName)) && r.date);
    }
    return false;
  }

  function planState(plan, now = isoWeek()) {
    if (isCompleted(plan)) return 'done';
    if (Number(plan.year) < now.year || (Number(plan.year) === now.year && Number(plan.week) < now.week)) return 'overdue';
    if (Number(plan.year) === now.year && Number(plan.week) === now.week) return 'current';
    return 'planned';
  }

  function currentPlanData() {
    const now = isoWeek();
    const rows = mergedRows(now.year);
    const overdue = rows.filter(r => planState(r, now) === 'overdue');
    const open = rows.filter(r => !isCompleted(r));
    const next = open.find(r => r.week >= now.week) || open[0] || null;
    const upcoming = open.filter(r => r.week >= now.week).slice(0, 4);
    return { now, rows, overdue, next, upcoming };
  }

  function openAnnual(status = 'all') {
    const annual = document.querySelector('[data-v363-annual]');
    if (!annual) return;
    annual.click();
    setTimeout(() => {
      const select = document.querySelector('[data-v363-filter="status"]');
      if (!select) return;
      select.value = status;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, 30);
  }

  function renderDashboardPlan() {
    const dash = document.querySelector('#v35Dashboard');
    if (!dash || !seedPlan) return;
    const { now, overdue, next, upcoming } = currentPlanData();

    let bar = dash.querySelector('#v370PlanOverview');
    if (!bar) {
      bar = document.createElement('section');
      bar.id = 'v370PlanOverview';
      bar.className = 'v370-plan-overview';
      dash.prepend(bar);
    }

    const sig = JSON.stringify({
      week: now.week,
      overdue: overdue.map(r => r.id),
      next: next ? [next.id, next.week, next.theme, next.department, next.leaderName] : null,
      upcoming: upcoming.map(r => [r.id, r.week, r.theme])
    });
    if (bar.dataset.sig !== sig) {
      bar.dataset.sig = sig;
      bar.innerHTML = `
        <div class="v370-plan-title">
          <div><span class="eyebrow">Årsplan ${now.year}</span><strong>Uke ${now.week}</strong></div>
          <button type="button" class="text-action" data-v370-open-annual>Åpne årsplan →</button>
        </div>
        <div class="v370-plan-cards">
          <button type="button" class="v370-overdue-card ${overdue.length ? 'has-overdue' : ''}" data-v370-overdue>
            <span>Forfalte</span><strong>${overdue.length}</strong><small>${overdue.length ? 'Krever avklaring / etterregistrering' : 'Ingen forfalte runder'}</small><b>Se runder →</b>
          </button>
          ${upcoming.map((r, i) => `
            <button type="button" class="v370-upcoming-card ${i === 0 ? 'primary' : ''}" data-v370-plan-id="${esc(r.id)}">
              <span>${r.week === now.week ? 'Denne uken' : 'Kommende'}</span>
              <strong>Uke ${r.week} · ${esc(r.theme)}</strong>
              <small>${esc(r.department || 'Avdeling mangler')} · ${esc(r.leaderName || 'Ikke fordelt')}</small>
            </button>`).join('')}
        </div>`;
    }

    const nextCard = dash.querySelector('.v35-next');
    if (nextCard) {
      const nextSig = next ? `${next.id}|${next.week}|${next.theme}|${next.department}|${next.leaderName}` : 'none';
      if (nextCard.dataset.v370Plan !== nextSig) {
        nextCard.dataset.v370Plan = nextSig;
        nextCard.innerHTML = next ? `
          <span class="eyebrow">Neste oppgave</span>
          <h2>Uke ${next.week} · ${esc(next.theme)}</h2>
          <p>${esc(next.department || 'Avdeling mangler')} · ${esc(next.leaderName || 'Ikke fordelt')}</p>
          <button class="primary-action full-action" type="button" data-v370-start-plan="${encodeURIComponent(JSON.stringify(next))}">Start planlagt LOR →</button>
          <div class="insight"><strong>★ LOR-prinsipp</strong><br>Start positivt, vær konkret og bruk funn til læring og forbedring.</div>` : `
          <span class="eyebrow">Neste oppgave</span><h2>Ingen åpne runder</h2><p>Årsplanen er ajour.</p>`;
      }
    }
  }

  function polishAnnualPlan() {
    const plan = document.querySelector('.v36-plan');
    if (!plan) return;
    plan.classList.add('v370-annual-plan');
    document.querySelector('.v363-annual-main')?.classList.add('v370-annual-main');
  }

  function promoteDialog(dialog) {
    if (!dialog || dialog.dataset.v370Modal === '1') return;
    dialog.dataset.v370Modal = '1';
    dialog.classList.add('v370-modal');
    const group = dialog.classList.contains('v363-dialog') ? 'annual' : dialog.classList.contains('v35-theme-dialog') ? 'theme' : 'other';
    if (group !== 'other') {
      [...document.querySelectorAll('dialog.v370-modal')].forEach(other => {
        if (other === dialog) return;
        const same = group === 'annual' ? other.classList.contains('v363-dialog') : other.classList.contains('v35-theme-dialog');
        if (same) other.remove();
      });
    }
    try {
      if (dialog.open && !dialog.matches(':modal')) dialog.removeAttribute('open');
      if (!dialog.open) dialog.showModal();
    } catch (_) {
      dialog.setAttribute('open', '');
    }
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
  }

  function polishThemeDialog() {
    document.querySelectorAll('dialog.v35-theme-dialog').forEach(dialog => {
      promoteDialog(dialog);
      const form = dialog.querySelector('form[data-theme-form]');
      const grid = form?.querySelector('.v35-form');
      if (!grid || grid.dataset.v370 === '1') return;
      grid.dataset.v370 = '1';
      const children = [...grid.children];
      if (children[0]) children[0].classList.add('v370-name');
      if (children[1]) children[1].classList.add('v370-category');
      if (children[2]) children[2].classList.add('v370-principle');
      if (children[3]) children[3].classList.add('v370-deps');
      if (children[4]) children[4].classList.add('v370-controls');
    });
  }

  function polishAnnualDialogs() {
    document.querySelectorAll('dialog.v363-dialog').forEach(promoteDialog);
  }

  function polishThemeBank() {
    const bank = document.querySelector('#v35ThemeBank');
    if (!bank) return;
    bank.classList.add('v370-themebank');
  }

  function apply() {
    clearTimeout(applyTimer);
    applyTimer = null;
    renderDashboardPlan();
    polishAnnualPlan();
    polishThemeBank();
    polishThemeDialog();
    polishAnnualDialogs();
  }

  function scheduleApply(delay = 0) {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(apply, delay);
  }

  function bindDb() {
    if (dbBound || !window.firebase?.database) return;
    dbBound = true;
    const db = window.firebase.database();
    db.ref('lor/plans').on('value', s => {
      livePlans = [];
      s.forEach(c => livePlans.push({ id: c.key, ...(c.val() || {}) }));
      scheduleApply(20);
    });
    db.ref('lor/rounds').on('value', s => {
      liveRounds = [];
      s.forEach(c => liveRounds.push({ id: c.key, ...(c.val() || {}) }));
      scheduleApply(20);
    });
  }

  document.addEventListener('pointerdown', ev => {
    if (ev.target.closest('[data-v363-edit]')) {
      document.querySelectorAll('dialog.v363-dialog').forEach(d => d.remove());
    }
    if (ev.target.closest('[data-theme-new],[data-theme-edit]')) {
      document.querySelectorAll('dialog.v35-theme-dialog,dialog[data-theme-dialog]').forEach(d => d.remove());
    }
  }, true);

  document.addEventListener('click', ev => {
    const openAnnualButton = ev.target.closest('[data-v370-open-annual]');
    if (openAnnualButton) {
      ev.preventDefault();
      openAnnual('all');
      return;
    }
    const overdueButton = ev.target.closest('[data-v370-overdue]');
    if (overdueButton) {
      ev.preventDefault();
      openAnnual('overdue');
      return;
    }
    const upcomingButton = ev.target.closest('[data-v370-plan-id]');
    if (upcomingButton) {
      ev.preventDefault();
      openAnnual('all');
      setTimeout(() => {
        document.querySelector(`[data-v363-edit="${CSS.escape(upcomingButton.dataset.v370PlanId)}"]`)?.click();
      }, 60);
      return;
    }
    const start = ev.target.closest('[data-v370-start-plan]');
    if (start) {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        const plan = JSON.parse(decodeURIComponent(start.dataset.v370StartPlan || ''));
        window.dispatchEvent(new CustomEvent('lor:start-plan', { detail: plan }));
      } catch (err) {
        console.error('Kunne ikke starte planlagt LOR', err);
      }
    }
  }, true);

  const app = document.querySelector('#app');
  if (app) {
    new MutationObserver(() => {
      [0, 40, 140, 350].forEach(ms => setTimeout(apply, ms));
    }).observe(app, { childList: true, subtree: false });
  }
  new MutationObserver(() => {
    [0, 40, 140].forEach(ms => setTimeout(() => {
      polishThemeDialog();
      polishAnnualDialogs();
    }, ms));
  }).observe(document.body, { childList: true, subtree: false });

  Promise.all([
    fetch('./data/seed/plan-2026.json', { cache: 'no-store' }).then(r => r.json()),
    fetch('./data/seed/history-2026.json', { cache: 'no-store' }).then(r => r.json())
  ]).then(([plan, history]) => {
    seedPlan = plan;
    legacy = history.records || [];
    bindDb();
    [0, 60, 180, 500].forEach(ms => setTimeout(apply, ms));
  }).catch(err => {
    console.error(`LOR ${BUILD}: kunne ikke laste årsplan-data`, err);
    bindDb();
  });

  window.addEventListener('load', () => {
    bindDb();
    [0, 80, 250, 700].forEach(ms => setTimeout(apply, ms));
  }, { once: true });
})();
