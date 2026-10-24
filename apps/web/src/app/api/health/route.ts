import { withApiGuard } from '@sidekick/core/api';

export const GET = withApiGuard(async function GET() {
  return Response.json({ status: 'ok' });
});
