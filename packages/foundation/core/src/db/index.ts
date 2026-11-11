// Safe entry point: every user-data query runs inside withRLS.
export { withRLS, type RlsTx } from './rls';
