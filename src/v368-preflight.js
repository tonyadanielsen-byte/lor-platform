// V3.6.8 preflight: prevent enhancement runtimes from observing their own DOM mutations.
// Only top-level #app replacements should trigger app enhancement sync.
(() => {
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver || window.__lorMutationGuardInstalled) return;
  window.__lorMutationGuardInstalled = true;

  window.MutationObserver = class LORMutationObserver extends NativeMutationObserver {
    observe(target, options = {}) {
      if (target && target.id === 'app' && options.childList) {
        return super.observe(target, { ...options, subtree: false });
      }
      return super.observe(target, options);
    }
  };
})();
