import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const reply = (obj: object, status = 200) => NextResponse.json(obj, { status, headers });
function bancoServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ATEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVER_KEY_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function contexto(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { db, userId: data.user.id, tecnico: 4157 };
}
async function autorizado(req: NextRequest, atendimento: number) {
  const ctx = await contexto(req);
  if (!ctx) return null;
  const base = process.env.ATEL_ADAPTER_BASE_URL;
  const apiKey = process.env.ATEL_ADAPTER_API_KEY;
  if (!base || !apiKey) throw new Error("Adapter nao configurado");
  const res = await fetch(`${base.replace(/\/$/, "")}/os/tecnico/${ctx.tecnico}`, { headers: { "X-API-Key": apiKey, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error("Consulta ERP indisponivel");
  const ordens: unknown = await res.json();
  if (!Array.isArray(ordens) || !ordens.some((o: unknown) => !!o && typeof o === "object" && Number((o as { atendimento?: unknown }).atendimento) === atendimento)) return null;
  return ctx;
}
function numeroAtendimento(v: unknown) {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
export async function GET(req: NextRequest) {
 const atendimento=numeroAtendimento(req.nextUrl.searchParams.get("atendimento"));
 if (!atendimento) return reply({error:"Atendimento invalido"},400);
 try {
  const ctx=await autorizado(req,atendimento);
  if (!ctx) return reply({error:"Acesso nao autorizado a OS"},403);
  const {data,error}=await bancoServidor().from("atel_os_andamento").select("etapa,versao").eq("usuario_id",ctx.userId).eq("tecnico_erp",ctx.tecnico).eq("atendimento_erp",atendimento).maybeSingle();
  if(error) return reply({error:"Andamento indisponivel"},503);
  return reply({atendimento,etapa:data?.etapa??"PENDENTE",versao:data?.versao??0});
 }catch(e){return reply({error:e instanceof Error && e.message === "SUPABASE_SERVER_KEY_MISSING" ? "Chave de servidor Supabase ausente no ambiente. Configure SUPABASE_SERVICE_ROLE_KEY no servidor." : "Falha ao consultar andamento da OS"},e instanceof Error && e.message === "SUPABASE_SERVER_KEY_MISSING" ? 503 : 502)}
}
export async function PUT(req: NextRequest) {
 let b:Record<string,unknown>;
 try {const json:unknown=await req.json();if(!json||typeof json!=="object"||Array.isArray(json))return reply({error:"Dados invalidos"},400);b=json as Record<string,unknown>;}catch{return reply({error:"JSON invalido"},400)}
 const atendimento=numeroAtendimento(b.atendimento);const versao=Number(b.versao);const destino=b.destino ?? b.etapa;
 if(!atendimento||!Number.isSafeInteger(versao)||versao<0||!["DESLOCAMENTO","NO_CLIENTE","ATENDIMENTO"].includes(String(destino)))return reply({error:"Transicao invalida"},400);
 try {
  const ctx=await autorizado(req,atendimento);if(!ctx)return reply({error:"Acesso nao autorizado a OS"},403);
  // ATEL_E1_V158_2_GATE: a exigência é verificada NO SERVIDOR; nenhum cliente pode pular a APR.
  if(String(destino)==="ATENDIMENTO") {
   const {data:apr,error:aprErro}=await bancoServidor().from("atel_os_apr_riscos_v1582")
     .select("id,resultado,situacao,ciencia,modelo_versao,profissionais")
     .eq("usuario_id",ctx.userId).eq("tecnico_erp",ctx.tecnico).eq("atendimento_erp",atendimento)
     .eq("situacao","REGISTRADO").eq("resultado","APTO").eq("ciencia",true)
     .order("registrado_em",{ascending:false}).limit(1).maybeSingle();
   if(aprErro)return reply({error:"Não foi possível validar a APR de segurança."},503);
   const {data:modeloAtual,error:modeloErro}=await bancoServidor().from("atel_os_apr_modelos_v1582")
     .select("versao").eq("codigo","APR_RISCOS").neq("estado","INATIVO")
     .order("versao",{ascending:false}).limit(1).maybeSingle();
   if(modeloErro||!modeloAtual)return reply({error:"Modelo de APR indisponível para liberação."},503);
   if(!apr||apr.modelo_versao!==modeloAtual.versao)return reply({error:"APR obrigatória não registrada como APTA para a versão atual. Abra a avaliação antes de iniciar o atendimento."},409);
   // ATEL_E1_V158_5_PROFISSIONAIS_GATE: exige a identificação dos profissionais também no servidor.
   if(!Array.isArray(apr.profissionais)||apr.profissionais.length===0||apr.profissionais.some(p=>!p||typeof p.nome!=="string"||!p.nome.trim()||typeof p.funcao!=="string"||!p.funcao.trim()))
    return reply({error:"Identifique os profissionais envolvidos na APR antes de iniciar o atendimento."},409);
  }
  const {data,error}=await bancoServidor().rpc("atel_avancar_os_v525c",{p_usuario:ctx.userId,p_tecnico:ctx.tecnico,p_atendimento:atendimento,p_versao:versao,p_destino:destino});
  if(error)return reply({error:error.message.includes("CONFLITO_ETAPA")?"Etapa alterada ou transicao fora de ordem. Atualize a pagina.":"Falha ao salvar andamento"},error.message.includes("CONFLITO_ETAPA")?409:503);
  return reply({atendimento,etapa:data.etapa,versao:data.versao});
 }catch{return reply({error:"Falha ao validar OS no ERP"},502)}
}
