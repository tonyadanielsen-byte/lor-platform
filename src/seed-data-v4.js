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

export async function loadSeedDataV4() {
  const [themeBank, plan2026] = await Promise.all([
    loadJson('./data/seed/themes-v1.json'),
    loadJson('./data/seed/plan-2026.json'),
  ]);

  const sharedThemes = (themeBank.sharedThemes || []).map(normalizeTheme);
  const departmentThemes = themeBank.departmentThemes || [];

  return {
    themeBank: { ...themeBank, sharedThemes, departmentThemes },
    plan2026,
  };
}

export function availableThemesV4(themeBank, department) {
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
