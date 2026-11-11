import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';

import { requireApiGuard } from './require-api-guard';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
   languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const GUARD_IMPORT = "import { withApiGuard } from '@sidekick/core/api';";

ruleTester.run('require-api-guard', requireApiGuard, {
   valid: [
      `${GUARD_IMPORT} export const GET = withApiGuard(async () => Response.json({}));`,
      `${GUARD_IMPORT}
     const handler = async () => Response.json({});
     export const GET = withApiGuard(handler, { feature: 'notes' });
     export const POST = withApiGuard(handler);`,
      // Route segment config is not a handler
      `${GUARD_IMPORT}
     export const dynamic = 'force-dynamic';
     export const GET = withApiGuard(async () => Response.json({}));`,
      // Non-route helpers in the same file are fine
      `export function helper() {}`,
   ],
   invalid: [
      {
         code: 'export async function GET() { return Response.json({}); }',
         errors: [{ messageId: 'notGuarded' }],
      },
      {
         code: 'const handler = async () => Response.json({}); export const GET = handler;',
         errors: [{ messageId: 'notGuarded' }],
      },
      {
         code: `${GUARD_IMPORT} export let GET = withApiGuard(async () => Response.json({}));`,
         errors: [{ messageId: 'notGuarded' }],
      },
      {
         code: 'const withApiGuard = (h) => h; export const GET = withApiGuard(async () => {});',
         errors: [{ messageId: 'notGuarded' }],
      },
      {
         code: `${GUARD_IMPORT} export const GET = otherWrapper(withApiGuard(async () => {}));`,
         errors: [{ messageId: 'notGuarded' }],
      },
      {
         code: 'const handler = async () => {}; export { handler as GET };',
         errors: [{ messageId: 'unverifiable' }],
      },
      {
         code: "export { GET } from './handlers';",
         errors: [{ messageId: 'unverifiable' }],
      },
      {
         code: "export * from './handlers';",
         errors: [{ messageId: 'unverifiable' }],
      },
      {
         code: `${GUARD_IMPORT}
             export const GET = withApiGuard(async () => {});
             export async function POST() {}`,
         errors: [{ messageId: 'notGuarded', data: { method: 'POST' } }],
      },
   ],
});
