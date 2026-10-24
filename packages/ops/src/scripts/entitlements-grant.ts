import { and, eq, inArray } from 'drizzle-orm';
import { parseArgs } from 'node:util';

import { profiles, userFeatureEntitlements } from '@sidekick/core/db/schema';
import { ALL_FEATURES } from '@sidekick/features-registry';

import { withPrivilegedDb } from '../lib/db';

// Gives one account features: all of them (--all) or the ones named (--feature, repeatable).
// Prints the plan; writes only with --apply.
// Replaced by: an admin entitlements API, called from the admin UI and the CLI.

const USAGE =
   'Usage: entitlements grant --email <email> (--all | --feature <key> [--feature <key>…]) [--apply]';

class UsageError extends Error {}

interface GrantRequest {
   email: string;
   featureKeys: string[];
   apply: boolean;
}

function parseGrantArgs(args: string[]): GrantRequest {
   let email, feature, apply, all;
   try {
      const { values } = parseArgs({
         args: args,
         strict: true,
         options: {
            email: { type: 'string' },
            all: { type: 'boolean', default: false },
            feature: { type: 'string', multiple: true, default: [] },
            apply: { type: 'boolean', default: false },
         },
      });
      ({ email, feature, apply, all } = values);
   } catch (err) {
      throw new UsageError(err instanceof Error ? err.message : String(err));
   }

   if (!email) {
      throw new UsageError('--email is required.');
   }

   // XOR -> false === false -> error | true === true -> error | false === true -> ok | true === false -> ok
   if (all === feature.length > 0) {
      throw new UsageError(
         'Pass either --all or at least one --feature, not both.',
      );
   }

   const knownKeys = ALL_FEATURES.map(({ key }) => key);
   const unknownKeys = feature.filter((key) => !knownKeys.includes(key));

   if (unknownKeys.length > 0) {
      throw new UsageError(
         `Unknown feature key: ${unknownKeys.join(', ')}. Known keys: ${knownKeys.join(', ') || '(none)'}.`,
      );
   }

   return {
      email,
      featureKeys: all ? knownKeys : [...new Set(feature)],
      apply,
   };
}

async function grantEntitlements(request: GrantRequest): Promise<number> {
   const { email, featureKeys, apply } = request;

   return withPrivilegedDb(async (db) => {
      const matches = await db
         .select({ id: profiles.id })
         .from(profiles)
         .where(eq(profiles.email, email));

      if (matches.length !== 1) {
         console.error(
            `Unique profile not found for email ${email} (found ${matches.length}).`,
         );
         return 1;
      }

      const userId = matches[0].id;
      console.log(`Account: ${email} (${userId})`);

      if (featureKeys.length === 0) {
         console.log('No features to grant: ALL_FEATURES is empty.');
         return 0;
      }

      if (!apply) {
         const existing = await db
            .select({ featureKey: userFeatureEntitlements.featureKey })
            .from(userFeatureEntitlements)
            .where(
               and(
                  eq(userFeatureEntitlements.userId, userId),
                  inArray(userFeatureEntitlements.featureKey, featureKeys),
               ),
            );
         const alreadyEnabled = new Set(existing.map((row) => row.featureKey));
         const toGrant = featureKeys.filter((key) => !alreadyEnabled.has(key));

         console.log(
            `Already enabled: ${[...alreadyEnabled].join(', ') || '(none)'}`,
         );
         console.log(`To enable:       ${toGrant.join(', ') || '(none)'}`);
         console.log('Dry run: nothing written. Add --apply to grant.');
         return 0;
      }

      const granted = await db
         .insert(userFeatureEntitlements)
         .values(featureKeys.map((featureKey) => ({ userId, featureKey })))
         .onConflictDoNothing()
         .returning({ featureKey: userFeatureEntitlements.featureKey });

      console.log(
         `Granted: ${granted.map(({ featureKey }) => featureKey).join(', ') || '(none)'}`,
      );

      return 0;
   });
}

async function main(args: string[]): Promise<number> {
   let request: GrantRequest;
   try {
      request = parseGrantArgs(args);
   } catch (error) {
      if (error instanceof UsageError) {
         console.error(`${error.message}\n${USAGE}`);
         return 2;
      }
      throw error;
   }

   return grantEntitlements(request);
}

if (import.meta.main) {
   try {
      process.exitCode = await main(process.argv.slice(2));
   } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
   }
}
