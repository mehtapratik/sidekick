import { pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { profiles } from './profiles';

export const userFeatureEntitlements = pgTable(
  'user_feature_entitlements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    featureKey: text('feature_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (self) => {
    return [
      primaryKey({
        columns: [self.userId, self.featureKey],
      }),
    ];
  },
);
