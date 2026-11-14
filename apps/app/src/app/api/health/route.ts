import { withApiGuard } from '@sidekick/core/api';

/** Health check for a signed-in caller: answers `{ status: 'ok' }` */
export const GET = withApiGuard(async function GET() {
   return Response.json({ status: 'ok' });
});
