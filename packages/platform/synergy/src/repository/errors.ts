import type { SynergyErrorCode } from '../contracts/errors';

/** An expected failure of a Synergy operation, identified by its code */
export class SynergyError extends Error {
   constructor(readonly code: SynergyErrorCode) {
      super(code);
      this.name = 'SynergyError';
   }
}
