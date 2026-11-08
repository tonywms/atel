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
  if (error || !data.user || data.user.email?.toLowerCase() !== "teste@wmsexpert.com.br") return null;
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
  const {data,error}=await bancoServidor().rpc("atel_avancar_os_v525c",{p_usuario:ctx.userId,p_tecnico:ctx.tecnico,p_atendimento:atendimento,p_versao:versao,p_destino:destino});
  if(error)return reply({error:error.message.includes("CONFLITO_ETAPA")?"Etapa alterada ou transicao fora de ordem. Atualize a pagina.":"Falha ao salvar andamento"},error.message.includes("CONFLITO_ETAPA")?409:503);
  return reply({atendimento,etapa:data.etapa,versao:data.versao});
 }catch{return reply({error:"Falha ao validar OS no ERP"},502)}
}
