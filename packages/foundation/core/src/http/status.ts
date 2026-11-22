// Its own entry point, with no imports: browser code (Synergy's /contracts,
// later the UI) can use it without pulling in server-only modules.

/** The HTTP statuses Sidekick's API answers with, by their standard names */
export const HTTP_STATUS = Object.freeze({
   OK: 200,
   CREATED: 201,
   NOT_MODIFIED: 304,
   BAD_REQUEST: 400,
   UNAUTHORIZED: 401,
   FORBIDDEN: 403,
   NOT_FOUND: 404,
   CONFLICT: 409,
   UNPROCESSABLE_CONTENT: 422,
   INTERNAL_SERVER_ERROR: 500,
});

/** One of the statuses in HTTP_STATUS */
export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
