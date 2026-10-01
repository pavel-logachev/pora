// Screens read the system insets; in tests there is no native provider, so use the library's own mock.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
