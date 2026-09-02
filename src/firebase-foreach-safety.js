(() => {
  const BUILD = '3.8.16';
  const Snapshot = window.firebase?.database?.DataSnapshot;
  const proto = Snapshot?.prototype;

  if (!proto?.forEach) {
    console.error(`[LOR ${BUILD}] Firebase DataSnapshot.forEach er ikke tilgjengelig.`);
    return;
  }

  if (proto.forEach.__lorSafeForEach) return;

  const originalForEach = proto.forEach;
  const safeForEach = function(action) {
    if (typeof action !== 'function') return originalForEach.call(this, action);
    return originalForEach.call(this, child => action(child) === true);
  };

  Object.defineProperty(safeForEach, '__lorSafeForEach', { value: true });
  proto.forEach = safeForEach;
  document.documentElement.dataset.firebaseForEachSafety = BUILD;
})();
