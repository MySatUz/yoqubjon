export type TestCategory = 'STANDARD' | 'ADVANCED' | 'PLANCK';

type CatalogTest = {
  title: string;
  description?: string | null;
  createdAt?: Date | string;
};

type CollectionVisibilityRow = {
  category: string;
  visible: boolean;
};

const CATEGORY_MARKERS: Record<TestCategory, string> = {
  STANDARD: '[STANDARD]',
  ADVANCED: '[ADVANCED]',
  PLANCK: '[PLANCK]',
};

export const TEST_CATEGORIES: TestCategory[] = ['STANDARD', 'ADVANCED', 'PLANCK'];

export const TEST_CATEGORY_OPTIONS: {
  value: TestCategory;
  label: string;
  description: string;
}[] = [
  {
    value: 'STANDARD',
    label: 'Standard tests',
    description: 'Core SAT Math modules for regular practice.',
  },
  {
    value: 'ADVANCED',
    label: 'Advanced set',
    description: 'Harder SAT Math sets for premium-level training.',
  },
  {
    value: 'PLANCK',
    label: 'Planck set',
    description: 'Precision-focused SAT Math sets for the toughest practice.',
  },
];

export function isTestCategory(value: unknown): value is TestCategory {
  return typeof value === 'string' && value in CATEGORY_MARKERS;
}

export function getDefaultCollectionVisibility() {
  return TEST_CATEGORIES.reduce((visibility, category) => {
    visibility[category] = true;
    return visibility;
  }, {} as Record<TestCategory, boolean>);
}

export function getCollectionVisibility(rows: CollectionVisibilityRow[]) {
  const visibility = getDefaultCollectionVisibility();

  for (const row of rows) {
    if (isTestCategory(row.category)) {
      visibility[row.category] = row.visible;
    }
  }

  return visibility;
}

export function encodeTestDescription(category: TestCategory, description?: string | null) {
  const cleanDescription = description?.trim();
  return cleanDescription
    ? `${CATEGORY_MARKERS[category]} ${cleanDescription}`
    : CATEGORY_MARKERS[category];
}

export function cleanTestDescription(description?: string | null) {
  if (!description) return null;

  const withoutMarker = description
    .replace(/^\[(STANDARD|ADVANCED|PLANCK)\]\s*/i, '')
    .trim();

  if (!withoutMarker || withoutMarker.startsWith('Imported from ')) {
    return null;
  }

  return withoutMarker;
}

export function getTestCategory(test: CatalogTest): TestCategory {
  const description = test.description || '';

  if (/^\[STANDARD\]/i.test(description)) return 'STANDARD';
  if (/^\[ADVANCED\]/i.test(description)) return 'ADVANCED';
  if (/^\[PLANCK\]/i.test(description)) return 'PLANCK';

  if (/^advanced\s+set\s*\d*/i.test(test.title.trim())) {
    return 'ADVANCED';
  }

  if (/^planck\s+set\s*\d*/i.test(test.title.trim())) {
    return 'PLANCK';
  }

  return 'STANDARD';
}

export function getDefaultTestDescription(category: TestCategory) {
  if (category === 'ADVANCED') {
    return 'Advanced SAT Math set with tougher questions and score-raising practice.';
  }

  if (category === 'PLANCK') {
    return 'Planck SAT Math set for precision work and the hardest practice.';
  }

  return 'Standard Digital SAT practice module.';
}

export function getTestDescription(test: CatalogTest) {
  return cleanTestDescription(test.description) || getDefaultTestDescription(getTestCategory(test));
}

export function getCategoryLabel(category: TestCategory) {
  if (category === 'ADVANCED') return 'Advanced set';
  if (category === 'PLANCK') return 'Planck set';
  return 'Standard tests';
}

function getSetNumber(title: string, category: TestCategory) {
  const label = getCategoryLabel(category).replace(/\s+/g, '\\s+');
  const match = title.match(new RegExp(`^${label}\\s*(\\d+)`, 'i'));
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function getCreatedTime(test: CatalogTest) {
  if (!test.createdAt) return 0;
  return new Date(test.createdAt).getTime();
}

export function compareCatalogTests(a: CatalogTest, b: CatalogTest) {
  const categoryA = getTestCategory(a);
  const categoryB = getTestCategory(b);

  if (categoryA === categoryB && (categoryA === 'ADVANCED' || categoryA === 'PLANCK')) {
    const numberA = getSetNumber(a.title, categoryA);
    const numberB = getSetNumber(b.title, categoryB);

    if (numberA !== numberB) return numberA - numberB;
  }

  const createdDiff = getCreatedTime(a) - getCreatedTime(b);
  if (createdDiff !== 0) return createdDiff;

  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
}
