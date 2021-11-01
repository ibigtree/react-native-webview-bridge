const COMMON_EXTENDS = [
  'eslint:recommended',
  'plugin:react-hooks/recommended',
  'plugin:prettier/recommended',
];

module.exports = {
  root: true,
  overrides: [
    {
      files: '**/*.+(ts|tsx)',
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        ...COMMON_EXTENDS,
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
      ],
    },
    {
      files: '**/*.+(js|jsx)',
      env: {
        commonjs: true,
        es6: true,
        node: true,
      },
      extends: [...COMMON_EXTENDS],
    },
  ],
};
