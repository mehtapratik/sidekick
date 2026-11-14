import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';

import { requireUserLock } from './require-user-lock';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
   languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const LOCK_IMPORT = "import { withUserLock } from './lock';";

ruleTester.run('require-user-lock', requireUserLock, {
   valid: [
      `${LOCK_IMPORT}
     export const register = withUserLock(async (tx, payload) => {
        return tx.insert(entityIndex).values(payload).returning();
     });`,
      `${LOCK_IMPORT}
     export const save = withUserLock(async (tx, payload) => {
        await tx.update(entityIndex).set(payload).where(match);
        await tx.insert(versionLog).values(payload);
     });`,
      // A named function passed to the wrapper is inside it too
      `${LOCK_IMPORT}
     export const remove = withUserLock(async function remove(tx, id) {
        await tx.delete(probe).where(match);
     });`,
      // Reads need no lock
      `export async function getEntity(tx, id) {
        return tx.select().from(entityIndex).where(match);
     }`,
   ],
   invalid: [
      {
         code: 'export async function save(tx) { await tx.update(entityIndex).set({}); }',
         errors: [{ messageId: 'notLocked', data: { method: 'update' } }],
      },
      {
         // A helper hides the write from a wrapped caller, so it's reported too
         code: `${LOCK_IMPORT}
             async function logVersion(tx) { await tx.insert(versionLog).values({}); }
             export const save = withUserLock(async (tx) => logVersion(tx));`,
         errors: [{ messageId: 'notLocked', data: { method: 'insert' } }],
      },
      {
         // A local look-alike doesn't take the lock
         code: `const withUserLock = (write) => write;
             export const save = withUserLock(async (tx) => tx.delete(entityIndex));`,
         errors: [{ messageId: 'notLocked', data: { method: 'delete' } }],
      },
      {
         code: `${LOCK_IMPORT}
             export const save = otherWrapper(async (tx) => tx.insert(entityIndex).values({}));`,
         errors: [{ messageId: 'notLocked', data: { method: 'insert' } }],
      },
      {
         // One wrapped write doesn't cover an unwrapped one in the same file
         code: `${LOCK_IMPORT}
             export const a = withUserLock(async (tx) => tx.insert(entityIndex).values({}));
             export async function b(tx) { await tx.update(entityIndex).set({}); }`,
         errors: [{ messageId: 'notLocked', data: { method: 'update' } }],
      },
   ],
});
