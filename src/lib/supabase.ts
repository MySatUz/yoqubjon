import { createClient } from '@supabase/supabase-js';

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials missing. Cloud storage will not work.');
  }

  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  return supabaseAdmin;
}
