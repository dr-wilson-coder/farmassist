// ═══════════════════════════════════════════════════════════════════════════════
// FILE: lib/supabaseClient.ts
// One shared Supabase connection for the whole app, instead of creating a
// new one on every page. This is what fixes the "Multiple GoTrueClient
// instances" warning you've been seeing in the terminal.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);