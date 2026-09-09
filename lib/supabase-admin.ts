import { createClient } from "@supabase/supabase-js";

// SOMENTE SERVIDOR. Este client é inicializado com a service_role key, que
// ignora completamente o Row Level Security -- tem acesso total de
// leitura/escrita a todo bucket e toda linha que o Supabase gerencia. Nunca
// importe este módulo de um Client Component ou qualquer código que vá para
// o navegador; fazer isso vazaria a service_role key para quem visualizar o
// código-fonte da página. Use só a partir de Server Components, Route
// Handlers e outro código server-side.
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
