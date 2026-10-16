import type { Rule, Scope } from 'eslint';
import type * as ESTree from 'estree';

/**
 * Requires every Next.js App Router route handler to be wrapped in withApiGuard.
 *
 * The proxy deliberately does not authenticate /api routes; withApiGuard is
 * the only place authentication, feature entitlement, API-key scopes and the
 * RLS context are applied. A handler exported any other way is publicly
 * reachable, so this rule fails closed: anything it cannot verify is reported.
 *
 * Allowed:
 *   export const GET = withApiGuard(handler, options);
 *   (withApiGuard must be an imported binding, not a local look-alike)
 *
 * Reported:
 *   export async function GET() {}           function declaration
 *   export const GET = handler;               not wrapped
 *   export let GET = withApiGuard(handler);   reassignable
 *   export { handler as GET };                cannot be verified
 *   export * from './handlers';               cannot be verified
 *
 * Non-method exports (e.g. `export const dynamic = 'force-dynamic'`) are ignored.
 * Wired up only for app/**\/route.* files via eslint.config.js.
 */
const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const GUARD_NAME = 'withApiGuard';

function isImportedGuardCall(
  init: ESTree.Expression | null | undefined,
  scope: Scope.Scope,
): boolean {
  if (init?.type !== 'CallExpression') return false;
  if (init.callee.type !== 'Identifier' || init.callee.name !== GUARD_NAME) return false;

  let current: Scope.Scope | null = scope;
  while (current) {
    const variable = current.set.get(GUARD_NAME);
    if (variable) return variable.defs.some((def) => def.type === 'ImportBinding');
    current = current.upper;
  }
  return false;
}

export const requireApiGuard: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: `Require route handlers to be exported as \`export const METHOD = ${GUARD_NAME}(...)\`.`,
    },
    messages: {
      notGuarded: `Route handler {{method}} must be exported as \`export const {{method}} = ${GUARD_NAME}(handler, options)\`, with ${GUARD_NAME} imported. Unguarded API routes are publicly reachable.`,
      unverifiable:
        'Route files may only export handlers as `export const METHOD = withApiGuard(...)`. This export form cannot be verified as guarded.',
    },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      ExportAllDeclaration(node: ESTree.ExportAllDeclaration) {
        context.report({ node, messageId: 'unverifiable' });
      },
      ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
        for (const specifier of node.specifiers) {
          const exported =
            specifier.exported.type === 'Identifier'
              ? specifier.exported.name
              : String(specifier.exported.value);
          if (HTTP_METHODS.has(exported)) {
            context.report({ node: specifier, messageId: 'unverifiable' });
          }
        }

        const declaration = node.declaration;
        if (!declaration) return;

        if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') {
          const method = declaration.id?.name;
          if (method && HTTP_METHODS.has(method)) {
            context.report({ node: declaration, messageId: 'notGuarded', data: { method } });
          }
          return;
        }

        if (declaration.type !== 'VariableDeclaration') return;

        const scope = context.sourceCode.getScope(node);
        for (const declarator of declaration.declarations) {
          if (declarator.id.type !== 'Identifier') continue;
          const method = declarator.id.name;
          if (!HTTP_METHODS.has(method)) continue;

          const guarded =
            declaration.kind === 'const' && isImportedGuardCall(declarator.init, scope);
          if (!guarded) {
            context.report({ node: declarator, messageId: 'notGuarded', data: { method } });
          }
        }
      },
    };
  },
};
