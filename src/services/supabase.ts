import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Estão faltando as variáveis de ambiente do Supabase no arquivo .env");
}

// O erro estava acontecendo porque provavelmente faltava o "export" aqui nesta linha final:
export const supabase = createClient(supabaseUrl, supabaseKey);