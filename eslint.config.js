import boundaries from "eslint-plugin-boundaries";
import { defineConfig } from 'eslint/config';
import tseslint from "typescript-eslint";

import js from "@eslint/js";

export default defineConfig(
   js.configs.recommended,
   ...tseslint.configs.recommended,
   {
      plugins: {
         boundaries,
      },
      settings: {
         "boundaries/elements": [
            { type: "app-elements", pattern: "apps/*" },
            { type: "package-elements", pattern: "packages/*" },
         ],
      },
      rules: {
         'boundaries/no-unknown': 'error',
         'boundaries/element-types': [
            'error',
            {
               default: 'disallow',
               rules: [
                  {
                     from: 'app-elements',
                     allow: [ 'app-elements', 'package-elements' ]
                  },
                  {
                     from: 'package-elements',
                     allow: [ 'package-elements' ]
                  }
               ]
            }
         ]
      }
   },
   {
      files: ['**/*.cjs'],
      languageOptions: {
         globals: {
            module: 'readonly',
            require: 'readonly',
            exports: 'writable',
            __dirname: 'readonly',
            __filename: 'readonly',
         },
      },
   },
   {
      ignores: [
         '**/node_modules/**',
         '**/dist/**',
         '**/.next/**',
         '**/.turbo/**',
      ],
   }
);
