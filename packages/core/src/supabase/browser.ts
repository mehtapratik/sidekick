import { createBrowserClient as _createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createBrowserClient(): SupabaseClient {
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
   const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

   if (!supabaseUrl || !supabaseKey) {
      throw new Error(
         'Missing Supabase environment variables for browser client',
      );
   }

   return _createBrowserClient(supabaseUrl, supabaseKey);
}
