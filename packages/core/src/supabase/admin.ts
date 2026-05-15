import { createClient } from '@supabase/supabase-js'

export function createAdminClient(): ReturnType<typeof createClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SECRET_KEY!

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables for admin client')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
