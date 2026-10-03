module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react/recommended', 'plugin:react/jsx-runtime', 'plugin:react-hooks/recommended', 'plugin:jsx-a11y/recommended'],
  ignorePatterns: ['dist', 'node_modules', 'playwright-report', 'test-results', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  settings: { react: { version: 'detect' } },
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-explicit-any': 'off',
    'react/prop-types': 'off',
    // Prettier (semi: false) keeps a leading ';' before '(' / '[' as ASI protection – not an error.
    'no-extra-semi': 'off',
    // Labels are associated through htmlFor/id or nesting – both are accepted.
    'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', depth: 25 }],
  },
}
