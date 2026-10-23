// Public API surface: route handlers import withApiGuard from @sidekick/core/api.
// resolveApiCaller stays internal; only the guard calls it.
export { type ApiHandler, type ApiHandlerArgs, type GuardOptions, withApiGuard } from './guard';
export type { ApiCaller } from './auth';
