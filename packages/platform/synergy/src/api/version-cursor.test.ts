import { describe, expect, it } from 'vitest';

import { decodeVersionCursor, encodeVersionCursor } from './version-cursor';

describe('version cursor', () => {
   it('decodes what it encodes', () => {
      expect(decodeVersionCursor(encodeVersionCursor(7))).toBe(7);
   });

   it.each([
      ['not base64url JSON', 'not-a-cursor'],
      ['JSON of the wrong shape', Buffer.from('{"v":7}').toString('base64url')],
      ['a version below 1', encodeVersionCursor(0)],
      ['a fractional version', encodeVersionCursor(2.5)],
      ['an empty string', ''],
   ])('refuses %s', (_, cursor) => {
      expect(decodeVersionCursor(cursor)).toBeUndefined();
   });
});
