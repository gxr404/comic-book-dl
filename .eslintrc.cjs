module.exports = {
  ignorePatterns: [
    'dist',
    'types',
    'node_modules',
    'bin',
    'test',
    'docs',
    'temp'
  ],
  env: {
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    semi: ['error', 'never'],
    quotes: ['error', 'single'],
    'no-console': 'off',
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off'
  },
}
