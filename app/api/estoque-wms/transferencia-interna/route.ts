import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const org="6ea04673-4deb-42cf-a001-dbb027120103";
const respond=(data:object,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function session(req:NextRequest){
 const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!token||!url||!key)throw Error("Sessão ou configuração Supabase indisponível");
 const db=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)throw Error("Sessão inválida");
 return db;
}
export async function GET(req:NextRequest){
 try {const db=await session(req);const id=req.nextUrl.searchParams.get("id");
 if(id&&!uuid(id))return respond({error:"Identificador inválido"},400);
 const {data,error}=await db.rpc("atel_v35_pendentes",{p_organizacao_id:org,p_transferencia_id:id||null});
 if(error)return respond({error:"Consulta de transferências indisponível",detalhe:error.message},409);
 return respond({ok:true,transferencias:data||[]});}catch(e){return respond({error:e instanceof Error?e.message:"Falha de consulta"},401)}
}
export async function POST(req:NextRequest){
 try {const db=await session(req);const body=await req.json();
 if(!body||typeof body!=="object"||Array.isArray(body))return respond({error:"JSON inválido"},400);
 if(body.acao==="criar"){
 if(body.organizacao_id!==org||!uuid(body.origem_id)||!uuid(body.destino_id)||!uuid(body.material_id)||!uuid(body.chave_idempotencia)||typeof body.quantidade!=="number"||!Number.isFinite(body.quantidade)||body.quantidade<=0)return respond({error:"Parâmetros inválidos"},400);
 const {data,error}=await db.rpc("atel_v35_criar",{p_organizacao_id:org,p_origem_id:body.origem_id,p_destino_id:body.destino_id,p_material_id:body.material_id,p_quantidade:body.quantidade,p_chave:body.chave_idempotencia});
 if(error)return respond({error:"Transferência não autorizada",detalhe:error.message},409);return respond({ok:true,...data});
 }
 if(body.acao==="aceitar"){
 if(body.organizacao_id!==org||!uuid(body.transferencia_id)||typeof body.quantidade_aceita!=="number"||!Number.isFinite(body.quantidade_aceita)||body.quantidade_aceita<0||typeof body.motivo!=="string"||body.motivo.length>500)return respond({error:"Parâmetros inválidos"},400);
 const {data,error}=await db.rpc("atel_v35_aceitar",{p_organizacao_id:org,p_transferencia_id:body.transferencia_id,p_quantidade_aceita:body.quantidade_aceita,p_motivo:body.motivo.trim()});
 if(error)return respond({error:"Aceite não autorizado",detalhe:error.message},409);return respond({ok:true,...data});
 }
 return respond({error:"Ação inválida"},400);
 }catch(e){return respond({error:e instanceof Error?e.message:"Falha no recebimento"},401)}
}
