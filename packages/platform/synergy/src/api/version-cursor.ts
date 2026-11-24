import { z } from 'zod';

// What a cursor holds: the version number the previous page ended on
const cursorSchema = z.object({ before: z.int().positive() });

/**
 * The cursor for the next page of a version list. Opaque on purpose
 * (base64url JSON), so clients pass it back as it is and never build one;
 * its contents can change without breaking them.
 */
export function encodeVersionCursor(before: number): string {
   return Buffer.from(JSON.stringify({ before })).toString('base64url');
}

/**
 * The version number a cursor points before, or `undefined` if the cursor is
 * not one encodeVersionCursor made.
 */
export function decodeVersionCursor(cursor: string): number | undefined {
   try {
      const json: unknown = JSON.parse(
         Buffer.from(cursor, 'base64url').toString('utf8'),
      );

      return cursorSchema.safeParse(json).data?.before;
   } catch {
      return undefined;
   }
}
