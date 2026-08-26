// Stability guard for the stable annual-plan runtime.
// v363-runtime registers setInterval(sync, 1000) on window.load. That full-page
// rerender closes native select menus while the user is choosing a filter.
(() => {
  const nativeSetInterval = window.setInterval.bind(window);
  let blockedAnnualSync = false;

  window.setInterval = function patchedSetInterval(fn, delay, ...args) {
    if (!blockedAnnualSync && Number(delay) === 1000 && typeof fn === 'function' && fn.name === 'sync') {
      blockedAnnualSync = true;
      return 0;
    }
    return nativeSetInterval(fn, delay, ...args);
  };

  window.addEventListener('load', () => {
    setTimeout(() => { window.setInterval = nativeSetInterval; }, 0);
  }, { once: true });
})();
