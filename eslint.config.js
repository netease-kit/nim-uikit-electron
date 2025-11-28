import ts from '@typescript-eslint/eslint-plugin'
import vueParser from 'vue-eslint-parser'
import vuePlugin from 'eslint-plugin-vue'

export default [{
  files: ['**/*.vue', '**/*.ts'],
  plugins: {
    '@typescript-eslint': ts,
    vue: vuePlugin
  },
  languageOptions: {
    parser: vueParser,
    parserOptions: {
      parser: '@typescript-eslint/parser',
      sourceType: 'module'
    }
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/semi': ['error', 'always'],
    'quotes': ['error', 'double', { 'avoidEscape': true }],
    'vue/html-quotes': ['error', 'double'],
    'vue/multi-word-component-names': 'off'
  },
  ignores: [
    '**/dist',
    '**/node_modules',
    '**/electron-out',
    '**/tsconfig*.json'
  ]
}]
