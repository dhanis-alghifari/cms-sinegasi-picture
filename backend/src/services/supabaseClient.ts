// backend/src/services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { runtimeConfig } from '../config/env.js';

export const supabase = (runtimeConfig.supabaseUrl && runtimeConfig.supabaseServiceRoleKey)
  ? createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      },
    })
  : null;
