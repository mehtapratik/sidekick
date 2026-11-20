import { describe, expect, it } from 'vitest';

import { matchesIfNoneMatch } from './read-entity';

describe('matchesIfNoneMatch', () => {
   it.each([
      ['the same ETag', '"4"', true],
      ['a different ETag', '"3"', false],
      ['one of several ETags', '"2", "4"', true],
      ['a weak ETag', 'W/"4"', true],
      ['any ETag', '*', true],
   ])('matches %s: %s', (_, header, expected) => {
      expect(matchesIfNoneMatch(header, '"4"')).toBe(expected);
   });

   it('matches nothing without the header', () => {
      expect(matchesIfNoneMatch(null, '"4"')).toBe(false);
   });
});
