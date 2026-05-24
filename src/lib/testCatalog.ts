export type TestCategory = 'STANDARD' | 'ADVANCED';

type CatalogTest = {
  title: string;
  description?: string | null;
  createdAt?: Date | string;
};

const CATEGORY_MARKERS: Record<TestCategory, string> = {
  STANDARD: '[STANDARD]',
  ADVANCED: '[ADVANCED]',
};

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
];

export function encodeTestDescription(category: TestCategory, description?: string | null) {
  const cleanDescription = description?.trim();
  return cleanDescription
    ? `${CATEGORY_MARKERS[category]} ${cleanDescription}`
    : CATEGORY_MARKERS[category];
}

export function cleanTestDescription(description?: string | null) {
  if (!description) return null;

  const withoutMarker = description
    .replace(/^\[(STANDARD|ADVANCED)\]\s*/i, '')
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

  if (/^advanced\s+set\s*\d*/i.test(test.title.trim())) {
    return 'ADVANCED';
  }

  return 'STANDARD';
}

export function getDefaultTestDescription(category: TestCategory) {
  return category === 'ADVANCED'
    ? 'Advanced SAT Math set with tougher questions and score-raising practice.'
    : 'Standard Digital SAT practice module.';
}

export function getTestDescription(test: CatalogTest) {
  return cleanTestDescription(test.description) || getDefaultTestDescription(getTestCategory(test));
}

export function getCategoryLabel(category: TestCategory) {
  return category === 'ADVANCED' ? 'Advanced set' : 'Standard tests';
}

function getAdvancedSetNumber(title: string) {
  const match = title.match(/^advanced\s+set\s*(\d+)/i);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function getCreatedTime(test: CatalogTest) {
  if (!test.createdAt) return 0;
  return new Date(test.createdAt).getTime();
}

export function compareCatalogTests(a: CatalogTest, b: CatalogTest) {
  const categoryA = getTestCategory(a);
  const categoryB = getTestCategory(b);

  if (categoryA === 'ADVANCED' || categoryB === 'ADVANCED') {
    const numberA = getAdvancedSetNumber(a.title);
    const numberB = getAdvancedSetNumber(b.title);

    if (numberA !== numberB) return numberA - numberB;
  }

  const createdDiff = getCreatedTime(a) - getCreatedTime(b);
  if (createdDiff !== 0) return createdDiff;

  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
}
