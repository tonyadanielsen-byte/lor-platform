(() => {
  const BUILD = '3.8.12';

  function isoWeekFromDate(value) {
    if (!value) return null;
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function normalizeForm(form) {
    if (!form?.matches?.('[data-v384-form]')) return;
    const weekInput = form.querySelector('input[name="week"]');
    const dateInput = form.querySelector('input[name="plannedDate"]');
    if (!weekInput || !dateInput) return;
    const week = Number(weekInput.value);
    const dateWeek = isoWeekFromDate(dateInput.value);
    if (Number.isFinite(week) && dateInput.value && dateWeek && dateWeek !== week) {
      dateInput.value = '';
      form.dataset.weekAuthority = BUILD;
    }
  }

  document.addEventListener('input', event => {
    if (event.target?.matches?.('input[name="week"]')) normalizeForm(event.target.closest('[data-v384-form]'));
  }, true);

  document.addEventListener('change', event => {
    if (!event.target?.matches?.('input[name="plannedDate"]')) return;
    const form = event.target.closest('[data-v384-form]');
    const weekInput = form?.querySelector('input[name="week"]');
    const dateWeek = isoWeekFromDate(event.target.value);
    if (weekInput && dateWeek) weekInput.value = String(dateWeek);
  }, true);

  document.addEventListener('click', event => {
    const action = event.target?.closest?.('[data-v384-afterregister],[data-v384-start]');
    if (action) normalizeForm(action.closest('[data-v384-form]'));
  }, true);

  document.addEventListener('submit', event => normalizeForm(event.target), true);
  window.__lorWeekPreflight = { build: BUILD, normalizeForm };
})();
