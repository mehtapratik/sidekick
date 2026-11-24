import { describe, expect, it } from 'vitest';

import type { Entity } from '../contracts';
import { entityETag, matchesIfNoneMatch } from './read-entity';

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

describe('entityETag', () => {
   const entity: Entity = {
      id: '0b5c1c0e-6f0e-4c0e-8a3e-4b3c2d1e0f9a',
      provider: 'sandbox-notes',
      type: 'note',
      displayName: 'A note',
      status: 'active',
      version: 1,
      revision: 0,
      contentSeq: 0,
      editedAt: '2026-11-23T10:00:00.000Z',
      createdAt: '2026-11-23T10:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
   };

   it('is the same for the same entity', () => {
      expect(entityETag({ ...entity })).toBe(entityETag(entity));
   });

   it('changes when only the status changes', () => {
      expect(entityETag({ ...entity, status: 'deprecated' })).not.toBe(
         entityETag(entity),
      );
   });
});
