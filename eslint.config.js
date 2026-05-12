import js from '@eslint/js';
import security from 'eslint-plugin-security';

export default [
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', 'test/', '.release-it.json'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
    plugins: {
      security,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
      'no-process-exit': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'off',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'warn',
      'security/detect-disable-mustache-escape': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
    },
  },
  {
    // All filesystem paths in src/switchboard/ and bin/ are constructed by the
    // central paths.js module and validated at the application boundary.
    // detect-non-literal-fs-filename is a false positive here: paths are never
    // derived from raw user input without sanitisation.
    files: ['src/switchboard/**/*.js', 'bin/**/*.js'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
];
