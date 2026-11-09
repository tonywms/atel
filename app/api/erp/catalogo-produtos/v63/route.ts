import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ORG = '6ea04673-4deb-42cf-a001-dbb027120103';
const json = (x: object, status = 200) => NextResponse.json(x, {status, headers:{'Cache-Control':'no-store'}});
export async function GET(req: NextRequest) {
 const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
 if (!token) return json({error:'Autenticacao obrigatoria'},401);
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !pub || !secret) return json({error:'Supabase incompleto'},503);
 const auth = createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error} = await auth.auth.getUser(token);
 if (error || !user) return json({error:'Sessao invalida'},401);
 const db = createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:roles,error:roleError} = await db.from('usuarios_organizacao').select('perfil').eq('organizacao_id',ORG).eq('usuario_id',user.id).eq('ativo',true);
 if (roleError) return json({error:'Nao foi possivel validar permissao'},503);
 if (!roles?.some(x=>x.perfil==='admin')) return json({error:'Apenas administrador'},403);
 const path = process.env.ATEL_ADAPTER_CATALOGO_OFICIAL_PATH || '';
 const fonteConfigurada = /^\/[a-zA-Z0-9/_-]+$/.test(path) && !path.includes('..') && !/^\/(inventario|os|atendimentos)\//.test(path);
 const {count,error:catalogError} = await db.from('atel_erp_produto_catalogo').select('*',{count:'exact',head:true}).eq('organizacao_id',ORG);
 if (catalogError) return json({error:'Falha na consulta do catalogo'},503);
 return json({versao:'V63',modo:'DIAGNOSTICO_SEM_GRAVACAO',catalogoAtual:count,fonteOficialConfigurada:fonteConfigurada,endpointExposto:false,proximaAcao:fonteConfigurada?'Validar contrato e executar GET V62 para simulacao':'Confirmar endpoint mestre real do Adapter',gravados:0});
}
export async function POST(){return json({error:'V63 somente diagnostico; gravacao indisponivel'},405);}
