import 'server-only';

import type { RlsTx } from '../db';
import { userFeatureEntitlements } from '../db/schema';

const selectFeatureKeys = async (tx: RlsTx) =>
  tx.select({ featureKey: userFeatureEntitlements.featureKey }).from(userFeatureEntitlements);

const toFeatureKeyArray = (entitlements: Awaited<ReturnType<typeof selectFeatureKeys>>) =>
  entitlements.map(({ featureKey }) => featureKey);

/**
 * Retrieves the enabled feature keys of the user whose id withRLS set on tx.
 * RLS filters the rows, so the query needs no user filter of its own.
 * @param tx Transaction opened by withRLS for the caller
 * @returns Keys of enabled features
 */
export async function getEnabledFeatures(tx: RlsTx): Promise<string[]> {
  return toFeatureKeyArray(await selectFeatureKeys(tx));
}
