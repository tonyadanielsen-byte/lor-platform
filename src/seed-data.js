const cache = {};

async function loadJson(path) {
  if (cache[path]) return cache[path];
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Kunne ikke laste ${path}`);
  cache[path] = await response.json();
  return cache[path];
}

function normalizeTheme(theme) {
  return {
    ...theme,
    questions: (theme.questions || []).map((text, index) => ({
      id: `${theme.id}-q${index + 1}`,
      text,
      responseType: /^eventuelle andre|^annet:|^andre kommentarer:/i.test(text) ? 'freeText' : 'assessment',
    })),
  };
}

export async function loadSeedData() {
  const [themeBank, plan2026, history2025, history2026] = await Promise.all([
    loadJson('./data/seed/themes-v1.json'),
    loadJson('./data/seed/plan-2026.json'),
    loadJson('./data/seed/history-2025.json'),
    loadJson('./data/seed/history-2026.json'),
  ]);

  const sharedThemes = (themeBank.sharedThemes || []).map(normalizeTheme);
  const departmentThemes = themeBank.departmentThemes || [];

  return {
    themeBank: { ...themeBank, sharedThemes, departmentThemes },
    plan2026,
    legacyHistory: [...(history2025.records || []), ...(history2026.records || [])],
  };
}

export function availableThemes(themeBank, department) {
  if (!themeBank) return [];
  const shared = themeBank.sharedThemes || [];
  const departmentSpecific = (themeBank.departmentThemes || [])
    .filter(theme => (theme.departments || []).includes(department))
    .map(theme => {
      const texts = theme.variants?.[department] || theme.questions || [];
      return normalizeTheme({ ...theme, questions: texts });
    });
  return [...shared, ...departmentSpecific];
}

export function planForUser(plan, userName) {
  const first = String(userName || '').trim().split(/\s+/)[0].toLowerCase();
  return (plan?.records || []).filter(row => String(row.ownerName || '').trim().split(/\s+/)[0].toLowerCase() === first);
}
