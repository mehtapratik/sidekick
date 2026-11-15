/** Safe entry point: every user-data query runs inside withRLS. */
export {
   withRLS,
   withUserLock,
   type RlsTx,
   type RlsTxWork,
   type RlsOptions,
} from './rls';
