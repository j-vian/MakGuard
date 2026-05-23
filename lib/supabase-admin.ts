import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Server-only client (service role). Import only from API routes / Server Components. */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
