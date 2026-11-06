import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** V08: leitura autenticada; não altera dados nem substitui stores existentes. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let instance: SupabaseClient | null = null;
export function atelSupabase(): SupabaseClient | null {
  if (!url || !key || !/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url)) return null;
  if (!instance) instance = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return instance;
}

export async function diagnosticarAtel() {
  const client = atelSupabase();
  if (!client) return { estado: 'SEM_CONFIGURACAO' as const, mensagem: 'Configure URL e chave publicável no .env.local.' };
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { estado: 'SEM_SESSAO' as const, mensagem: 'Conexão configurada. Faça login para consultar os dados protegidos.' };
  const { data, error } = await client.from('usuarios_organizacao')
    .select('organizacao_id,perfil,ativo,organizacoes(nome,codigo)')
    .eq('usuario_id', user.id).eq('ativo', true).limit(10);
  if (error) return { estado: 'ERRO_PERMISSAO' as const, mensagem: error.message };
  return { estado: 'AUTENTICADO' as const, mensagem: `${data?.length ?? 0} vínculo(s) ativo(s) encontrado(s).`, vinculos: data ?? [] };
}
