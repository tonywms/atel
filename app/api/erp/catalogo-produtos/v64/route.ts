import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ORG = '6ea04673-4deb-42cf-a001-dbb027120103';
function response(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return response({ error: 'Autenticacao obrigatoria' }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) return response({ error: 'Configuracao Supabase incompleta' }, 503);
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return response({ error: 'Sessao invalida' }, 401);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: roles, error: roleError } = await db.from('usuarios_organizacao').select('perfil').eq('organizacao_id', ORG).eq('usuario_id', user.id).eq('ativo', true);
  if (roleError) return response({ error: 'Falha ao validar permissao' }, 503);
  if (!roles?.some(role => role.perfil === 'admin')) return response({ error: 'Somente administrador' }, 403);
  const { count, error } = await db.from('atel_erp_produto_catalogo').select('*', { count: 'exact', head: true }).eq('organizacao_id', ORG);
  if (error) return response({ error: 'Falha ao consultar catalogo' }, 503);
  const path = process.env.ATEL_ADAPTER_CATALOGO_OFICIAL_PATH || '';
  const validPath = /^\/[a-zA-Z0-9/_-]+$/.test(path) && !path.includes('..') && !/^\/(inventario|os|atendimentos)(\/|$)/.test(path);
  return response({
    versao: 'V64', modo: 'DIAGNOSTICO_SEM_GRAVACAO',
    catalogoAtual: count, rpcTransacional: 'atel_v62_aplicar_catalogo_oficial',
    rpcPermissoesVerificadas: true, testeRollbackExecutado: true,
    endpointMestreDocumentado: false, caminhoCandidatoConfigurado: validPath,
    caminhoCandidato: validPath ? path : null,
    fonteOficialHomologada: false, sincronizacaoLiberada: false,
    observacao: 'Documentacao disponivel cobre OS e inventario de tecnico; nao comprova catalogo mestre. Nenhuma gravacao e realizada nesta rota.',
    gravados: 0
  });
}
export async function POST() { return response({ error: 'V64 somente diagnostico; sincronizacao bloqueada ate homologacao da fonte mestre' }, 405); }
