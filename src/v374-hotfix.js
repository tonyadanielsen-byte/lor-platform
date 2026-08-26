// V3.7.4 cleanup: one dashboard annual-plan block + one stable theme-dialog layout.
(() => {
  let queued = false;

  function cleanupDashboard() {
    const dash = document.querySelector('#v35Dashboard');
    if (!dash) return;

    // V3.6.3 and V3.7.0 both produced annual-plan dashboard blocks.
    // V3.7.0 is the canonical block; remove every legacy duplicate.
    dash.querySelectorAll('#v363AnnualDash').forEach(el => el.remove());

    const canonical = [...dash.querySelectorAll('#v370PlanOverview')];
    canonical.slice(1).forEach(el => el.remove());
  }

  function normalizeThemeDialogs() {
    const dialogs = [...document.querySelectorAll('dialog')].filter(d => d.querySelector('form[data-theme-form]'));
    if (!dialogs.length) return;

    // Keep only the newest theme dialog. This prevents an old and a new renderer
    // from coexisting after rapid rerenders/clicks.
    dialogs.slice(0, -1).forEach(d => d.remove());
    const dialog = dialogs.at(-1);
    if (!dialog) return;

    dialog.classList.add('v374-theme-dialog');
    const form = dialog.querySelector('form[data-theme-form]');
    form?.classList.add('v374-theme-form');

    // The V3.5 dialog is the approved layout. Ensure it keeps the same structure
    // down to tablet size instead of jumping to the old tall single-column variant.
    if (dialog.classList.contains('v35-theme-dialog')) {
      dialog.classList.add('v370-modal');
      const grid = dialog.querySelector('.v35-form');
      if (grid) {
        const children = [...grid.children];
        children[0]?.classList.add('v370-name');
        children[1]?.classList.add('v370-category');
        children[2]?.classList.add('v370-principle');
        children[3]?.classList.add('v370-deps');
        children[4]?.classList.add('v370-controls');
      }
    }
  }

  function apply() {
    queued = false;
    cleanupDashboard();
    normalizeThemeDialogs();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', ev => {
    if (ev.target.closest('[data-view="dashboard"],[data-theme-new],[data-theme-edit]')) {
      [0, 30, 100, 250].forEach(ms => setTimeout(apply, ms));
    }
  }, true);

  [0, 50, 150, 400, 900].forEach(ms => setTimeout(apply, ms));
})();
