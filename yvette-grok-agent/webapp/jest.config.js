module.exports = {
    testEnvironment: 'jsdom',
    transform: {'^.+\\.tsx?$': ['ts-jest', {tsconfig: {jsx: 'react', esModuleInterop: true}}]},
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
};
