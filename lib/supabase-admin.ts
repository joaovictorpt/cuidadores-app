import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. This client is initialized with the service_role key, which
// bypasses Row Level Security entirely -- it has full read/write access to
// every bucket and every row Supabase manages. Never import this module
// from a Client Component or any code that ships to the browser; doing so
// would leak the service_role key to anyone viewing the page source. Only
// use it from Server Components, Route Handlers, and other server-side code.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export const CAREGIVER_DOCUMENTS_BUCKET = "caregiver-documents";
