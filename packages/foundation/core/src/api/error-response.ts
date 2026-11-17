/** The body of every API error response: a stable code, never words (D201) */
export interface ApiErrorBody<Code extends string = string> {
   /** Which error happened; the client looks up the words */
   code: Code;
}

/** Builds an error response whose whole body is the error's code */
export function errorResponse(code: string, status: number): Response {
   const body: ApiErrorBody = { code };
   return Response.json(body, { status });
}
