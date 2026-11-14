import type { Rule, Scope } from 'eslint';
import type * as ESTree from 'estree';

/**
 * Requires every write in Synergy's repository to run inside withUserLock.
 *
 * Every Synergy write must take the per-user advisory lock before it reads or
 * writes anything (D202), or a delete and a new reference into the same target
 * can both commit. withUserLock takes the lock; this rule checks that each
 * write call sits inside the function passed to it.
 *
 * Allowed:
 *   export const saveX = withUserLock(async (tx, payload) => {
 *      await tx.update(table).set(...);
 *   });
 *   (withUserLock must be an imported binding, not a local look-alike)
 *
 * Reported:
 *   export async function saveX(tx) { await tx.update(table)... }
 *   async function helper(tx) { await tx.insert(table)... }   also helpers
 *   export const saveX = otherWrapper(async (tx) => { tx.delete(table) })
 *
 * A write is any call to a method named insert, update or delete. The rule
 * can't see types, so it can't tell tx.delete from map.delete, and it doesn't
 * see raw SQL writes through tx.execute. Wired up only for Synergy's
 * src/repository/ via eslint.config.js.
 */
const WRITE_METHODS = new Set(['insert', 'update', 'delete']);
const LOCK_NAME = 'withUserLock';

function isImported(name: string, scope: Scope.Scope): boolean {
   let current: Scope.Scope | null = scope;
   while (current) {
      const variable = current.set.get(name);
      if (variable)
         return variable.defs.some((def) => def.type === 'ImportBinding');
      current = current.upper;
   }
   return false;
}

function isLockCall(node: ESTree.Node): boolean {
   return (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === LOCK_NAME
   );
}

export const requireUserLock: Rule.RuleModule = {
   meta: {
      type: 'problem',
      docs: {
         description: `Require every Synergy repository write to run inside ${LOCK_NAME}(...).`,
      },
      messages: {
         notLocked: `.{{method}}() writes outside ${LOCK_NAME}. Every Synergy write must take the user lock first (D202): wrap the function that contains it, as \`export const name = ${LOCK_NAME}(async (tx, ...) => { ... })\`, with ${LOCK_NAME} imported.`,
      },
      schema: [],
   },
   create(context): Rule.RuleListener {
      return {
         CallExpression(node: ESTree.CallExpression) {
            const callee = node.callee;
            if (
               callee.type !== 'MemberExpression' ||
               callee.computed ||
               callee.property.type !== 'Identifier' ||
               !WRITE_METHODS.has(callee.property.name)
            ) {
               return;
            }

            const lockCall = context.sourceCode
               .getAncestors(node)
               .find(isLockCall);
            const locked =
               lockCall !== undefined &&
               isImported(LOCK_NAME, context.sourceCode.getScope(lockCall));

            if (!locked) {
               context.report({
                  node,
                  messageId: 'notLocked',
                  data: { method: callee.property.name },
               });
            }
         },
      };
   },
};
