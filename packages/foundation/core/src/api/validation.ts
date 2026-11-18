import { z } from 'zod';

import type { ApiErrorBody } from './error-response';

// Every zod issue's message is a catalog key, never a sentence (D252). Set
// once for the process: it holds keys, not words, so it's the same for every
// request and locale.
z.config({
   customError: (issue) => `common.validation.${issue.code}`,
});

/** A word the client looks up: a catalog key and the values its message needs (D250) */
export interface ValidationMessage {
   /** The catalog key */
   key: string;
   /** Values the message reads, such as `minimum` */
   values?: Record<string, unknown>;
}

/** One problem with a request's input, at its path */
export interface ValidationIssue {
   /** Where in the input the problem is, such as `['title']` */
   path: (string | number)[];
   /** What the problem is, as a key the client looks up */
   message: ValidationMessage;
}

/** The body of a 400 for invalid input: one code, one issue per problem */
export interface ValidationFailedBody extends ApiErrorBody<'validation_failed'> {
   /** Every problem zod found */
   issues: ValidationIssue[];
}

// Issue fields that aren't message values: the key already says the code, and
// `input` would echo what the user sent back to them.
const NON_VALUE_KEYS = new Set(['code', 'path', 'message', 'input']);

function toValidationMessage(issue: z.core.$ZodIssue): ValidationMessage {
   return {
      key: issue.message,
      // strip out known key/value pairs from ZodIssue object to return only real values
      values: Object.fromEntries(
         Object.entries(issue).filter(([key]) => !NON_VALUE_KEYS.has(key)),
      ),
   };
}

function toPath(issue: z.core.$ZodIssue) {
   return issue.path.map((segment) =>
      typeof segment === 'number' ? segment : String(segment),
   );
}

function toValidationFailedBody(error: z.ZodError): ValidationFailedBody {
   const issues: ValidationIssue[] = error.issues.map((anIssue) => {
      return {
         path: toPath(anIssue),
         message: toValidationMessage(anIssue),
      };
   });
   return {
      code: 'validation_failed',
      issues,
   };
}

/** Answers 400 with Sidekick's own shape for zod's issues, never zod's own format */
function validationFailedResponse(error: z.ZodError): Response {
   return Response.json(toValidationFailedBody(error), { status: 400 });
}

/** A request body that passed its schema: the typed data */
export interface ValidBody<Data> {
   ok: true;
   /** The parsed, typed body */
   data: Data;
}

/** A request body that failed its schema: the 400 to send back */
export interface InvalidBody {
   ok: false;
   /** The validation_failed response, ready to return */
   response: Response;
}

/** The outcome of reading a request body: the valid data, or the 400 to send back */
export type ParsedBody<Data> = ValidBody<Data> | InvalidBody;

/**
 * Parses a request's JSON body against a schema. A body that isn't JSON
 * fails validation like any other bad input, instead of throwing.
 */
export async function parseRequestBody<Schema extends z.ZodType>(
   req: Request,
   schema: Schema,
): Promise<ParsedBody<z.output<Schema>>> {
   const json: unknown = await req.json().catch(() => undefined);
   const result = schema.safeParse(json);

   return result.success
      ? { ok: true, data: result.data }
      : { ok: false, response: validationFailedResponse(result.error) };
}
