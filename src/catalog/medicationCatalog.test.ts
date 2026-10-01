import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  MEDICATION_CATALOG_RECORD_COUNT,
  MEDICATION_CATALOG_VERSION,
  buildPrefixQuery,
  catalogSourceLabel,
  nameTokens,
  normalizeCatalogQuery,
  searchMedicationCatalog,
  sentenceCase,
  shortForm,
  stockUnitForForm,
  suggestedDoseForForm,
  titleCase,
  validateMedicationCatalog,
} from './medicationCatalog';

class NodeSqliteReadAdapter {
  constructor(private readonly database: DatabaseSync) {}

  async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null> {
    return (
      (this.database.prepare(source).get(...(params as never[])) as T | undefined) ?? null
    );
  }

  async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
    return this.database.prepare(source).all(...(params as never[])) as T[];
  }
}

const catalogPath = path.join(__dirname, '..', '..', 'assets', 'catalog', 'pora-catalog.db');

function openCatalog(): { db: SQLiteDatabase; close: () => void } {
  const database = new DatabaseSync(catalogPath, { readOnly: true });
  return {
    db: new NodeSqliteReadAdapter(database) as unknown as SQLiteDatabase,
    close: () => database.close(),
  };
}

describe('catalog query normalization', () => {
  it('lowers case, folds ё and turns punctuation into spaces', () => {
    expect(normalizeCatalogQuery('  Нурофен-Экспресс, 200 мг! ')).toBe('нурофен экспресс 200 мг');
    expect(normalizeCatalogQuery('Ёлка')).toBe('елка');
    expect(normalizeCatalogQuery('L-Тироксин')).toBe('l тироксин');
    expect(normalizeCatalogQuery('   ')).toBe('');
  });

  it('keeps dosage numbers and units out of the full-text match', () => {
    expect(nameTokens(normalizeCatalogQuery('Телмисартан 40 мг'))).toEqual(['телмисартан']);
    expect(nameTokens(normalizeCatalogQuery('40 мг'))).toEqual([]);
    expect(nameTokens(normalizeCatalogQuery('амлодипин 5'))).toEqual(['амлодипин']);
  });

  it('turns every name token into a required prefix', () => {
    expect(buildPrefixQuery(['телм', 'амл'])).toBe('"телм"* "амл"*');
  });

  it('labels the source with the catalog date', () => {
    expect(catalogSourceLabel(MEDICATION_CATALOG_VERSION)).toBe(
      'ЕСКЛП Минздрава России · 29.07.2026',
    );
    expect(catalogSourceLabel('custom')).toBe('ЕСКЛП Минздрава России');
  });

  it('writes catalog capitals the way a person would', () => {
    expect(sentenceCase('ТАБЛЕТКИ ПОКРЫТЫЕ ОБОЛОЧКОЙ')).toBe('Таблетки покрытые оболочкой');
    expect(sentenceCase('  ')).toBe('');
    expect(shortForm('ТАБЛЕТКИ ПОКРЫТЫЕ ПЛЕНОЧНОЙ ОБОЛОЧКОЙ')).toBe('таблетки');
    expect(shortForm('')).toBe('');
  });
});

describe('course defaults from a dosage form', () => {
  it('counts stock in the unit people use', () => {
    expect(stockUnitForForm('ТАБЛЕТКИ ПОКРЫТЫЕ ПЛЕНОЧНОЙ ОБОЛОЧКОЙ')).toBe('таблеток');
    expect(stockUnitForForm('КАПСУЛЫ')).toBe('капсул');
    expect(stockUnitForForm('СУППОЗИТОРИИ РЕКТАЛЬНЫЕ')).toBe('свечей');
    expect(stockUnitForForm('СУСПЕНЗИЯ ДЛЯ ПРИЕМА ВНУТРЬ')).toBe('мл');
    expect(stockUnitForForm('ГЕЛЬ ДЛЯ НАРУЖНОГО ПРИМЕНЕНИЯ')).toBeUndefined();
    expect(stockUnitForForm('')).toBeUndefined();
  });

  it('proposes a single unit as the usual dose, only for solid forms', () => {
    expect(suggestedDoseForForm('ТАБЛЕТКИ')).toBe('1 таблетка');
    expect(suggestedDoseForForm('КАПСУЛЫ')).toBe('1 капсула');
    expect(suggestedDoseForForm('СУППОЗИТОРИИ РЕКТАЛЬНЫЕ')).toBe('1 свеча');
    expect(suggestedDoseForForm('СУСПЕНЗИЯ ДЛЯ ПРИЕМА ВНУТРЬ')).toBeUndefined();
    expect(suggestedDoseForForm('')).toBeUndefined();
  });

  it('writes company names with capitals on every word', () => {
    expect(titleCase('РЕКИТТ БЕНКИЗЕР ХЭЛСКЭР ЛТД.')).toBe('Рекитт Бенкизер Хэлскэр Лтд.');
    expect(titleCase('ООО "ФАРМ-ЦЕНТР"')).toBe('ООО "Фарм-Центр"');
    expect(titleCase('АО ФП ОБОЛЕНСКОЕ')).toBe('АО ФП Оболенское');
    expect(titleCase('ПАТЕОН СОФТДЖЕЛС Б.В.')).toBe('Патеон Софтджелс Б.В.');
    expect(titleCase('')).toBe('');
  });
});

describe('bundled ЕСКЛП catalog', () => {
  let catalog: ReturnType<typeof openCatalog>;

  beforeAll(() => {
    catalog = openCatalog();
  });

  afterAll(() => {
    catalog.close();
  });

  it('is the version and size this build expects', async () => {
    await expect(validateMedicationCatalog(catalog.db)).resolves.toEqual({
      catalogVersion: MEDICATION_CATALOG_VERSION,
      recordCount: MEDICATION_CATALOG_RECORD_COUNT,
    });
  });

  it('refuses a catalog that is not the expected one', async () => {
    await expect(
      validateMedicationCatalog(catalog.db, { catalogVersion: 'esklp-old', recordCount: 1 }),
    ).rejects.toThrow('Unexpected catalog version');
    await expect(
      validateMedicationCatalog(catalog.db, {
        catalogVersion: MEDICATION_CATALOG_VERSION,
        recordCount: 5,
      }),
    ).rejects.toThrow('Unexpected catalog record count');
  });

  it('suggests by trade name, best matches first', async () => {
    const results = await searchMedicationCatalog(catalog.db, 'нурофен');

    expect(results.length).toBeGreaterThan(3);
    expect(results.length).toBeLessThanOrEqual(20);
    expect(results[0]?.tradeName.toLowerCase()).toBe('нурофен');
    expect(results.every((item) => item.tradeName.toLowerCase().startsWith('нурофен'))).toBe(true);
    expect(results[0]).toMatchObject({
      inn: 'ИБУПРОФЕН',
      catalogVersion: MEDICATION_CATALOG_VERSION,
    });
    expect(results[0]?.sourceUuid).toMatch(/[0-9a-f-]{36}/);
  });

  it('finds a medicine by its active substance', async () => {
    const results = await searchMedicationCatalog(catalog.db, 'ибупроф');

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.inn.toLowerCase().includes('ибупроф'))).toBe(true);
  });

  it('is case-insensitive and tolerant of punctuation', async () => {
    const plain = await searchMedicationCatalog(catalog.db, 'нурофен');
    const messy = await searchMedicationCatalog(catalog.db, '  НУРОФЕН!! ');

    expect(messy).toEqual(plain);
  });

  it('requires every typed word', async () => {
    const results = await searchMedicationCatalog(catalog.db, 'нурофен экспресс');

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => /экспресс/i.test(item.tradeName))).toBe(true);
  });

  it('lifts the typed dosage to the top without requiring it in the name', async () => {
    const results = await searchMedicationCatalog(catalog.db, 'нурофен 200 мг');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.dosage).toMatch(/200/);
  });

  it('returns nothing for a query that is too short or is only a dosage', async () => {
    await expect(searchMedicationCatalog(catalog.db, '')).resolves.toEqual([]);
    await expect(searchMedicationCatalog(catalog.db, 'н')).resolves.toEqual([]);
    await expect(searchMedicationCatalog(catalog.db, '40 мг')).resolves.toEqual([]);
    await expect(searchMedicationCatalog(catalog.db, '???')).resolves.toEqual([]);
  });

  it('survives characters that are operators in full-text syntax', async () => {
    for (const query of ['нурофен" OR "', 'нур*', '(нурофен)', 'нурофен AND NOT', "нурофен'; DROP TABLE x;--"]) {
      const results = await searchMedicationCatalog(catalog.db, query);
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it('respects the requested limit', async () => {
    const few = await searchMedicationCatalog(catalog.db, 'нурофен', 3);

    expect(few).toHaveLength(3);
  });

  it('marks essential medicines', async () => {
    const results = await searchMedicationCatalog(catalog.db, 'нурофен');

    expect(results.some((item) => item.isZnvlp)).toBe(true);
    expect(results.every((item) => typeof item.isZnvlp === 'boolean')).toBe(true);
  });

  it('answers quickly enough for typing', async () => {
    const started = Date.now();
    for (const query of ['а', 'па', 'пар', 'пара', 'парац', 'парацет']) {
      await searchMedicationCatalog(catalog.db, query);
    }
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
