import { cookies } from 'next/headers'

import { createServerClient as _createServerClient } from '@supabase/ssr'

export async function createServerClient(): Promise<ReturnType<typeof _createServerClient>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables for server client')
  }

  const cookieStore = await cookies()

  return _createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components can't set cookies - middleware handles session refresh
        }
      },
    },
  })
}
