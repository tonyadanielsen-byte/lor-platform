const CIRCUMFERENCE = 2 * Math.PI * 43;
let syncQueued = false;

function numberFrom(text) {
  const match = String(text || '').match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function syncPlanProgress() {
  const main = document.querySelector('main.main');
  const baseKpi = main?.querySelector('.dashboard-kpis .kpi:first-child');
  const dash = main?.querySelector('#v35Dashboard');
  if (!baseKpi || !dash) return;

  const rate = Math.max(0, Math.min(100, numberFrom(baseKpi.querySelector('strong')?.textContent)));
  const hint = baseKpi.querySelector('small')?.textContent || '';
  const match = hint.match(/(\d+)\s+av\s+(\d+)/i);
  const done = match ? Number(match[1]) : 0;
  const plans = match ? Number(match[2]) : 0;
  const remaining = Math.max(0, plans - done);

  const firstKpi = dash.querySelector('.v35-kpis .v35-kpi:first-child');
  const firstStrong = firstKpi?.querySelector('strong');
  const firstHint = firstKpi?.querySelector('span:not(.v35-kpi-icon)');
  const firstBar = firstKpi?.querySelector('i > b');
  if (firstStrong) firstStrong.textContent = `${rate} %`;
  if (firstHint) firstHint.textContent = hint;
  if (firstBar) firstBar.style.width = `${rate}%`;

  const donut = dash.querySelector('.v35-progress .v35-donut');
  const donutValue = donut?.querySelector('circle.value');
  const donutText = donut?.querySelector('text.big');
  if (donutValue) {
    const value = rate / 100 * CIRCUMFERENCE;
    donutValue.setAttribute('stroke-dasharray', `${value} ${CIRCUMFERENCE - value}`);
  }
  if (donutText) donutText.textContent = `${rate}%`;

  const detail = dash.querySelector('.v35-progress > div:last-child');
  const lines = detail ? detail.querySelectorAll('p b') : [];
  if (lines[0]) lines[0].textContent = `${done} (${rate}%)`;
  if (lines[1]) lines[1].textContent = `${remaining} (${Math.max(0, 100 - rate)}%)`;
  const total = detail?.querySelector(':scope > strong');
  if (total) total.textContent = String(plans);
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  setTimeout(() => {
    syncQueued = false;
    syncPlanProgress();
  }, 0);
}

const app = document.querySelector('#app');
if (app) new MutationObserver(queueSync).observe(app, { childList: true, subtree: true });
window.addEventListener('load', queueSync);
setInterval(queueSync, 1000);
queueSync();

document.documentElement.dataset.v35PlanTruth = 'app-js';
