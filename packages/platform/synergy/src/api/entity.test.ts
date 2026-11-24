import { describe, expect, it } from 'vitest';

import type { Entity } from '../contracts';
import { entityETag } from './entity';

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
