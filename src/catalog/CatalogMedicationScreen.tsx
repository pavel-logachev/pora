import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';

import {
  AddMedicationScreen,
  type AddMedicationScreenProps,
  type CatalogInitializationState,
  type SearchCatalog,
} from '../features/medications/AddMedicationScreen';
import { medicationCatalogAsset } from './catalogAsset';
import {
  MEDICATION_CATALOG_DATABASE_NAME,
  searchMedicationCatalog,
  validateMedicationCatalog,
} from './medicationCatalog';

type CatalogScreenProps = Omit<
  AddMedicationScreenProps,
  'catalogInitializationState' | 'searchCatalog'
>;

interface CatalogConnection {
  state: CatalogInitializationState;
  search?: SearchCatalog;
}

/** Lives inside the provider, checks the opened directory and hands a search function up to the form. */
function CatalogProbe({ onChange }: { onChange: (connection: CatalogConnection) => void }) {
  const db = useSQLiteContext();

  useEffect(() => {
    let active = true;
    validateMedicationCatalog(db).then(
      () => {
        if (active) {
          onChange({ state: 'ready', search: (query) => searchMedicationCatalog(db, query) });
        }
      },
      (error: unknown) => {
        // A wrong or damaged directory must never suggest wrong medicines: fall back to typing the name.
        console.error('[catalog] validation failed', error);
        if (active) onChange({ state: 'unavailable' });
      },
    );
    return () => {
      active = false;
    };
  }, [db, onChange]);

  return null;
}

/**
 * The course form with ЕСКЛП suggestions. The form is on screen at once; the bundled directory opens in the
 * background (the first launch copies it out of the app package) and, if it cannot be opened or does not match
 * this build, the form keeps working with a hand-typed name.
 */
export function CatalogMedicationScreen(props: CatalogScreenProps) {
  const [connection, setConnection] = useState<CatalogConnection>({ state: 'loading' });
  const handleOpenError = useCallback((error: unknown) => {
    console.error('[catalog] open failed', error);
    setConnection({ state: 'unavailable' });
  }, []);

  return (
    <>
      <AddMedicationScreen
        {...props}
        catalogInitializationState={connection.state}
        searchCatalog={connection.search}
      />
      <SQLiteProvider
        assetSource={{ assetId: medicationCatalogAsset }}
        databaseName={MEDICATION_CATALOG_DATABASE_NAME}
        onError={handleOpenError}
      >
        <CatalogProbe onChange={setConnection} />
      </SQLiteProvider>
    </>
  );
}
