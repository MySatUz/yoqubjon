/**
 * The question bank's two tags: the SAT Math domain and a difficulty, as the
 * College Board's educator question bank sorts them. Stored on BankQuestion
 * (prisma/schema.prisma) as the `value` strings and numbers below.
 *
 * Pure module, no Prisma: the import preview, the bank filters and the Board
 * picker all read it in the browser too.
 */

export const BANK_DOMAINS = [
  { value: 'algebra', label: 'Algebra' },
  { value: 'advanced-math', label: 'Advanced Math' },
  { value: 'problem-solving', label: 'Problem-Solving and Data Analysis' },
  { value: 'geometry-trig', label: 'Geometry and Trigonometry' },
] as const;

export type BankDomain = (typeof BANK_DOMAINS)[number]['value'];

export const BANK_DIFFICULTIES = [
  { value: 1, label: 'Easy' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Hard' },
] as const;

export type BankDifficulty = (typeof BANK_DIFFICULTIES)[number]['value'];

/*
 * The two banks: the questions we write ourselves, and the ones an admin
 * takes from the College Board's open SAT question bank (the owner's call,
 * 2026-10-31). Stored as BankQuestion.official; the bank page, the Board and
 * the build page each read one bank at a time.
 */
export const BANKS = [
  { value: 'own', label: 'Our questions' },
  { value: 'official', label: 'Official SAT' },
] as const;

export type BankId = (typeof BANKS)[number]['value'];

export function isBankId(value: unknown): value is BankId {
  return BANKS.some((bank) => bank.value === value);
}

/** The bank a URL or a form names; our own when it names none. */
export function readBankId(value: unknown): BankId {
  return isBankId(value) ? value : 'own';
}

export function getBankLabel(bank: BankId) {
  return BANKS.find((item) => item.value === bank)?.label ?? 'Our questions';
}

/** The stored flag for a bank, and back. */
export function isOfficialBank(bank: BankId) {
  return bank === 'official';
}

export function bankOfQuestion(official: boolean): BankId {
  return official ? 'official' : 'own';
}

export function isBankDomain(value: unknown): value is BankDomain {
  return BANK_DOMAINS.some((domain) => domain.value === value);
}

export function isBankDifficulty(value: unknown): value is BankDifficulty {
  return BANK_DIFFICULTIES.some((difficulty) => difficulty.value === value);
}

export function getDomainLabel(value: string | null | undefined) {
  return BANK_DOMAINS.find((domain) => domain.value === value)?.label ?? 'Not sorted';
}

export function getDifficultyLabel(value: number | null | undefined) {
  return BANK_DIFFICULTIES.find((difficulty) => difficulty.value === value)?.label ?? 'Not sorted';
}

/*
 * What an author may write in `\domain{…}`: the value, the College Board name,
 * or the short names teachers use. Compared lower-cased with every run of
 * spaces, dashes, "&" and "and" squeezed out, so "Geometry & Trig",
 * "geometry-and-trigonometry" and "GEOMETRY" are one tag.
 */
const DOMAIN_ALIASES: Record<string, BankDomain> = {
  algebra: 'algebra',
  alg: 'algebra',
  advancedmath: 'advanced-math',
  advanced: 'advanced-math',
  am: 'advanced-math',
  problemsolvingdataanalysis: 'problem-solving',
  problemsolving: 'problem-solving',
  dataanalysis: 'problem-solving',
  psda: 'problem-solving',
  geometrytrigonometry: 'geometry-trig',
  geometrytrig: 'geometry-trig',
  geometry: 'geometry-trig',
  trigonometry: 'geometry-trig',
  trig: 'geometry-trig',
  gt: 'geometry-trig',
};

function squeeze(raw: string) {
  return raw.toLowerCase().replace(/\band\b/g, '').replace(/[\s\-_&,.]+/g, '');
}

/** The domain a `\domain{…}` tag names, or null when it names none. */
export function parseDomainTag(raw: string | null | undefined): BankDomain | null {
  if (!raw) return null;
  return DOMAIN_ALIASES[squeeze(raw)] ?? null;
}

/** `\difficulty{2}`, `{medium}` or `{Hard}`; null for anything else. */
export function parseDifficultyTag(raw: string | null | undefined): BankDifficulty | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (value === '1' || value === 'easy') return 1;
  if (value === '2' || value === 'medium') return 2;
  if (value === '3' || value === 'hard') return 3;
  return null;
}

/*
 * Shorter names for the places a domain sits beside other facts - a badge in
 * a row, the test editor's question list - where "Problem-Solving and Data
 * Analysis" would push the question text out. Pickers and the question page
 * keep the full College Board names.
 */
const DOMAIN_SHORT_LABELS: Record<BankDomain, string> = {
  algebra: 'Algebra',
  'advanced-math': 'Advanced Math',
  'problem-solving': 'Problem-Solving',
  'geometry-trig': 'Geometry & Trig',
};

export function getDomainShortLabel(value: string | null | undefined) {
  return isBankDomain(value) ? DOMAIN_SHORT_LABELS[value] : 'Not sorted';
}

/** "Algebra · Medium", "Not sorted" when either tag is missing. */
export function formatBankTags(domain: string | null | undefined, difficulty: number | null | undefined) {
  if (!isBankDomain(domain) || !isBankDifficulty(difficulty)) return 'Not sorted';
  return `${getDomainShortLabel(domain)} · ${getDifficultyLabel(difficulty)}`;
}

/** The two tags of one question while the admin is still choosing them. */
export type QuestionTagDraft = {
  domain: BankDomain | null;
  difficulty: BankDifficulty | null;
};

export function isTagged(tag: QuestionTagDraft) {
  return tag.domain !== null && tag.difficulty !== null;
}

/** Questions per bank page the list offers; the first is the default. */
export const BANK_PAGE_SIZES = [20, 50, 100] as const;
export type BankPageSize = (typeof BANK_PAGE_SIZES)[number];
const DEFAULT_BANK_PAGE_SIZE: BankPageSize = BANK_PAGE_SIZES[0];
/** Per page of the build page's browser. */
export const BANK_PICKER_PAGE_SIZE = 20;
export const MAX_BANK_SEARCH_LENGTH = 100;

/**
 * What the bank list is narrowed to. It travels in the URL (`?bank=official&
 * domain=algebra,geometry-trig&difficulty=3&q=…&unsorted=1&page=2`), so a
 * filtered list survives a reload and the back button; it carries question
 * text only, never anything about a person.
 */
export type BankFilters = {
  /** Which bank is searched. Not a choice of its own: it scopes the others. */
  bank: BankId;
  domains: BankDomain[];
  difficulties: BankDifficulty[];
  /** Words in the question text or its source file name. */
  q: string;
  /** Only questions that still lack a domain or a difficulty. */
  unsorted: boolean;
};

export const EMPTY_BANK_FILTERS: BankFilters = { bank: 'own', domains: [], difficulties: [], q: '', unsorted: false };

type SearchParamValue = string | string[] | undefined;

function readParam(value: SearchParamValue) {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

function readList(value: SearchParamValue) {
  return (Array.isArray(value) ? value.join(',') : value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Keeps the bank's order and drops repeats, so two URLs never mean one list twice. */
function inBankOrder<T>(values: readonly T[], order: readonly { value: T }[]) {
  return order.map((item) => item.value).filter((value) => values.includes(value));
}

export function normalizeBankFilters(input: Partial<BankFilters> | null | undefined): BankFilters {
  const domains = Array.isArray(input?.domains) ? input.domains.filter(isBankDomain) : [];
  const difficulties = Array.isArray(input?.difficulties) ? input.difficulties.filter(isBankDifficulty) : [];

  return {
    bank: readBankId(input?.bank),
    domains: inBankOrder(domains, BANK_DOMAINS),
    difficulties: inBankOrder(difficulties, BANK_DIFFICULTIES),
    q: typeof input?.q === 'string' ? input.q.trim().slice(0, MAX_BANK_SEARCH_LENGTH) : '',
    unsorted: input?.unsorted === true,
  };
}

export function readBankFilters(params: Record<string, SearchParamValue> | undefined) {
  const page = Number(readParam(params?.page));
  const size = Number(readParam(params?.size));

  return {
    filters: normalizeBankFilters({
      bank: readBankId(readParam(params?.bank)),
      domains: readList(params?.domain).filter(isBankDomain),
      difficulties: readList(params?.difficulty).map(Number).filter(isBankDifficulty),
      q: readParam(params?.q),
      unsorted: readParam(params?.unsorted) === '1',
    }),
    page: Number.isFinite(page) && page > 1 ? Math.floor(page) : 1,
    size: BANK_PAGE_SIZES.find((option) => option === size) ?? DEFAULT_BANK_PAGE_SIZE,
  };
}

/** Whether anything is chosen to search for; the bank alone is not a choice. */
export function hasBankFilters(filters: BankFilters) {
  return filters.domains.length > 0 || filters.difficulties.length > 0 || filters.q !== '' || filters.unsorted;
}

/** Nothing chosen, in the given bank: what Clear goes back to. */
export function emptyBankFilters(bank: BankId): BankFilters {
  return { ...EMPTY_BANK_FILTERS, bank };
}

/** The bank list's URL for these filters; our own bank, page 1 and the default size are left out. */
export function bankListHref(filters: BankFilters, page = 1, size: BankPageSize = DEFAULT_BANK_PAGE_SIZE) {
  const query = new URLSearchParams();
  if (filters.bank !== 'own') query.set('bank', filters.bank);
  if (filters.domains.length > 0) query.set('domain', filters.domains.join(','));
  if (filters.difficulties.length > 0) query.set('difficulty', filters.difficulties.join(','));
  if (filters.q) query.set('q', filters.q);
  if (filters.unsorted) query.set('unsorted', '1');
  if (page > 1) query.set('page', String(page));
  if (size !== DEFAULT_BANK_PAGE_SIZE) query.set('size', String(size));
  const search = query.toString();

  return search ? `/admin/bank?${search}` : '/admin/bank';
}

/** Adds the value when it is missing, takes it out when it is there. */
export function toggleValue<T>(values: readonly T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/** How a question is answered, said the same way in every bank list. */
export type BankQuestionKind = 'choice' | 'multi-select' | 'grid-in';

/** A bank question as the pickers and lists show it, maths already typeset on the server. */
export type BankPickRow = {
  id: string;
  /** The opening of the question as HTML (src/app/admin/tests/questionPreview.ts). */
  previewHtml: string;
  domain: BankDomain | null;
  difficulty: BankDifficulty | null;
  kind: BankQuestionKind;
  hasImage: boolean;
  /** From the official SAT bank rather than our own. */
  official: boolean;
};

/** One question of a checked `.tex` file, for the import preview. */
export type TexCheckQuestion = {
  order: number;
  /** From the file's `\module` markers; null when it has none. */
  markerModule: number | null;
  previewHtml: string;
  /** `\image{…}` as written, matched against the chosen image files by name. */
  image: string | null;
  kind: BankQuestionKind;
  /** What `\domain{…}` and `\difficulty{…}` say, raw, and what the bank reads them as. */
  domainTag: string | null;
  difficultyTag: string | null;
  domain: BankDomain | null;
  difficulty: BankDifficulty | null;
};

export type TexCheckResult =
  | { success: true; fileName: string; questions: TexCheckQuestion[]; hasModuleMarkers: boolean }
  | { success: false; error: string };
