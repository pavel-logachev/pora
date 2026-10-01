import packageJson from '../package.json';

/** The version people see in settings. package.json is the single place it is written down. */
export const appVersion: string = packageJson.version;
