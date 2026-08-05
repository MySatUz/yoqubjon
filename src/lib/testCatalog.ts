import { DEFAULT_TEST_MAX_ATTEMPTS } from './testAttempts';

export type TestCategory = string;

export type TestCollectionOption = {
  value: TestCategory;
  label: string;
  description: string;
  visible: boolean;
  position: number;
  maxAttempts: number;
  isDefault?: boolean;
};

type CatalogTest = {
  title: string;
  description?: string | null;
  collectionCategory?: string | null;
  createdAt?: Date | string;
};

type CollectionVisibilityRow = {
  category: string;
  visible: boolean;
  label?: string | null;
  description?: string | null;
  position?: number | null;
  maxAttempts?: number | null;
};

const CATEGORY_ID_PATTERN = /^[A-Z0-9_-]{2,64}$/;
const CATEGORY_MARKER_PATTERN = /^\[([A-Z0-9_-]{2,64})\]\s*/i;

export const DEFAULT_TEST_COLLECTION_OPTIONS: TestCollectionOption[] = [
  {
    value: 'STANDARD',
    label: 'Standard tests',
    description: 'Core SAT Math modules for regular practice.',
    visible: true,
    position: 10,
    maxAttempts: DEFAULT_TEST_MAX_ATTEMPTS,
    isDefault: true,
  },
  {
    value: 'ADVANCED',
    label: 'Advanced set',
    description: 'Harder SAT Math sets for premium-level training.',
    visible: true,
    position: 20,
    maxAttempts: DEFAULT_TEST_MAX_ATTEMPTS,
    isDefault: true,
  },
  {
    value: 'PLANCK',
    label: 'Planck set',
    description: 'Precision-focused SAT Math sets for the toughest practice.',
    visible: true,
    position: 30,
    maxAttempts: DEFAULT_TEST_MAX_ATTEMPTS,
    isDefault: true,
  },
];

export const TEST_CATEGORY_OPTIONS = DEFAULT_TEST_COLLECTION_OPTIONS;
export const TEST_CATEGORIES = DEFAULT_TEST_COLLECTION_OPTIONS.map((option) => option.value);

function getDefaultCollection(category: string) {
  return DEFAULT_TEST_COLLECTION_OPTIONS.find((option) => option.value === category);
}

export function normalizeCategoryId(value: string) {
  return value.trim().toUpperCase();
}

export function isTestCategory(value: unknown): value is TestCategory {
  return typeof value === 'string' && CATEGORY_ID_PATTERN.test(normalizeCategoryId(value));
}

export function createCategoryIdBase(label: string) {
  const normalized = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 48);

  if (!normalized) {
    return `SECTION_${Date.now().toString(36).toUpperCase()}`;
  }

  return normalized.length === 1 ? `${normalized}_SECTION` : normalized;
}

export function formatCategoryLabel(category: TestCategory | null | undefined) {
  if (!category) return 'Unassigned';

  return normalizeCategoryId(category)
    .toLowerCase()
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Practice section';
}

export function getTestCollections(rows: CollectionVisibilityRow[]) {
  if (rows.length === 0) {
    return DEFAULT_TEST_COLLECTION_OPTIONS;
  }

  return rows
    .filter((row) => isTestCategory(row.category))
    .map((row) => {
      const category = normalizeCategoryId(row.category);
      const defaults = getDefaultCollection(category);

      return {
        value: category,
        label: row.label?.trim() || defaults?.label || formatCategoryLabel(category),
        description: row.description?.trim() || defaults?.description || 'Practice tests in this section.',
        visible: row.visible,
        position: row.position ?? defaults?.position ?? 1000,
        maxAttempts: row.maxAttempts ?? defaults?.maxAttempts ?? DEFAULT_TEST_MAX_ATTEMPTS,
        isDefault: defaults?.isDefault,
      } satisfies TestCollectionOption;
    })
    .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));
}

export function getDefaultCollectionVisibility() {
  return DEFAULT_TEST_COLLECTION_OPTIONS.reduce((visibility, option) => {
    visibility[option.value] = option.visible;
    return visibility;
  }, {} as Record<TestCategory, boolean>);
}

export function getCollectionVisibility(rows: CollectionVisibilityRow[]) {
  return getTestCollections(rows).reduce((visibility, option) => {
    visibility[option.value] = option.visible;
    return visibility;
  }, {} as Record<TestCategory, boolean>);
}

export function encodeTestDescription(category: TestCategory, description?: string | null) {
  const cleanDescription = description?.trim();
  const marker = `[${normalizeCategoryId(category)}]`;

  return cleanDescription
    ? `${marker} ${cleanDescription}`
    : marker;
}

export function cleanTestDescription(description?: string | null) {
  if (!description) return null;

  const withoutMarker = description
    .replace(CATEGORY_MARKER_PATTERN, '')
    .trim();

  if (!withoutMarker || withoutMarker.startsWith('Imported from ')) {
    return null;
  }

  return withoutMarker;
}

export function getTestCategory(test: CatalogTest): TestCategory | null {
  if ('collectionCategory' in test) {
    return typeof test.collectionCategory === 'string' && isTestCategory(test.collectionCategory)
      ? normalizeCategoryId(test.collectionCategory)
      : null;
  }

  const description = test.description || '';
  const markerMatch = description.match(CATEGORY_MARKER_PATTERN);
  if (markerMatch?.[1]) {
    return normalizeCategoryId(markerMatch[1]);
  }

  if (/^advanced\s+set\s*\d*/i.test(test.title.trim())) {
    return 'ADVANCED';
  }

  if (/^planck\s+set\s*\d*/i.test(test.title.trim())) {
    return 'PLANCK';
  }

  return 'STANDARD';
}

export function getDefaultTestDescription(category: TestCategory | null) {
  if (category === 'ADVANCED') {
    return 'Advanced SAT Math set with tougher questions and score-raising practice.';
  }

  if (category === 'PLANCK') {
    return 'Planck SAT Math set for precision work and the hardest practice.';
  }

  if (category === 'STANDARD') {
    return 'Standard Digital SAT practice module.';
  }

  return 'Practice module for this section.';
}

export function getTestDescription(test: CatalogTest) {
  return cleanTestDescription(test.description) || getDefaultTestDescription(getTestCategory(test));
}

export function getCategoryLabel(
  category: TestCategory | null | undefined,
  collections: TestCollectionOption[] = DEFAULT_TEST_COLLECTION_OPTIONS
) {
  if (!category) return 'Unassigned';

  const normalized = normalizeCategoryId(category);
  return collections.find((collection) => collection.value === normalized)?.label
    || getDefaultCollection(normalized)?.label
    || formatCategoryLabel(normalized);
}

export function getCategoryQueryValue(category: TestCategory) {
  return normalizeCategoryId(category).toLowerCase();
}

export function findCategoryByQuery(
  collections: TestCollectionOption[],
  value: string | string[] | undefined
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return null;

  const requested = rawValue.trim().toLowerCase();
  return collections.find((collection) => {
    const normalized = collection.value.toLowerCase();
    return normalized === requested || normalized.replace(/_/g, '-') === requested;
  })?.value ?? null;
}

function getSetNumber(title: string, category: TestCategory | null) {
  if (!category) return Number.POSITIVE_INFINITY;

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

  if (categoryA && categoryA === categoryB && (categoryA === 'ADVANCED' || categoryA === 'PLANCK')) {
    const numberA = getSetNumber(a.title, categoryA);
    const numberB = getSetNumber(b.title, categoryB);

    if (numberA !== numberB) return numberA - numberB;
  }

  if (categoryA === null && categoryB !== null) return 1;
  if (categoryA !== null && categoryB === null) return -1;

  const createdDiff = getCreatedTime(a) - getCreatedTime(b);
  if (createdDiff !== 0) return createdDiff;

  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
}
