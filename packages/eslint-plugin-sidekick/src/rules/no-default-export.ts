import type { Rule } from 'eslint';

/**
 * Disallows default exports in favour of named exports.
 *
 * Rationale: named exports are explicit, rename-safe, and easier to search.
 * Default exports encourage ambiguous re-naming and make codebase-wide greps
 * unreliable.
 *
 * Next.js convention files (page.tsx, layout.tsx, …) and TypeScript config
 * files (*.config.ts) require default exports and are exempted via ESLint
 * overrides in the root eslint.config.js — not here.
 */
export const noDefaultExport: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow default exports — use named exports instead.',
    },
    messages: {
      noDefaultExport:
        'Default exports are prohibited. Export this as a named export instead.',
    },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: 'noDefaultExport' });
      },
    };
  },
};
