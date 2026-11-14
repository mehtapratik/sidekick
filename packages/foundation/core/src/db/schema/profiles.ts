import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';

// Delete model: hard delete. A profile goes with its auth user (ON DELETE
// CASCADE); nothing syncs it offline or restores it.

export const profiles = pgTable('profiles', {
   id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
   email: text('email').notNull(),
   createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
});
