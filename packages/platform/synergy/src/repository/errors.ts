// Synergy's error codes. Keys only (D201): the client looks up the words.
// Lesson 4's routes turn each code into an HTTP status.
export type SynergyErrorCode = 'not_found' | 'stale_content';

export class SynergyError extends Error {
   constructor(readonly code: SynergyErrorCode) {
      super(code);
      this.name = 'SynergyError';
   }
}
