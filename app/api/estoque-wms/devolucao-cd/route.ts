import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";export const dynamic="force-dynamic";
const org="6ea04673-4deb-42cf-a001-dbb027120103";
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function client(req:NextRequest){const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!token||!url||!key)throw Error("Sessao ou Supabase indisponivel");const db=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});const {data:{user},error}=await db.auth.getUser(token);if(error||!user)throw Error("Sessao invalida");return db;}
const response=(d:unknown,status=200)=>NextResponse.json(d,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest){try{const db=await client(req);const tipo=req.nextUrl.searchParams.get("tipo")==="enderecos"?"atel_v39_enderecos":"atel_v39_listar";const {data,error}=await db.rpc(tipo,{p_organizacao_id:org});if(error)return response({error:error.message},409);return response({ok:true,items:data??[]});}catch(e){return response({error:e instanceof Error?e.message:"Falha"},401)}}
export async function POST(req:NextRequest){try{const db=await client(req);const b=await req.json();if(b?.acao==="cadastrar_endereco"){
  if(typeof b.codigo!=="string"||!/^[A-Za-z0-9_-]{1,32}$/.test(b.codigo)||typeof b.descricao!=="string"||b.descricao.trim().length<5||b.descricao.length>200||b.confirmacao!=="CONFIRMO ENDERECO FISICO")return response({error:"Dados ou confirmacao invalidos"},400);
  const {data,error}=await db.rpc("atel_v44_cadastrar_endereco",{p_organizacao_id:org,p_codigo:b.codigo,p_descricao:b.descricao,p_confirmacao:b.confirmacao});
  if(error)return response({error:error.message},409);
  return response({ok:true,result:data});
}
if(!uuid(b?.id)||!uuid(b?.endereco_id)||typeof b?.quantidade!=="number"||!Number.isFinite(b.quantidade)||b.quantidade<0||!["OK","AVARIA","DIVERGENCIA"].includes(b.condicao)||typeof b.motivo!=="string"||b.motivo.trim().length<3||b.motivo.length>500)return response({error:"Dados invalidos"},400);const {data,error}=await db.rpc("atel_v39_receber",{p_organizacao_id:org,p_devolucao_id:b.id,p_endereco_id:b.endereco_id,p_quantidade:b.quantidade,p_condicao:b.condicao,p_motivo:b.motivo.trim()});if(error)return response({error:error.message},409);return response({ok:true,result:data});}catch(e){return response({error:e instanceof Error?e.message:"Falha"},401)}}
