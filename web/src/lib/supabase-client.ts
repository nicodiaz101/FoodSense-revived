"use client";

import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebase";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy-project.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "dummy-publishable-key-for-build";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  accessToken: async () => {
    return (await auth.currentUser?.getIdToken(false)) ?? null;
  },
});
