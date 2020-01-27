module.exports = {
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/types/*'],
  coverageReporters: ['text-summary'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  setupFiles: ['./src/tests.ts'],
  // setupTestFrameworkScriptFile: 'jest-enzyme',
  // snapshotSerializers: ['enzyme-to-json/serializer'],
  testEnvironment: 'jest-environment-jsdom-sixteen',
  testPathIgnorePatterns: ['/node_modules/'],
  testRegex: '__tests__.*\\.test\\.tsx?$',
  transform: {
    '^.+\\.(j|t)sx?$': 'babel-jest',
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/(?!(lodash-es|@manuscripts)/)'],
}
