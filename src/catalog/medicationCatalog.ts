import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Offline directory of registered medicines (ЕСКЛП, Минздрав России), bundled with the app as a read-only
 * SQLite database with a full-text index. It only suggests names and forms while a course is being added;
 * the user can always type a name by hand.
 */
export const MEDICATION_CATALOG_SOURCE = 'esklp';
export const MEDICATION_CATALOG_VERSION = 'esklp-2026-07-29-schema-21.5';
export const MEDICATION_CATALOG_RECORD_COUNT = 23_001;
export const MEDICATION_CATALOG_DATABASE_NAME = 'pora-catalog-2026-07-29-0e9f5837.db';

export const DEFAULT_SEARCH_LIMIT = 20;
const MINIMUM_QUERY_LENGTH = 2;
// A wider net than the visible list, so dosage-aware re-ranking has something to choose from.
const CANDIDATE_LIMIT = 80;

export interface MedicationCatalogItem {
  catalogVersion: string;
  sourceUuid: string;
  sourceCode: string;
  tradeName: string;
  inn: string;
  dosage: string;
  form: string;
  registrationNumber: string;
  manufacturer: string;
  /** Included in the list of vital and essential medicines (ЖНВЛП). */
  isZnvlp: boolean;
}

export interface MedicationCatalogCheck {
  catalogVersion: string;
  recordCount: number;
}

interface CatalogRow {
  catalog_version: string;
  source_uuid: string;
  source_code: string;
  trade_name: string;
  inn: string;
  dosage: string;
  form: string;
  registration_number: string;
  manufacturer: string;
  is_znvlp: number;
}

// Units a person types after a number ("40 мг", "5 %", "2 мл"). They are never part of a medicine's name.
const UNIT_WORDS = new Set([
  'мг',
  'мкг',
  'г',
  'гр',
  'мл',
  'л',
  'ме',
  'ед',
  'доз',
  'шт',
  'mg',
  'ml',
  'mcg',
  'g',
  'iu',
]);

/** Lower case, "ё" as "е", everything that is not a letter or digit becomes a space. */
export function normalizeCatalogQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^0-9a-zа-я]+/g, ' ')
    .trim();
}

function isDosageToken(token: string): boolean {
  return /^\d+$/.test(token) || UNIT_WORDS.has(token);
}

/**
 * The tokens that can match a name or an active substance. Numbers and units describe the dosage, which the
 * index does not contain, so they must not be required by the full-text match.
 */
export function nameTokens(normalizedQuery: string): string[] {
  return normalizedQuery.split(' ').filter((token) => token && !isDosageToken(token));
}

/** Every token as a prefix, all required: "телм амл" finds "Телмисартан + Амлодипин". */
export function buildPrefixQuery(tokens: string[]): string {
  return tokens.map((token) => `"${token}"*`).join(' ');
}

function numbersIn(normalizedQuery: string): string[] {
  return normalizedQuery.split(' ').filter((token) => /^\d+$/.test(token));
}

function rowToItem(row: CatalogRow): MedicationCatalogItem {
  return {
    catalogVersion: row.catalog_version,
    sourceUuid: row.source_uuid,
    sourceCode: row.source_code,
    tradeName: row.trade_name,
    inn: row.inn,
    dosage: row.dosage,
    form: row.form,
    registrationNumber: row.registration_number,
    manufacturer: row.manufacturer,
    isZnvlp: row.is_znvlp === 1,
  };
}

/**
 * Confirms that the bundled database is the one this build expects. A stale or truncated copy must never
 * silently suggest wrong medicines: the caller then falls back to manual entry.
 */
export async function validateMedicationCatalog(
  db: SQLiteDatabase,
  expected: MedicationCatalogCheck = {
    catalogVersion: MEDICATION_CATALOG_VERSION,
    recordCount: MEDICATION_CATALOG_RECORD_COUNT,
  },
): Promise<MedicationCatalogCheck> {
  const row = await db.getFirstAsync<{ catalog_version: string | null; record_count: number }>(
    `
    SELECT
      (SELECT value FROM catalog_metadata WHERE key = 'catalog_version') AS catalog_version,
      (SELECT COUNT(*) FROM medication_catalog) AS record_count
  `,
  );
  if (!row?.catalog_version) {
    throw new Error('Catalog metadata is missing');
  }
  if (row.catalog_version !== expected.catalogVersion) {
    throw new Error(
      `Unexpected catalog version: ${row.catalog_version}; expected ${expected.catalogVersion}`,
    );
  }
  if (row.record_count !== expected.recordCount) {
    throw new Error(
      `Unexpected catalog record count: ${row.record_count}; expected ${expected.recordCount}`,
    );
  }
  return { catalogVersion: row.catalog_version, recordCount: row.record_count };
}

/**
 * Prefix search over trade names and active substances. Exact names come first, then names that start with
 * the query, then active substances, then everything else by relevance. When the query carries a dosage
 * ("телмисартан 40"), matching dosages are lifted to the top.
 */
export async function searchMedicationCatalog(
  db: SQLiteDatabase,
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
): Promise<MedicationCatalogItem[]> {
  const normalized = normalizeCatalogQuery(query);
  const tokens = nameTokens(normalized);
  if (normalized.length < MINIMUM_QUERY_LENGTH || tokens.length === 0) return [];

  const nameQuery = tokens.join(' ');
  const rows = await db.getAllAsync<CatalogRow>(
    `
      SELECT
        (SELECT value FROM catalog_metadata WHERE key = 'catalog_version') AS catalog_version,
        item.source_uuid,
        item.source_code,
        item.trade_name,
        item.inn,
        item.dosage,
        item.form,
        item.registration_number,
        item.manufacturer,
        item.is_znvlp
      FROM medication_catalog_fts
      JOIN medication_catalog AS item ON item.id = medication_catalog_fts.rowid
      WHERE medication_catalog_fts MATCH ?
      ORDER BY
        CASE
          WHEN item.search_trade_name = ? THEN 0
          WHEN item.search_trade_name LIKE ? THEN 1
          WHEN item.search_inn = ? THEN 2
          WHEN item.search_inn LIKE ? THEN 3
          ELSE 4
        END,
        bm25(medication_catalog_fts, 10.0, 3.0),
        item.trade_name,
        item.dosage,
        item.form
      LIMIT ?
    `,
    buildPrefixQuery(tokens),
    nameQuery,
    `${nameQuery}%`,
    nameQuery,
    `${nameQuery}%`,
    numbersIn(normalized).length > 0 ? CANDIDATE_LIMIT : limit,
  );

  const items = rows.map(rowToItem);
  const wanted = numbersIn(normalized);
  if (wanted.length === 0) return items.slice(0, limit);

  const dosageScore = (item: MedicationCatalogItem) => {
    const digits = normalizeCatalogQuery(item.dosage).split(' ');
    return wanted.filter((number) => digits.includes(number)).length;
  };
  // Stable: items with the same dosage score keep the relevance order the database produced.
  return items
    .map((item, index) => ({ item, index, score: dosageScore(item) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item)
    .slice(0, limit);
}

const CATALOG_DATE = /^esklp-(\d{4})-(\d{2})-(\d{2})-/;

/** "ЕСКЛП Минздрава России · 29.07.2026" for the line under the suggestions. */
export function catalogSourceLabel(catalogVersion: string): string {
  const match = CATALOG_DATE.exec(catalogVersion);
  const date = match ? ` · ${match[3]}.${match[2]}.${match[1]}` : '';
  return `ЕСКЛП Минздрава России${date}`;
}

/** Catalog texts are upper case ("ТАБЛЕТКИ ПОКРЫТЫЕ ОБОЛОЧКОЙ"); show them the way a person would write them. */
export function sentenceCase(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : '';
}

// Abbreviations that stay in capitals in a company name ("ООО", "АО ФП Оболенское").
const COMPANY_ACRONYMS = new Set(['ооо', 'зао', 'оао', 'пао', 'нпо', 'нпф', 'фгуп', 'нпк', 'ип']);

/** "РЕКИТТ БЕНКИЗЕР ХЭЛСКЭР ЛТД." -> "Рекитт Бенкизер Хэлскэр Лтд." for company names. */
export function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const letters = word.replace(/[^\p{L}]/gu, '').toLowerCase();
      // Initials and short abbreviations ("Б.В.", "АО", "ФП") keep their capitals.
      if (letters.length <= 2 || COMPANY_ACRONYMS.has(letters)) return word.toUpperCase();
      return word
        .toLowerCase()
        .replace(/(^|[-"«(.])(\p{L})/gu, (_match, lead: string, letter: string) => lead + letter.toUpperCase());
    })
    .join(' ');
}

/** The usual way to count a dosage form in stock: "таблетки" -> "таблеток". Unknown forms return undefined. */
export function stockUnitForForm(form: string): string | undefined {
  switch (shortForm(form)) {
    case 'таблетки':
      return 'таблеток';
    case 'капсулы':
      return 'капсул';
    case 'драже':
      return 'драже';
    case 'суппозитории':
      return 'свечей';
    case 'пастилки':
      return 'пастилок';
    case 'саше':
    case 'порошок':
      return 'пакетиков';
    case 'раствор':
    case 'суспензия':
    case 'сироп':
    case 'капли':
    case 'эмульсия':
      return 'мл';
    default:
      return undefined;
  }
}

/** A starting point for "how much per intake" that the person can still change. */
export function suggestedDoseForForm(form: string): string | undefined {
  switch (shortForm(form)) {
    case 'таблетки':
      return '1 таблетка';
    case 'капсулы':
      return '1 капсула';
    case 'драже':
      return '1 драже';
    case 'суппозитории':
      return '1 свеча';
    case 'пастилки':
      return '1 пастилка';
    default:
      return undefined;
  }
}

/** Short dosage-form used in a course ("таблетки покрытые оболочкой" -> "таблетки"). */
export function shortForm(form: string): string {
  const normalized = form.trim().toLowerCase();
  if (!normalized) return '';
  const first = normalized.split(' ')[0] ?? normalized;
  return first.replace(/,$/, '');
}
