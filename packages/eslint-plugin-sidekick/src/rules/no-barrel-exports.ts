import type { Rule } from 'eslint';
import type * as ESTree from 'estree';

/**
 * Disallows barrel re-export syntax within apps/.
 *
 * Barrel files (files that only re-export from other modules) cause:
 *   - Circular dependency risks
 *   - Poor tree-shaking — bundlers pull in the whole barrel
 *   - Slower TypeScript project references
 *
 * Flagged patterns:
 *   export * from './foo'          (ExportAllDeclaration)
 *   export { Foo } from './foo'    (ExportNamedDeclaration with a source)
 *
 * Package-level index files are intentional API surfaces and are exempted
 * via ESLint file-scoping in eslint.config.js — this rule is only wired up
 * for apps/web/.
 */
export const noBarrelExports: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow barrel re-exports (export * from / export { X } from). Import from the source file directly.',
    },
    messages: {
      noBarrelExport:
        'Barrel re-exports are prohibited. Import directly from the source file instead of re-exporting here.',
    },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      // export * from './foo'
      ExportAllDeclaration(node: ESTree.ExportAllDeclaration) {
        if (node.source) {
          context.report({ node, messageId: 'noBarrelExport' });
        }
      },
      // export { Foo, Bar } from './foo'
      ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
        if (node.source) {
          context.report({ node, messageId: 'noBarrelExport' });
        }
      },
    };
  },
};
